import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Postgres type name kept as "card_type" even though the TS binding and
// column are renamed to capability/capabilityEnum — renaming the
// underlying enum type too would add migration risk (ALTER TYPE RENAME)
// for a purely internal detail nobody outside this file sees.
export const capabilityEnum = pgEnum("card_type", ["qr", "nfc", "combo"]);
export const plateStatusEnum = pgEnum("plate_status", ["unassigned", "active", "suspended"]);
export const interactionTypeEnum = pgEnum("interaction_type", ["qr", "nfc", "unknown"]);
export const userRoleEnum = pgEnum("user_role", ["platform_admin", "business_owner"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    // A deleted user's sessions are meaningless — cascade so no orphaned
    // rows are left behind (no delete-user flow exists yet, but the
    // recovery-script path documented in ARCHITECTURE.md § V4 needs
    // this to not hard-fail on a Postgres FK violation).
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Nullable as of the "quick sale" feature — a business can be created
  // in the field with just a name (e.g. a walk-in sale where the real
  // Google review link isn't known yet) and have the URL filled in later
  // via updateBusiness(). An "active" plate whose business has no URL
  // yet is a normal, expected state (see r/[slug]/route.ts), not a bug.
  googleReviewUrl: text("google_review_url"),
  // Deleting a business owner's account must never delete the business
  // itself (it may have printed QR plates driving real traffic) — set
  // null to return it to the same "no owner yet" state new businesses
  // start in, rather than blocking the delete or cascading.
  // .unique() enforces the documented one-owner-per-business (and one-
  // business-per-owner) invariant at the DB level, not just in app code
  // — Postgres unique constraints permit any number of NULLs, so this
  // doesn't block multiple businesses from having no owner yet.
  ownerId: uuid("owner_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  // Purely a memory-jogger for the admin, unrelated to ownerId's login
  // account — e.g. "the owner who gave us coffee, bald." Never shown to
  // the business itself, never validated beyond a length cap.
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
});

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    // A branch has no independent meaning without its parent business —
    // unlike Business.ownerId (a business must survive its owner being
    // deleted), a branch should go with its business.
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  googleReviewUrl: text("google_review_url").notNull(),
});

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plates = pgTable("plates", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable as of V6 — a plate can exist as unassigned inventory before
  // any business owns it (bulk-manufactured ahead of a sale), unlike
  // V1-V5 where a card was always created already tied to a business.
  businessId: uuid("business_id").references(() => businesses.id),
  // Optional — a plate without a branch behaves exactly as it always
  // has (falls back to the business's own googleReviewUrl). Set null
  // rather than cascade on branch delete: a printed, handed-out plate
  // must keep working (falling back to the business-level URL), not
  // disappear just because its branch was removed — same principle as
  // businesses.owner_id.
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  slug: text("slug").notNull().unique(),
  // Editable after creation (unlike V1-V5's `type`) — an NFC chip can
  // fail in the field, so this isn't fixed forever at manufacture time.
  capability: capabilityEnum("capability").notNull().default("qr"),
  // Default "active" (not "unassigned") deliberately: today's normal
  // creation path (a plate made directly for a business, e.g. via the
  // admin "add plate" form) should keep working exactly as before with
  // no explicit status passed. Only the new bulk/inventory-first
  // creation path (V6c/V6d) explicitly passes "unassigned".
  status: plateStatusEnum("status").notNull().default("active"),
  // Losing the batch association (batch record deleted) must never break
  // a live plate — set null, not cascade, same principle as branchId.
  batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
  // Set by assignNextUnassignedPlate() the moment status flips
  // unassigned -> active. Nothing before V7 recorded *when* a plate was
  // sold, only its current status — this is what makes time-bucketed
  // sales reporting (today/week/month/all-time) possible at all.
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  // Stored as an integer (centavos), not a float, to avoid rounding
  // error — standard money-handling practice. Only set for plates
  // created through V7's inventory-arrival flow; plates made through
  // the existing "Add plate" form, and every plate created before V7
  // existed, stay null (an untracked-cost plate, not a zero-cost one).
  unitCostCents: integer("unit_cost_cents"),
  // V7b: what the plate was actually sold for, entered alongside
  // assignNextUnassignedPlate() (the same "sold" event unitCostCents/
  // assignedAt already key off). Required at the application layer (the
  // assign form won't submit without it) so revenue can't silently
  // undercount a real sale as untracked — still a nullable column
  // because plates created/sold before this requirement existed have no
  // price on file.
  sellPriceCents: integer("sell_price_cents"),
});

export const scanEvents = pgTable("scan_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  plateId: uuid("plate_id")
    .notNull()
    .references(() => plates.id),
  // Real QR-vs-NFC attribution as of V6, via the ?src= redirect-route
  // marker (see ARCHITECTURE.md § V6) — "unknown" is correct as the
  // default for every scan logged before that marker existed, not a
  // placeholder to be silently guessed at.
  interactionType: interactionTypeEnum("interaction_type").notNull().default("unknown"),
  scannedAt: timestamp("scanned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
