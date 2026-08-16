import { NextRequest, NextResponse } from "next/server";
import { getPlateWithBusinessBySlug, logScanEvent } from "@/features/scan-tracking/api";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request.headers);

  if (isRateLimited(ip)) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const { slug } = await params;
  const plate = await getPlateWithBusinessBySlug(slug);

  if (!plate) {
    return new NextResponse("Plate not found", { status: 404 });
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

  await logScanEvent(plate.plateId);

  return NextResponse.redirect(redirectUrl, 302);
}
