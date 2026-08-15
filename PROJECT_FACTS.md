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
- `src/lib/db/client.ts` must initialize the DB connection lazily (on
  first query), not at module import time. `next build` imports every
  route module — even dynamic, non-prerendered ones like `/r/[slug]` —
  to statically collect its config, and CI intentionally has no
  `DATABASE_URL`. An eager `throw` at import time (the original 1a
  version) breaks the build in CI even though no request is ever
  served. Caught by CI on 1b's PR, not by local testing (`.env.local`
  masked it locally).
- V1 is deployed on Vercel's free `nfc-side-hustle.vercel.app`
  subdomain (owner doesn't own a custom domain yet). `DATABASE_URL` is
  wired via Neon's official Vercel integration, not manually copied.
- `scripts/generate-qr.ts` bakes a base URL into every printed QR code
  — a physical artifact that can't be recalled once handed to a
  business. It defaults to the current `.vercel.app` URL but reads
  `QR_BASE_URL` if set, so switching to a custom domain later is a
  config change, not a code edit. It also refuses to generate a QR
  unless the target URL actually resolves (302) first, to catch typos
  before printing, not after.
- The real Saffron QR code is live: `qr-codes/saffron.png` (gitignored,
  regenerate with `npm run qr:generate -- saffron`), encoding
  `https://nfc-side-hustle.vercel.app/r/saffron`. `scan_events` for
  this card currently includes ~49 rows of test/dev traffic mixed in
  with (eventually) real customer scans — not yet cleared as of V1
  completion; revisit before V3's dashboard makes this visible.
- Next.js 16 renamed `middleware.ts` → `proxy.ts` (same functionality,
  new file/function name) — and critically, **Proxy defaults to the
  Node.js runtime**, while the deprecated `middleware.ts` convention
  still runs under the old Edge Runtime default. This matters because
  Edge Runtime doesn't support Node built-ins like `node:crypto` — code
  needing them (e.g. `timingSafeEqual` for auth) must use `proxy.ts`,
  not `middleware.ts`, or it'll silently warn/break. See
  `node_modules/next/dist/docs/.../file-conventions/proxy.md`.
- `ADMIN_USERNAME`/`ADMIN_PASSWORD` are still only set in `.env.local`,
  **not yet in Vercel's production env vars**. Now that 2c has shipped
  a real, usable `/admin/businesses` page, this is no longer a
  low-priority future task — production `/admin` will 401 for
  everyone, including with correct credentials, until this is added.
  Current value is `admin123`/`admin123` — deliberately simple (owner's
  call, for ease of use over strength) — reconsider if/when the admin
  page ever needs to resist a real attacker, not just casual snooping.
- The `@neondatabase/serverless` driver sets Postgres SQLSTATE error
  codes as `.code` on the error it throws, but Drizzle wraps that in
  its own `DrizzleQueryError` via the standard `Error.cause` chain —
  the actual Postgres error code is at `err.cause.code`, not
  `err.code`. Any future code catching DB constraint violations needs
  to check the `.cause`, confirmed the hard way when the first attempt
  at this in `business-management/api.ts` silently didn't work.
- Real test data now lives in production Neon alongside Saffron: a
  "Test Cafe (2b verification)" business with two cards (slugs
  `test-cafe-2b-verify` and `test-cafe-2b-verify-nfc`). Left in place
  deliberately (owner's call) — proves multiple businesses genuinely
  work, but should be cleaned up before this data is ever shown to a
  real user (e.g. once V3's dashboard exists).
- V1's `Business`/`Card`/`ScanEvent` schema allows a business to have
  more than one card (no unique constraint on `cards.businessId`) —
  confirmed this is intentional (a business could eventually have both
  a `qr` card and an `nfc` card once NFC cards arrive), so any code
  that lists businesses must group by business, not assume one row per
  business.
- The "accept the small orphan-business risk" tradeoff from 2b (a
  `createCard` failure right after a successful `createBusiness`
  leaves a card-less business row) only holds when the failure is
  genuinely rare. 2c's admin form initially violated this without
  realizing it — an ordinary typo (duplicate/malformed slug) is common
  admin behavior, not a rare DB failure, and with no delete/update in
  V2 the orphan is permanent. Fixed by validating slug format +
  uniqueness *before* creating the business. Any future flow that
  creates a business and a card together must do the same
  pre-validation — don't rely on the DB constraint alone to protect
  against ordinary user error, only against genuine races.
- More test data accumulated in production Neon during 2c's
  verification, alongside Saffron and the "Test Cafe" business from
  2b: "Real New Business" (slug `real-new-biz`) and a "Duplicate Slug
  Test" business with no card (the orphan case, left in place
  deliberately to prove it renders correctly as "(no cards)" rather
  than vanishing). All of this test data should be cleaned up before
  V3's dashboard makes it visible to a real user.
