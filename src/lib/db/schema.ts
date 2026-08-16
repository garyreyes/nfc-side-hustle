import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const cardTypeEnum = pgEnum("card_type", ["qr", "nfc"]);
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
  googleReviewUrl: text("google_review_url").notNull(),
  // Deleting a business owner's account must never delete the business
  // itself (it may have printed QR cards driving real traffic) — set
  // null to return it to the same "no owner yet" state new businesses
  // start in, rather than blocking the delete or cascading.
  // .unique() enforces the documented one-owner-per-business (and one-
  // business-per-owner) invariant at the DB level, not just in app code
  // — Postgres unique constraints permit any number of NULLs, so this
  // doesn't block multiple businesses from having no owner yet.
  ownerId: uuid("owner_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
});

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  slug: text("slug").notNull().unique(),
  type: cardTypeEnum("type").notNull().default("qr"),
});

export const scanEvents = pgTable("scan_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id),
  scannedAt: timestamp("scanned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
