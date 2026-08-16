import "server-only";
import { eq } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/passwords";
import { db } from "@/lib/db/client";
import { businesses, cards, users } from "@/lib/db/schema";
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
  await requirePlatformAdmin();

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
  await requirePlatformAdmin();

  const [existing] = await db.select().from(cards).where(eq(cards.slug, slug));
  return !!existing;
}

export async function createCard(input: {
  businessId: string;
  slug: string;
  type?: "qr" | "nfc";
}) {
  await requirePlatformAdmin();

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

// Creates a business_owner account and links it to an existing business
// in two separate writes (this driver doesn't support transactions — see
// PROJECT_FACTS.md), so a failure between them could in principle leave
// an unlinked User row. Accepted for the same reason 2b accepted the
// analogous orphan-business risk: genuinely rare (both writes are simple
// single-row operations against tables that were just validated), and
// this is an admin-only, low-volume action, not a public write path.
export async function createBusinessOwner(input: {
  businessId: string;
  email: string;
  password: string;
}) {
  await requirePlatformAdmin();

  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new BusinessManagementError("Owner email is required.");
  }
  if (!input.password) {
    throw new BusinessManagementError("Owner password is required.");
  }

  // Pre-check rather than blindly overwriting: without this, a stale
  // "no owner yet" form (e.g. a second browser tab that hasn't refreshed
  // after a first submission) would silently reassign the business to a
  // new owner and orphan the first one's account with no error and no
  // trace of what happened.
  const [business] = await db
    .select({ id: businesses.id, ownerId: businesses.ownerId })
    .from(businesses)
    .where(eq(businesses.id, input.businessId));
  if (!business) {
    throw new BusinessManagementError("That business no longer exists.");
  }
  if (business.ownerId) {
    throw new BusinessManagementError("This business already has an owner.");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const [owner] = await db
      .insert(users)
      .values({ email, passwordHash, role: "business_owner" })
      .returning();

    const [linked] = await db
      .update(businesses)
      .set({ ownerId: owner.id })
      .where(eq(businesses.id, input.businessId))
      .returning({ id: businesses.id });
    if (!linked) {
      // The business was deleted between the check above and this
      // update — no delete-business feature exists yet, so this is
      // effectively unreachable today, but silently leaving a
      // business_owner account permanently unlinked would be a real
      // data-integrity issue if that ever changes.
      throw new BusinessManagementError(
        "That business no longer exists — the owner account was created but not linked."
      );
    }

    return owner;
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      throw err;
    }
    if (isPgError(err, PG_UNIQUE_VIOLATION)) {
      throw new BusinessManagementError(`Email "${email}" is already in use.`);
    }
    throw err;
  }
}

export type BusinessWithCards = {
  businessId: string;
  name: string;
  googleReviewUrl: string;
  ownerEmail: string | null;
  cards: { cardId: string; slug: string; type: "qr" | "nfc" }[];
};

export async function listBusinesses(): Promise<BusinessWithCards[]> {
  await requirePlatformAdmin();

  const rows = await db
    .select({
      businessId: businesses.id,
      name: businesses.name,
      googleReviewUrl: businesses.googleReviewUrl,
      ownerEmail: users.email,
      cardId: cards.id,
      slug: cards.slug,
      cardType: cards.type,
    })
    .from(businesses)
    .leftJoin(cards, eq(cards.businessId, businesses.id))
    .leftJoin(users, eq(users.id, businesses.ownerId));

  const byBusiness = new Map<string, BusinessWithCards>();
  for (const row of rows) {
    let business = byBusiness.get(row.businessId);
    if (!business) {
      business = {
        businessId: row.businessId,
        name: row.name,
        googleReviewUrl: row.googleReviewUrl,
        ownerEmail: row.ownerEmail,
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
