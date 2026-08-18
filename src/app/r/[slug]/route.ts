import { NextRequest, NextResponse } from "next/server";
import { getPlateBySlug, logScanEvent } from "@/features/scan-tracking/api";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

// Reads the marker baked differently into a plate's printed QR
// (?src=qr) vs. its NFC NDEF payload (?src=nfc) at provisioning time —
// see ARCHITECTURE.md § V6. Anything else (missing, malformed, someone
// typed the bare URL) logs as "unknown" rather than guessing.
function parseInteractionType(request: NextRequest): "qr" | "nfc" | "unknown" {
  const src = request.nextUrl.searchParams.get("src");
  return src === "qr" || src === "nfc" ? src : "unknown";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request.headers);

  if (isRateLimited(ip)) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const { slug } = await params;
  const plate = await getPlateBySlug(slug);

  if (!plate) {
    return new NextResponse("Plate not found", { status: 404 });
  }

  // Log every real hit against an existing plate, regardless of status —
  // an unassigned plate being tapped during pre-sale testing, or a
  // suspended one still getting scanned, are both worth knowing about.
  await logScanEvent(plate.plateId, parseInteractionType(request));

  if (plate.status === "unassigned") {
    return new NextResponse(
      "This plate hasn't been activated yet. If you're the business owner, please contact us to get set up.",
      { status: 200 }
    );
  }

  if (plate.status === "suspended") {
    return new NextResponse("This plate is temporarily paused. Please contact the business directly.", {
      status: 200,
    });
  }

  if (!plate.googleReviewUrl) {
    // A normal, expected state, not a bug: a business can now be created
    // with just a name (quick field sale) and have its Google review URL
    // filled in later via /admin/businesses' Edit form. Until then, an
    // active plate pointing at it has nothing to redirect to yet.
    return new NextResponse(
      "Thanks for scanning! This business hasn't finished setting up their review link yet — please check back soon.",
      { status: 200 }
    );
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(plate.googleReviewUrl);
  } catch {
    console.error(`Invalid googleReviewUrl for plate ${plate.plateId}: ${plate.googleReviewUrl}`);
    return new NextResponse("This plate isn't set up correctly. Please contact the business.", {
      status: 500,
    });
  }

  return NextResponse.redirect(redirectUrl, 302);
}
