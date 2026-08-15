import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, cards } from "@/lib/db/schema";
import { isValidSlug } from "@/lib/slug";

export class BusinessManagementError extends Error {}

const MAX_NAME_LENGTH = 200;

// Postgres SQLSTATE codes the @neondatabase/serverless driver sets as
// `.code` on the DatabaseError it throws. Drizzle wraps that in its own
// DrizzleQueryError via the standard `Error.cause` chain, so the code we
// actually need to check lives at `err.cause.code`, not `err.code`.
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

function isPgError(err: unknown, code: string): boolean {
  const cause = err instanceof Error ? err.cause : undefined;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
}

export async function createBusiness(input: { name: string; googleReviewUrl: string }) {
  const name = input.name.trim();
  const googleReviewUrl = input.googleReviewUrl.trim();

  if (!name) {
    throw new BusinessManagementError("Business name is required.");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new BusinessManagementError(`Business name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  try {
    new URL(googleReviewUrl);
  } catch {
    throw new BusinessManagementError("Google review URL must be a valid URL.");
  }

  const [business] = await db.insert(businesses).values({ name, googleReviewUrl }).returning();
  return business;
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  const [existing] = await db.select().from(cards).where(eq(cards.slug, slug));
  return !!existing;
}

export async function createCard(input: {
  businessId: string;
  slug: string;
  type?: "qr" | "nfc";
}) {
  const slug = input.slug.trim();

  if (!isValidSlug(slug)) {
    throw new BusinessManagementError(
      "Slug must contain only lowercase letters, numbers, and hyphens."
    );
  }

  // Let the database's own constraints be the source of truth rather than
  // a select-then-insert check, which has a race window between two
  // concurrent createCard calls for the same slug (realistic here, since
  // access is a single shared admin password with no per-user session
  // isolation). Both the slug uniqueness and businessId foreign-key
  // constraints are enforced atomically by Postgres on the insert itself.
  // Callers that create a business alongside a card (e.g. the admin form's
  // Server Action) should still pre-check isSlugTaken() before creating
  // the business, so an ordinary duplicate-slug typo never leaves an
  // orphan business row — this catch is the last-resort safety net for
  // the genuinely rare case of two concurrent submissions racing.
  try {
    const [card] = await db
      .insert(cards)
      .values({ businessId: input.businessId, slug, type: input.type ?? "qr" })
      .returning();
    return card;
  } catch (err) {
    if (isPgError(err, PG_UNIQUE_VIOLATION)) {
      throw new BusinessManagementError(`Slug "${slug}" is already in use.`);
    }
    if (isPgError(err, PG_FOREIGN_KEY_VIOLATION)) {
      throw new BusinessManagementError("That business no longer exists.");
    }
    throw err;
  }
}

export type BusinessWithCards = {
  businessId: string;
  name: string;
  googleReviewUrl: string;
  cards: { cardId: string; slug: string; type: "qr" | "nfc" }[];
};

export async function listBusinesses(): Promise<BusinessWithCards[]> {
  const rows = await db
    .select({
      businessId: businesses.id,
      name: businesses.name,
      googleReviewUrl: businesses.googleReviewUrl,
      cardId: cards.id,
      slug: cards.slug,
      cardType: cards.type,
    })
    .from(businesses)
    .leftJoin(cards, eq(cards.businessId, businesses.id));

  const byBusiness = new Map<string, BusinessWithCards>();
  for (const row of rows) {
    let business = byBusiness.get(row.businessId);
    if (!business) {
      business = {
        businessId: row.businessId,
        name: row.name,
        googleReviewUrl: row.googleReviewUrl,
        cards: [],
      };
      byBusiness.set(row.businessId, business);
    }
    // LEFT JOIN produces a row with null card columns for a business with
    // no cards yet (the accepted orphan case) — don't add a fake card for it.
    if (row.cardId && row.slug && row.cardType) {
      business.cards.push({ cardId: row.cardId, slug: row.slug, type: row.cardType });
    }
  }

  return Array.from(byBusiness.values());
}
