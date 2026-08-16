import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { MANILA_TIMEZONE } from "@/features/analytics/constants";
import { requirePlatformAdmin } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/passwords";
import { db } from "@/lib/db/client";
import { batches, branches, businesses, capabilityEnum, plates, users } from "@/lib/db/schema";
import { generateUniqueSlugs, isValidSlug } from "@/lib/slug";

export class BusinessManagementError extends Error {}

const MAX_NAME_LENGTH = 200;

// Postgres SQLSTATE codes the @neondatabase/serverless driver sets as
// `.code` on the DatabaseError it throws. Drizzle wraps that in its own
// DrizzleQueryError via the standard `Error.cause` chain, so the code we
// actually need to check lives at `err.cause.code`, not `err.code`.
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

// Matches the pattern already used in features/analytics/api.ts — a
// malformed id passed straight into a uuid-column query throws a raw
// "invalid input syntax for type uuid" Postgres error (22P02), which
// isPgError() doesn't recognize, so it would otherwise propagate as an
// unhandled error instead of a clean BusinessManagementError.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const [existing] = await db.select().from(plates).where(eq(plates.slug, slug));
  return !!existing;
}

export async function createPlate(input: {
  businessId: string;
  slug: string;
  capability?: "qr" | "nfc" | "combo";
  branchId?: string;
}) {
  await requirePlatformAdmin();

  const slug = input.slug.trim();

  if (!isValidSlug(slug)) {
    throw new BusinessManagementError(
      "Slug must contain only lowercase letters, numbers, and hyphens."
    );
  }

  // If a branch is given, verify it actually belongs to this business
  // before inserting — defense in depth against an admin typo or a
  // tampered form attaching a plate to a different business's branch.
  // The FK alone only guarantees the branch exists, not that it belongs
  // to the business the plate is being created under.
  if (input.branchId) {
    if (!UUID_PATTERN.test(input.branchId)) {
      throw new BusinessManagementError("That branch no longer exists.");
    }
    const [branch] = await db
      .select({ businessId: branches.businessId })
      .from(branches)
      .where(eq(branches.id, input.branchId));
    if (!branch) {
      throw new BusinessManagementError("That branch no longer exists.");
    }
    if (branch.businessId !== input.businessId) {
      throw new BusinessManagementError("That branch doesn't belong to this business.");
    }
  }

  // Let the database's own constraints be the source of truth rather than
  // a select-then-insert check, which has a race window between two
  // concurrent createPlate calls for the same slug (realistic here, since
  // access is a single shared admin password with no per-user session
  // isolation). Both the slug uniqueness and businessId foreign-key
  // constraints are enforced atomically by Postgres on the insert itself.
  // Callers that create a business alongside a plate (e.g. the admin
  // form's Server Action) should still pre-check isSlugTaken() before
  // creating the business, so an ordinary duplicate-slug typo never
  // leaves an orphan business row — this catch is the last-resort safety
  // net for the genuinely rare case of two concurrent submissions racing.
  try {
    const [plate] = await db
      .insert(plates)
      .values({
        businessId: input.businessId,
        slug,
        capability: input.capability ?? "qr",
        branchId: input.branchId,
      })
      .returning();
    return plate;
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

export async function createBranch(input: {
  businessId: string;
  name: string;
  googleReviewUrl: string;
}) {
  await requirePlatformAdmin();

  const name = input.name.trim();
  const googleReviewUrl = input.googleReviewUrl.trim();

  if (!name) {
    throw new BusinessManagementError("Branch name is required.");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new BusinessManagementError(`Branch name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  try {
    new URL(googleReviewUrl);
  } catch {
    throw new BusinessManagementError("Google review URL must be a valid URL.");
  }

  try {
    const [branch] = await db
      .insert(branches)
      .values({ businessId: input.businessId, name, googleReviewUrl })
      .returning();
    return branch;
  } catch (err) {
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

export type BusinessWithPlates = {
  businessId: string;
  name: string;
  googleReviewUrl: string;
  ownerEmail: string | null;
  plates: { plateId: string; slug: string; capability: "qr" | "nfc" | "combo"; branchId: string | null }[];
  branches: { branchId: string; name: string; googleReviewUrl: string }[];
};

export async function listBusinesses(): Promise<BusinessWithPlates[]> {
  await requirePlatformAdmin();

  const rows = await db
    .select({
      businessId: businesses.id,
      name: businesses.name,
      googleReviewUrl: businesses.googleReviewUrl,
      ownerEmail: users.email,
      plateId: plates.id,
      slug: plates.slug,
      plateCapability: plates.capability,
      plateBranchId: plates.branchId,
    })
    .from(businesses)
    .leftJoin(plates, eq(plates.businessId, businesses.id))
    .leftJoin(users, eq(users.id, businesses.ownerId));

  // A separate query rather than also joining branches onto the query
  // above — that join only surfaces branches that already have a plate
  // pointing at them, but the branch list/selector needs every branch a
  // business has, including ones with no plate yet. No transaction support
  // (see PROJECT_FACTS.md), so this is two plain sequential selects
  // merged in JS, same pattern already used for plates/users above.
  const branchRows = await db
    .select({
      businessId: branches.businessId,
      branchId: branches.id,
      name: branches.name,
      googleReviewUrl: branches.googleReviewUrl,
    })
    .from(branches);

  const branchesByBusiness = new Map<string, BusinessWithPlates["branches"]>();
  for (const row of branchRows) {
    const list = branchesByBusiness.get(row.businessId) ?? [];
    list.push({ branchId: row.branchId, name: row.name, googleReviewUrl: row.googleReviewUrl });
    branchesByBusiness.set(row.businessId, list);
  }

  const byBusiness = new Map<string, BusinessWithPlates>();
  for (const row of rows) {
    let business = byBusiness.get(row.businessId);
    if (!business) {
      business = {
        businessId: row.businessId,
        name: row.name,
        googleReviewUrl: row.googleReviewUrl,
        ownerEmail: row.ownerEmail,
        plates: [],
        branches: branchesByBusiness.get(row.businessId) ?? [],
      };
      byBusiness.set(row.businessId, business);
    }
    // LEFT JOIN produces a row with null plate columns for a business with
    // no plates yet (the accepted orphan case) — don't add a fake plate for it.
    if (row.plateId && row.slug && row.plateCapability) {
      business.plates.push({
        plateId: row.plateId,
        slug: row.slug,
        capability: row.plateCapability,
        branchId: row.plateBranchId,
      });
    }
  }

  return Array.from(byBusiness.values());
}

export type PlateListItem = {
  plateId: string;
  slug: string;
  capability: "qr" | "nfc" | "combo";
  status: "unassigned" | "active" | "suspended";
  businessId: string | null;
  businessName: string | null;
  branchId: string | null;
  branchName: string | null;
  batchId: string | null;
  batchName: string | null;
};

export async function listPlates(): Promise<PlateListItem[]> {
  await requirePlatformAdmin();

  return db
    .select({
      plateId: plates.id,
      slug: plates.slug,
      capability: plates.capability,
      status: plates.status,
      businessId: businesses.id,
      businessName: businesses.name,
      branchId: branches.id,
      branchName: branches.name,
      batchId: batches.id,
      batchName: batches.name,
    })
    .from(plates)
    .leftJoin(businesses, eq(plates.businessId, businesses.id))
    .leftJoin(branches, eq(plates.branchId, branches.id))
    .leftJoin(batches, eq(plates.batchId, batches.id))
    .orderBy(plates.status, plates.slug);
}

// Atomic check-and-set via the WHERE clause (status = "unassigned"),
// not a separate select-then-update — avoids a TOCTOU race against a
// concurrent assignment of the same plate without needing a transaction
// (this driver doesn't support them, see PROJECT_FACTS.md).
export async function assignPlateToBusiness(input: {
  plateId: string;
  businessId: string;
  // Optional, same as unitCostCents — a sale recorded without a price
  // stays untracked rather than becoming a false ₱0 sale (see schema.ts).
  sellPriceCents?: number | null;
}) {
  await requirePlatformAdmin();

  if (!UUID_PATTERN.test(input.plateId)) {
    throw new BusinessManagementError("That plate no longer exists.");
  }
  if (
    input.sellPriceCents != null &&
    (!Number.isInteger(input.sellPriceCents) || input.sellPriceCents < 0)
  ) {
    throw new BusinessManagementError("Sale price must be a non-negative amount.");
  }

  try {
    const [updated] = await db
      .update(plates)
      .set({
        businessId: input.businessId,
        status: "active",
        assignedAt: new Date(),
        sellPriceCents: input.sellPriceCents ?? null,
      })
      .where(and(eq(plates.id, input.plateId), eq(plates.status, "unassigned")))
      .returning({ id: plates.id });

    if (!updated) {
      // Either the plate doesn't exist, or it's no longer unassigned
      // (already assigned, possibly by a concurrent request) — both
      // collapse to the same message since the caller's next step is
      // the same either way: reload the list and check its current state.
      throw new BusinessManagementError("This plate no longer exists or is no longer unassigned.");
    }
    return updated;
  } catch (err) {
    if (err instanceof BusinessManagementError) {
      throw err;
    }
    if (isPgError(err, PG_FOREIGN_KEY_VIOLATION)) {
      throw new BusinessManagementError("That business no longer exists.");
    }
    throw err;
  }
}

// Separate from assignment on purpose — branch is scoped to whichever
// business a plate already belongs to, and a plain server-rendered form
// can't offer a dependent business->branch dropdown without client JS.
// Splitting it into its own action (business first, branch after) also
// doubles as the way to change or clear an already-assigned plate's
// branch later, not just set it once at assignment time.
export async function setPlateBranch(input: { plateId: string; branchId: string | null }) {
  await requirePlatformAdmin();

  if (!UUID_PATTERN.test(input.plateId)) {
    throw new BusinessManagementError("That plate no longer exists.");
  }

  const [plate] = await db.select({ businessId: plates.businessId }).from(plates).where(eq(plates.id, input.plateId));
  if (!plate) {
    throw new BusinessManagementError("That plate no longer exists.");
  }
  if (!plate.businessId) {
    throw new BusinessManagementError("Assign this plate to a business before setting its branch.");
  }

  if (input.branchId) {
    if (!UUID_PATTERN.test(input.branchId)) {
      throw new BusinessManagementError("That branch no longer exists.");
    }
    const [branch] = await db
      .select({ businessId: branches.businessId })
      .from(branches)
      .where(eq(branches.id, input.branchId));
    if (!branch) {
      throw new BusinessManagementError("That branch no longer exists.");
    }
    if (branch.businessId !== plate.businessId) {
      throw new BusinessManagementError("That branch doesn't belong to this plate's business.");
    }
  }

  await db.update(plates).set({ branchId: input.branchId }).where(eq(plates.id, input.plateId));
}

export async function updatePlateCapability(input: {
  plateId: string;
  capability: "qr" | "nfc" | "combo";
}) {
  await requirePlatformAdmin();

  if (!UUID_PATTERN.test(input.plateId)) {
    throw new BusinessManagementError("That plate no longer exists.");
  }

  const [updated] = await db
    .update(plates)
    .set({ capability: input.capability })
    .where(eq(plates.id, input.plateId))
    .returning({ id: plates.id });
  if (!updated) {
    throw new BusinessManagementError("That plate no longer exists.");
  }
  return updated;
}

// Can only move between active <-> suspended, never touch an unassigned
// plate — enforced atomically via the WHERE clause (same pattern as
// assignPlateToBusiness), since "suspend" only makes sense for a plate
// that was actually active for some business.
export async function setPlateStatus(input: { plateId: string; status: "active" | "suspended" }) {
  await requirePlatformAdmin();

  if (!UUID_PATTERN.test(input.plateId)) {
    throw new BusinessManagementError("That plate no longer exists.");
  }

  const [updated] = await db
    .update(plates)
    .set({ status: input.status })
    .where(and(eq(plates.id, input.plateId), ne(plates.status, "unassigned")))
    .returning({ id: plates.id });
  if (!updated) {
    throw new BusinessManagementError(
      "This plate no longer exists or hasn't been assigned to a business yet."
    );
  }
  return updated;
}

const MAX_INVENTORY_QUANTITY = 1000;

// V7: records a physical hardware delivery as real database rows the
// moment it arrives — even generic, unserialized cards with nothing
// printed yet — rather than waiting for each unit to be individually
// sold. See ARCHITECTURE.md § V7: this is what makes "how many remain"
// computable at all from `plates` alone.
export async function recordInventoryArrival(input: {
  batchName: string;
  capability: "qr" | "nfc" | "combo";
  quantity: number;
  unitCostCents: number;
}) {
  await requirePlatformAdmin();

  const batchName = input.batchName.trim();
  if (!batchName) {
    throw new BusinessManagementError("Batch name is required.");
  }
  if (batchName.length > MAX_NAME_LENGTH) {
    throw new BusinessManagementError(`Batch name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new BusinessManagementError("Quantity must be a positive whole number.");
  }
  if (input.quantity > MAX_INVENTORY_QUANTITY) {
    throw new BusinessManagementError(`Quantity must be ${MAX_INVENTORY_QUANTITY} or fewer per arrival.`);
  }
  if (!Number.isInteger(input.unitCostCents) || input.unitCostCents < 0) {
    throw new BusinessManagementError("Unit cost must be a non-negative whole number of centavos.");
  }

  let batch;
  try {
    [batch] = await db.insert(batches).values({ name: batchName }).returning();
  } catch (err) {
    if (isPgError(err, PG_UNIQUE_VIOLATION)) {
      throw new BusinessManagementError(`A batch named "${batchName}" already exists.`);
    }
    throw err;
  }

  const slugs = generateUniqueSlugs(input.quantity);

  try {
    await db.insert(plates).values(
      slugs.map((slug) => ({
        slug,
        capability: input.capability,
        status: "unassigned" as const,
        batchId: batch.id,
        unitCostCents: input.unitCostCents,
      }))
    );
  } catch (err) {
    // No transaction support (see PROJECT_FACTS.md) — a failure here can
    // leave an orphan batch row with zero plates. Same accepted-risk
    // class as scripts/generate-batch.ts's identical two-insert sequence.
    console.error(
      `Batch "${batchName}" (id ${batch.id}) was created but inserting its plates failed — ` +
        `the batch row is now orphaned with no plates. Delete it manually before retrying.`
    );
    throw err;
  }

  return batch;
}

// Manila has no DST, so a fixed +08:00 offset is always correct — same
// reasoning already established for day-bucketing in analytics/api.ts,
// but here real UTC instants are needed (not just calendar-day strings)
// since these get compared directly against assignedAt timestamptz
// values in SQL.
function manilaDateParts(): { year: number; month: number; day: number } {
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIMEZONE }).format(new Date());
  const [year, month, day] = todayStr.split("-").map(Number);
  return { year, month, day };
}

function startOfManilaDay(): Date {
  const { year, month, day } = manilaDateParts();
  return new Date(Date.UTC(year, month - 1, day, -8, 0, 0));
}

function startOfManilaWeek(): Date {
  const { year, month, day } = manilaDateParts();
  const asUtcMidnight = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (asUtcMidnight.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  return new Date(Date.UTC(year, month - 1, day - daysSinceMonday, -8, 0, 0));
}

function startOfManilaMonth(): Date {
  const { year, month } = manilaDateParts();
  return new Date(Date.UTC(year, month - 1, 1, -8, 0, 0));
}

const CAPABILITIES = capabilityEnum.enumValues;

export type CapabilityInventorySummary = {
  capability: "qr" | "nfc" | "combo";
  ordered: number;
  remaining: number;
  soldToday: number;
  soldThisWeek: number;
  soldThisMonth: number;
  soldAllTime: number;
  /** null means no plate of this capability has a recorded cost yet. */
  totalCostCents: number | null;
  averageCostCents: number | null;
  // V7b: revenue is summed only over plates that both sold in the
  // bucket AND have a recorded sellPriceCents (SQL sum() ignores NULLs)
  // — same "only counts what was actually recorded" caveat totalCostCents
  // already carries, not a full-accuracy figure if some sales went
  // unpriced.
  revenueTodayCents: number | null;
  revenueThisWeekCents: number | null;
  revenueThisMonthCents: number | null;
  revenueAllTimeCents: number | null;
  // Cost of goods sold — unitCostCents summed only over plates that have
  // actually sold (assignedAt not null), distinct from totalCostCents
  // above which sums over ALL plates of this capability including
  // still-unsold stock.
  costOfGoodsSoldCents: number | null;
  // revenueAllTimeCents - costOfGoodsSoldCents. Null whenever revenue
  // itself is null (nothing priced has sold yet) — a profit of "₱0" would
  // misleadingly read as "sold everything for free" rather than "no data".
  profitAllTimeCents: number | null;
};

export async function getInventorySummary(): Promise<CapabilityInventorySummary[]> {
  await requirePlatformAdmin();

  const todayStart = startOfManilaDay();
  const weekStart = startOfManilaWeek();
  const monthStart = startOfManilaMonth();

  const rows = await db
    .select({
      capability: plates.capability,
      ordered: sql<number>`count(*)`.mapWith(Number),
      remaining: sql<number>`count(*) filter (where ${plates.status} = 'unassigned')`.mapWith(Number),
      soldToday: sql<number>`count(*) filter (where ${plates.assignedAt} >= ${todayStart})`.mapWith(Number),
      soldThisWeek: sql<number>`count(*) filter (where ${plates.assignedAt} >= ${weekStart})`.mapWith(Number),
      soldThisMonth: sql<number>`count(*) filter (where ${plates.assignedAt} >= ${monthStart})`.mapWith(Number),
      soldAllTime: sql<number>`count(*) filter (where ${plates.assignedAt} is not null)`.mapWith(Number),
      // Left as raw string|null rather than .mapWith(Number) — Postgres
      // returns sum()/avg() over an integer column as a value the driver
      // may hand back as a string (bigint-safe), and a group with no
      // cost recorded at all must stay null, not become 0.
      totalCostCents: sql<string | null>`sum(${plates.unitCostCents})`,
      averageCostCents: sql<string | null>`avg(${plates.unitCostCents})`,
      revenueTodayCents: sql<string | null>`sum(${plates.sellPriceCents}) filter (where ${plates.assignedAt} >= ${todayStart})`,
      revenueThisWeekCents: sql<string | null>`sum(${plates.sellPriceCents}) filter (where ${plates.assignedAt} >= ${weekStart})`,
      revenueThisMonthCents: sql<string | null>`sum(${plates.sellPriceCents}) filter (where ${plates.assignedAt} >= ${monthStart})`,
      revenueAllTimeCents: sql<string | null>`sum(${plates.sellPriceCents}) filter (where ${plates.assignedAt} is not null)`,
      costOfGoodsSoldCents: sql<string | null>`sum(${plates.unitCostCents}) filter (where ${plates.assignedAt} is not null)`,
    })
    .from(plates)
    .groupBy(plates.capability);

  const byCapability = new Map(rows.map((row) => [row.capability, row]));

  return CAPABILITIES.map((capability) => {
    const row = byCapability.get(capability);
    const revenueAllTimeCents = row?.revenueAllTimeCents != null ? Math.round(Number(row.revenueAllTimeCents)) : null;
    const costOfGoodsSoldCents =
      row?.costOfGoodsSoldCents != null ? Math.round(Number(row.costOfGoodsSoldCents)) : null;
    return {
      capability,
      ordered: row?.ordered ?? 0,
      remaining: row?.remaining ?? 0,
      soldToday: row?.soldToday ?? 0,
      soldThisWeek: row?.soldThisWeek ?? 0,
      soldThisMonth: row?.soldThisMonth ?? 0,
      soldAllTime: row?.soldAllTime ?? 0,
      totalCostCents: row?.totalCostCents != null ? Math.round(Number(row.totalCostCents)) : null,
      averageCostCents: row?.averageCostCents != null ? Math.round(Number(row.averageCostCents)) : null,
      revenueTodayCents: row?.revenueTodayCents != null ? Math.round(Number(row.revenueTodayCents)) : null,
      revenueThisWeekCents: row?.revenueThisWeekCents != null ? Math.round(Number(row.revenueThisWeekCents)) : null,
      revenueThisMonthCents:
        row?.revenueThisMonthCents != null ? Math.round(Number(row.revenueThisMonthCents)) : null,
      revenueAllTimeCents,
      costOfGoodsSoldCents,
      profitAllTimeCents: revenueAllTimeCents != null ? revenueAllTimeCents - (costOfGoodsSoldCents ?? 0) : null,
    };
  });
}
