# Project Facts

Durable, project-specific decisions that should survive across sessions.

- Database is **Neon**, not Supabase — free-tier Supabase capacity is
  already used by the owner's other projects.
- Query layer is **Drizzle**, chosen over Prisma specifically so SQL
  stays visible/learnable rather than hidden behind codegen (the owner
  is deliberately building SQL fluency alongside the app).
- No admin UI in V1–V3 — data entry is via a one-time seed script. Revisit
  once V2 needs more than one business.
- `Card.type` (`"qr"` | `"nfc"`) exists from V1 even though only QR is in
  use today — owner doesn't have an NFC card in hand yet, but wants
  scan-source analytics to already be possible once NFC cards arrive.
- First real (test) business seeded for V1: **Saffron Middle Eastern
  Restaurant**, slug `saffron`. Its `google_review_url` is a Google Maps
  share link (`maps.app.goo.gl/...`), not a direct "write a review"
  compose link — that shorter deep link is only obtainable by whoever
  manages the business's actual Google Business Profile, which isn't the
  project owner. If Saffron becomes a real paying customer, getting the
  owner to pull the direct review-compose link is a worthwhile upgrade.
- `scripts/seed.ts` is check-then-insert (looks up the card by slug
  first, no-ops if found) rather than transactional, because the
  `@neondatabase/serverless` + `drizzle-orm/neon-http` driver combination
  doesn't support transactions at all (throws if `db.transaction()` is
  called). Any future script doing multiple related inserts against this
  DB needs the same check-first pattern, not a transaction.
- `server-only` (the Next.js package) can't be imported by `src/lib/db/
  client.ts` even though that's where `DATABASE_URL` is read — that file
  is intentionally shared by both Next.js app code and standalone
  scripts run via `tsx` (like `scripts/seed.ts`), and `server-only`
  unconditionally throws outside Next's webpack pipeline. The
  client/server boundary guard belongs in the Next.js-only consuming
  code (added to `src/features/scan-tracking/api.ts` in 1b).
- Rate limiting on `/r/[slug]` (`src/lib/rate-limit.ts`) is a deliberate
  V1 stopgap: an in-memory, per-instance counter, not a real distributed
  limiter. This is intentional — V1's actual traffic (one business) does
  not justify signing up for another external service (e.g. Upstash)
  yet. Revisit only if real abuse shows up or once V2 adds multiple
  businesses raises the stakes.
- Client IP extraction must prefer `x-real-ip` and, failing that, the
  *last* entry of `x-forwarded-for` (not the first) — the first entry is
  whatever the client itself sent and is trivially spoofable, which
  would otherwise let anyone bypass the rate limiter entirely. Found
  during `reviewer` sub-agent review of 1b, not something manual testing
  caught.
