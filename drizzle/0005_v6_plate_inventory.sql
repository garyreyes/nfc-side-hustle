-- V6a: Card -> Plate inventory model. Hand-written (not drizzle-kit
-- generate output) because non-interactive rename detection isn't
-- available in this environment — every rename below uses RENAME TO /
-- RENAME COLUMN / RENAME CONSTRAINT so existing rows (including the real
-- Saffron business's plate) are preserved, never dropped and recreated.

ALTER TABLE "cards" RENAME TO "plates";
--> statement-breakpoint
ALTER TABLE "plates" RENAME CONSTRAINT "cards_business_id_businesses_id_fk" TO "plates_business_id_businesses_id_fk";
--> statement-breakpoint
ALTER TABLE "plates" RENAME CONSTRAINT "cards_branch_id_branches_id_fk" TO "plates_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "plates" RENAME CONSTRAINT "cards_slug_unique" TO "plates_slug_unique";
--> statement-breakpoint
ALTER TABLE "plates" ALTER COLUMN "business_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "plates" RENAME COLUMN "type" TO "capability";
--> statement-breakpoint
ALTER TYPE "public"."card_type" ADD VALUE 'combo';
--> statement-breakpoint
CREATE TYPE "public"."plate_status" AS ENUM('unassigned', 'active', 'suspended');
--> statement-breakpoint
ALTER TABLE "plates" ADD COLUMN "status" "plate_status" DEFAULT 'active' NOT NULL;
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "plates" ADD COLUMN "batch_id" uuid;
--> statement-breakpoint
ALTER TABLE "plates" ADD CONSTRAINT "plates_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scan_events" RENAME COLUMN "card_id" TO "plate_id";
--> statement-breakpoint
ALTER TABLE "scan_events" RENAME CONSTRAINT "scan_events_card_id_cards_id_fk" TO "scan_events_plate_id_plates_id_fk";
--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('qr', 'nfc', 'unknown');
--> statement-breakpoint
ALTER TABLE "scan_events" ADD COLUMN "interaction_type" "interaction_type" DEFAULT 'unknown' NOT NULL;
