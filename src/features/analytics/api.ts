import "server-only";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { requirePlatformAdmin, sessionCanAccessBusiness } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { branches, businesses, cardTypeEnum, cards, scanEvents } from "@/lib/db/schema";
import { DASHBOARD_DATA_START_AT, MANILA_TIMEZONE, type ScanRangeDays } from "./constants";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Per-business queries take businessId straight from a URL segment
// (3c's /admin/dashboard/[businessId]), so it can't be trusted as-is: a
// malformed value would otherwise hit Postgres's uuid column as an
// invalid-input-syntax error, and a well-formed but nonexistent id would
// silently produce an "all zeros" result indistinguishable from a real
// business with no scans yet. Both cases collapse to null here, so
// callers (3c) can 404 on either.
async function businessExists(businessId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(businessId)) return false;
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId));
  return !!row;
}

export type BusinessScanTotal = {
  businessId: string;
  name: string;
  totalScans: number;
};

export async function getBusinessScanTotals(
  startAt: Date = DASHBOARD_DATA_START_AT
): Promise<BusinessScanTotal[]> {
  await requirePlatformAdmin();

  return db
    .select({
      businessId: businesses.id,
      name: businesses.name,
      totalScans: sql<number>`count(${scanEvents.id})`.mapWith(Number),
    })
    .from(businesses)
    .leftJoin(cards, eq(cards.businessId, businesses.id))
    .leftJoin(
      scanEvents,
      and(eq(scanEvents.cardId, cards.id), gte(scanEvents.scannedAt, startAt))
    )
    .groupBy(businesses.id, businesses.name)
    .orderBy(businesses.name, businesses.id);
}

export type ScanTimeSeriesPoint = {
  /** Calendar day in Asia/Manila local time, formatted YYYY-MM-DD. */
  day: string;
  count: number;
};

function getManilaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TIMEZONE }).format(date);
}

// The Philippines has no DST, so treating a Manila calendar-day string as
// a plain UTC date for day-arithmetic purposes is safe — this is just
// counting calendar days, not converting between timezones.
function buildDayRange(days: ScanRangeDays): string[] {
  const today = new Date(`${getManilaDateString(new Date())}T00:00:00Z`);
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

export async function getScanTimeSeries(
  businessId: string,
  days: ScanRangeDays,
  startAt: Date = DASHBOARD_DATA_START_AT
): Promise<ScanTimeSeriesPoint[] | null> {
  if (!(await businessExists(businessId))) return null;
  if (!(await sessionCanAccessBusiness(businessId))) return null;

  // A generous UTC-only prefilter (Manila is UTC+8, so one extra day of
  // buffer covers any offset) — the exact Manila-local day boundary is
  // applied afterward via bucketing, this just limits what the DB scans.
  const windowFloor = new Date(Date.now() - (days + 1) * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      day: sql<string>`to_char(${scanEvents.scannedAt} AT TIME ZONE ${MANILA_TIMEZONE}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(scanEvents)
    .innerJoin(cards, eq(cards.id, scanEvents.cardId))
    .where(
      and(
        eq(cards.businessId, businessId),
        gte(scanEvents.scannedAt, startAt),
        gte(scanEvents.scannedAt, windowFloor)
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const counted = new Map(rows.map((row) => [row.day, row.count]));
  return buildDayRange(days).map((day) => ({ day, count: counted.get(day) ?? 0 }));
}

export type CardTypeBreakdown = {
  type: "qr" | "nfc";
  count: number;
};

// Derived from the schema's enum, not hand-duplicated, so a future third
// card type shows up here automatically instead of silently vanishing
// from the breakdown (see ARCHITECTURE.md: entity definitions live only
// in lib/db/schema.ts).
const CARD_TYPES = cardTypeEnum.enumValues;

export async function getScanBreakdownByCardType(
  businessId: string,
  startAt: Date = DASHBOARD_DATA_START_AT
): Promise<CardTypeBreakdown[] | null> {
  if (!(await businessExists(businessId))) return null;
  if (!(await sessionCanAccessBusiness(businessId))) return null;

  const rows = await db
    .select({
      type: cards.type,
      count: sql<number>`count(${scanEvents.id})`.mapWith(Number),
    })
    .from(cards)
    .leftJoin(
      scanEvents,
      and(eq(scanEvents.cardId, cards.id), gte(scanEvents.scannedAt, startAt))
    )
    .where(eq(cards.businessId, businessId))
    .groupBy(cards.type);

  const counted = new Map(rows.map((row) => [row.type, row.count]));
  return CARD_TYPES.map((type) => ({ type, count: counted.get(type) ?? 0 }));
}

export type BranchScanBreakdown = {
  /** null represents cards not attached to any branch. */
  branchId: string | null;
  name: string;
  totalScans: number;
};

// Returns [] (not null) for a business with no branches — the caller uses
// that to decide whether to render the "by branch" section at all, same
// as the empty-array/notFound distinction ARCHITECTURE.md establishes for
// this component (null means "not found/not allowed", not "no data").
export async function getBranchScanBreakdown(
  businessId: string,
  startAt: Date = DASHBOARD_DATA_START_AT
): Promise<BranchScanBreakdown[] | null> {
  if (!(await businessExists(businessId))) return null;
  if (!(await sessionCanAccessBusiness(businessId))) return null;

  // Rooted at `branches`, not `cards`, so a branch with no card yet still
  // shows up with a 0 total — same completeness reasoning as CARD_TYPES
  // above (a real thing that exists shouldn't silently vanish just
  // because it has no traffic yet).
  const branchRows = await db
    .select({
      branchId: branches.id,
      name: branches.name,
      totalScans: sql<number>`count(${scanEvents.id})`.mapWith(Number),
    })
    .from(branches)
    .leftJoin(cards, eq(cards.branchId, branches.id))
    .leftJoin(
      scanEvents,
      and(eq(scanEvents.cardId, cards.id), gte(scanEvents.scannedAt, startAt))
    )
    .where(eq(branches.businessId, businessId))
    .groupBy(branches.id, branches.name)
    .orderBy(branches.name, branches.id);

  if (branchRows.length === 0) {
    return [];
  }

  // A separate query for cards with no branch at all — these can't be
  // reached by rooting at `branches` above, but still count toward the
  // business's total scans, so they need their own explicit bucket for
  // the numbers to add up to what the "By card type" table already shows.
  const [noBranchRow] = await db
    .select({
      totalScans: sql<number>`count(${scanEvents.id})`.mapWith(Number),
    })
    .from(cards)
    .leftJoin(
      scanEvents,
      and(eq(scanEvents.cardId, cards.id), gte(scanEvents.scannedAt, startAt))
    )
    .where(and(eq(cards.businessId, businessId), isNull(cards.branchId)));

  return [
    ...branchRows.map((row) => ({ branchId: row.branchId, name: row.name, totalScans: row.totalScans })),
    { branchId: null, name: "No branch", totalScans: noBranchRow.totalScans },
  ];
}
