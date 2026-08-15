# Project Facts

Durable, project-specific decisions that should survive across sessions.

- `SESSION_SECRET` is set in Vercel's env vars (Preview + Production
  scopes), confirmed by the owner before 4c's cutover — a **different**
  value than the one in `.env.local`, deliberately, since session
  cookies are already environment-scoped by domain (a `localhost`
  cookie never reaches `.vercel.app`), so there's no need for the
  secrets to match and separate values cost nothing extra.
- A future Server Action that calls a `requirePlatformAdmin()`-guarded
  `api.ts` function from inside a `try/catch` must call
  `requirePlatformAdmin()` itself first, outside that `try` — otherwise
  its internal `redirect()` can get caught by a generic `catch` and
  silently rerouted to a misleading error instead of `/login`. Hit and
  fixed once already in `createBusinessAction` (4c); this pattern will
  recur anywhere `requirePlatformAdmin()`/`verifySession()` gets reused
  inside a try-wrapped mutation, including 4d.
- The real `platform_admin` account exists in production:
  `gary_reyes@dlsu.edu.ph` / `admin123` (same deliberate simplicity as
  the old Basic Auth credentials). Created via `npm run admin:create`,
  idempotent on re-run.
- `users.email` is normalized (lowercased) at both insert and lookup
  time in application code (`features/auth/api.ts`, `scripts/
  create-admin.ts`) — the schema's unique constraint itself is still
  plain case-sensitive text, so any future write path touching
  `users.email` must apply the same lowercasing itself; nothing at the
  DB layer enforces it.
- On this Windows/Git Bash environment, `pkill`/`kill -9` do not
  reliably terminate `npm run dev`/Node processes started via the Bash
  tool's `run_in_background` — they can silently keep running and
  cause port conflicts (`next dev` falling back to 3001, or a stale
  process serving requests while a "fresh" restart's own log looks
  empty) on later verification steps, which cost real time to diagnose
  during 4b. Use `PowerShell`'s `Get-Process node | Stop-Process
  -Force` instead, which does work reliably — check for zero remaining
  node processes before trusting any "fresh dev server" verification
  in future sub-phases.
- V4's two new foreign keys have deliberate, different `ON DELETE`
  behaviors, not Postgres's default: `sessions.user_id` cascades (a
  deleted user's sessions are meaningless), `businesses.owner_id` sets
  to `NULL` (a business with printed QR cards must never be deleted
  just because its owner account was — matches the existing
  orphan-avoidance lesson from 2b/2c). Any future FK added to `users`
  should get the same explicit, deliberate treatment, not the
  Postgres/Drizzle default.
- The V3 admin dashboard's UI/UX is explicitly known to be rough
  (plain unstyled HTML tables, no design pass) — the owner flagged this
  after first viewing it live and deliberately deferred fixing it
  rather than blocking on it. Revisit with a real UI/UX pass later
  (candidate for `/impeccable` if/when this project adopts it); not
  scheduled against a specific version yet.
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
- `ADMIN_USERNAME`/`ADMIN_PASSWORD` are set in both `.env.local` and
  Vercel's production env vars (confirmed working live at
  `nfc-side-hustle.vercel.app/admin/businesses`). Current value is
  `admin123`/`admin123` — deliberately simple (owner's call, for ease
  of use over strength) — reconsider if/when the admin page ever needs
  to resist a real attacker, not just casual snooping.
- The `@neondatabase/serverless` driver sets Postgres SQLSTATE error
  codes as `.code` on the error it throws, but Drizzle wraps that in
  its own `DrizzleQueryError` via the standard `Error.cause` chain —
  the actual Postgres error code is at `err.cause.code`, not
  `err.code`. Any future code catching DB constraint violations needs
  to check the `.cause`, confirmed the hard way when the first attempt
  at this in `business-management/api.ts` silently didn't work.
- (Resolved — see below) Test businesses/cards created while verifying
  2b/2c were manually cleaned up via Neon's table editor. `businesses`
  and `cards` now contain exactly one row each: the real Saffron
  business and its `saffron` card.
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
- Any Next.js admin/data page with **no dynamic route segment and no
  `searchParams`/dynamic API usage** (e.g. `src/app/admin/dashboard/
  page.tsx`) gets silently statically prerendered at build time by
  default — confirmed via the build route table showing `○` instead of
  `ƒ`. For a page that queries live DB data, this both breaks the CI
  build (no `DATABASE_URL` at build time — confirmed by temporarily
  hiding `.env.local` and rebuilding) and, worse, would freeze the
  page's data at whatever it was on the last deploy in production.
  Fixed by adding `export const dynamic = "force-dynamic";`. Pages
  *with* a dynamic route segment (like 3c's upcoming `/admin/dashboard/
  [businessId]`) don't have this problem by default — per Next's own
  docs (`generate-static-params.md`), a dynamic segment with no
  `generateStaticParams` is already rendered on-demand, not
  prerendered — but double-check the build route table for `ƒ` on any
  new data-fetching page regardless, since this is easy to miss.
- (Resolved — see below) `src/features/analytics/constants.ts`'s
  `DASHBOARD_DATA_START_AT` is now set to its real value,
  `2026-08-15T20:11:15Z` (3c launch), confirmed with the owner. Every
  dashboard query excludes scans before this instant — the mechanism
  that keeps V1/V2/V3 test `scan_events` from ever surfacing as real,
  without needing to identify which historical rows were test traffic.
  No manual testing during 3a/3b/3c hit the live production redirect
  route, so nothing real was wrongly excluded by this cutoff.
- Analytics queries bucket by **Asia/Manila calendar day**, not UTC —
  matches what a Manila-based business owner expects from "today's
  scans." Any future analytics query touching `scanEvents.scannedAt`
  should follow the same convention (see `getManilaDateString`/
  `buildDayRange` in `features/analytics/api.ts`), not default to
  Postgres's UTC day boundary.
- `getScanTimeSeries()`/`getScanBreakdownByCardType()` return `null` for
  a missing or malformed `businessId` (checked via `businessExists()`,
  which validates UUID format before ever querying Postgres). 3c's
  `/admin/dashboard/[businessId]` route must treat a `null` return as a
  404, not render an empty/zeroed dashboard — a bad or stale link should
  look broken, not like a real business with no traffic.
- All test businesses/cards from 2b/2c verification ("Test Cafe",
  "Real New Business", "Duplicate Slug Test") were manually deleted
  from production Neon via the table editor (owner did this directly —
  cards deleted before their parent business, due to the FK
  constraint). `businesses`/`cards` are clean now. `scan_events` still
  has ~56 test rows mixed in with Saffron's card (test scans from
  1b/1c/2c verification, indistinguishable from real ones by looking
  at them) — deliberately left alone rather than risk deleting a real
  scan; harmless until V3's dashboard exists.
