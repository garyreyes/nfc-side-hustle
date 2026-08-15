import { NextRequest, NextResponse } from "next/server";
import { getCardWithBusinessBySlug, logScanEvent } from "@/features/scan-tracking/api";
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
  const card = await getCardWithBusinessBySlug(slug);

  if (!card) {
    return new NextResponse("Card not found", { status: 404 });
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(card.googleReviewUrl);
  } catch {
    console.error(`Invalid googleReviewUrl for card ${card.cardId}: ${card.googleReviewUrl}`);
    return new NextResponse("This card isn't set up correctly. Please contact the business.", {
      status: 500,
    });
  }

  await logScanEvent(card.cardId);

  return NextResponse.redirect(redirectUrl, 302);
}
