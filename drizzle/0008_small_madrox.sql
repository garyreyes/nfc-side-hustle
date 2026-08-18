ALTER TABLE "businesses" ALTER COLUMN "google_review_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "notes" text;