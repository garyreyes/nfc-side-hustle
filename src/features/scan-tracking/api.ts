import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, cards, scanEvents } from "@/lib/db/schema";

export async function getCardWithBusinessBySlug(slug: string) {
  const [result] = await db
    .select({
      cardId: cards.id,
      googleReviewUrl: businesses.googleReviewUrl,
    })
    .from(cards)
    .innerJoin(businesses, eq(cards.businessId, businesses.id))
    .where(eq(cards.slug, slug));

  return result ?? null;
}

export async function logScanEvent(cardId: string) {
  try {
    await db.insert(scanEvents).values({ cardId });
  } catch (err) {
    console.error("Failed to log scan event", err);
  }
}
