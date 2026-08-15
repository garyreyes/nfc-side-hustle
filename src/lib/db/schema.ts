import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const cardTypeEnum = pgEnum("card_type", ["qr", "nfc"]);

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  googleReviewUrl: text("google_review_url").notNull(),
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
