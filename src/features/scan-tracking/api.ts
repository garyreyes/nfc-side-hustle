import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { branches, businesses, cards, scanEvents } from "@/lib/db/schema";

export async function getCardWithBusinessBySlug(slug: string) {
  const [result] = await db
    .select({
      cardId: cards.id,
      businessGoogleReviewUrl: businesses.googleReviewUrl,
      branchGoogleReviewUrl: branches.googleReviewUrl,
    })
    .from(cards)
    .innerJoin(businesses, eq(cards.businessId, businesses.id))
    // Left join, not inner — cards.branchId is nullable, so a branch-less
    // card must still resolve (falling back to the business's URL below).
    .leftJoin(branches, eq(cards.branchId, branches.id))
    .where(eq(cards.slug, slug));

  if (!result) {
    return null;
  }

  return {
    cardId: result.cardId,
    googleReviewUrl: result.branchGoogleReviewUrl ?? result.businessGoogleReviewUrl,
  };
}

export async function logScanEvent(cardId: string) {
  try {
    await db.insert(scanEvents).values({ cardId });
  } catch (err) {
    console.error("Failed to log scan event", err);
  }
}
