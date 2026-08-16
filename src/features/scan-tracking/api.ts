import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { branches, businesses, plates, scanEvents } from "@/lib/db/schema";

export async function getPlateWithBusinessBySlug(slug: string) {
  const [result] = await db
    .select({
      plateId: plates.id,
      businessGoogleReviewUrl: businesses.googleReviewUrl,
      branchGoogleReviewUrl: branches.googleReviewUrl,
    })
    .from(plates)
    .innerJoin(businesses, eq(plates.businessId, businesses.id))
    // Left join, not inner — plates.branchId is nullable, so a branch-less
    // plate must still resolve (falling back to the business's URL below).
    .leftJoin(branches, eq(plates.branchId, branches.id))
    .where(eq(plates.slug, slug));

  if (!result) {
    return null;
  }

  return {
    plateId: result.plateId,
    googleReviewUrl: result.branchGoogleReviewUrl ?? result.businessGoogleReviewUrl,
  };
}

export async function logScanEvent(plateId: string) {
  try {
    await db.insert(scanEvents).values({ plateId });
  } catch (err) {
    console.error("Failed to log scan event", err);
  }
}
