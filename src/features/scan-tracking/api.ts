import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { branches, businesses, plates, scanEvents } from "@/lib/db/schema";

export type PlateBySlug = {
  plateId: string;
  status: "unassigned" | "active" | "suspended";
  // null for an unassigned plate (no business yet) or, defensively, an
  // active plate somehow missing its business — callers must not assume
  // "active" implies a non-null URL.
  googleReviewUrl: string | null;
};

export async function getPlateBySlug(slug: string): Promise<PlateBySlug | null> {
  const [result] = await db
    .select({
      plateId: plates.id,
      status: plates.status,
      businessGoogleReviewUrl: businesses.googleReviewUrl,
      branchGoogleReviewUrl: branches.googleReviewUrl,
    })
    .from(plates)
    // Left join, not inner — plates.businessId is nullable as of V6
    // (unassigned pre-sale inventory has no business yet), so an inner
    // join would make an unassigned plate's slug look identical to a
    // slug that doesn't exist at all.
    .leftJoin(businesses, eq(plates.businessId, businesses.id))
    .leftJoin(branches, eq(plates.branchId, branches.id))
    .where(eq(plates.slug, slug));

  if (!result) {
    return null;
  }

  return {
    plateId: result.plateId,
    status: result.status,
    googleReviewUrl: result.branchGoogleReviewUrl ?? result.businessGoogleReviewUrl ?? null,
  };
}

export async function logScanEvent(
  plateId: string,
  interactionType: "qr" | "nfc" | "unknown"
) {
  try {
    await db.insert(scanEvents).values({ plateId, interactionType });
  } catch (err) {
    console.error("Failed to log scan event", err);
  }
}
