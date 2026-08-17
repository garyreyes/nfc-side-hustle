# Project Facts

Durable, project-specific decisions that should survive across sessions.

- **A schema migration that renames/removes something the currently
  deployed code depends on must ship in the same motion as the matching
  code deploy — never run the migration first and deploy separately
  later**, even with explicit confirmation on each step individually.
  Hit this the hard way on 6a: running the `cards`→`plates` rename
  migration against production before the renamed code was deployed left
  the live `/r/[slug]` redirect route 500ing for real customers for a
  few minutes (old deployed code still querying the now-nonexistent
  `cards` table). Fixed by immediately shipping the already-tested code.
  Any future migration that renames or drops something in current use
  needs the code change committed, pushed, and ready to merge *before*
  the migration runs — ideally merged within seconds of the migration
  completing, not as a separate later step.
- `Card` was renamed to `Plate` in 6a (V6) — schema, `features/` modules,
  and the admin UI all say "Plate" now, matching the term used with the
  Alibaba supplier and going forward for the physical product. The one
  exception: the underlying Postgres enum type name for capability
  stayed `card_type` (only the TS binding is `capabilityEnum`) —
  deliberate, to avoid the extra migration risk of an `ALTER TYPE
  RENAME` for a purely internal detail nobody outside `schema.ts` sees.
  Any future schema work touching capability should be aware the SQL
  type name and the TS/domain name now differ on purpose.
- The login page lives at `/` (root), not `/login` — `/login` was
  deleted. The root route was still Next's untouched `create-next-app`
  boilerplate through the end of the V1-V5 roadmap; this replaced it
  with the real login page (same logic that used to live at `/login`,
  moved as-is), and `loginAction`'s success path now redirects straight
  to the role-appropriate dashboard (`/admin/businesses` or
  `/dashboard`) instead of back to the login page requiring a manual
  click. Every hardcoded `/login` redirect target (`proxy.ts`,
  `lib/auth/dal.ts`, `features/auth/actions.ts`) was updated to `/`
  accordingly — any future code adding a new auth-guarded page must
  redirect unauthenticated visitors to `/`, not `/login`.

- `cards.businessId` has no `onDelete` behavior set (defaults to
  Postgres's restrict/`NO ACTION`) — a business can never actually be
  deleted while it still has any cards. This predates V5, but V5 added
  `branches.businessId ON DELETE CASCADE`, which is currently
  unreachable in practice for the same reason (the `cards.businessId`
  restrict would block the delete before a branch cascade could ever
  fire). If a delete-business feature is ever built, these two FK
  behaviors need to be reconciled together, not just the branches one.
- Any function taking a raw `id`/`businessId`/`branchId` string
  destined for a `uuid` column must format-validate it first (the
  `UUID_PATTERN` regex pattern, already used in both
  `analytics/api.ts` and `business-management/api.ts`) — a malformed
  value passed straight into a query throws Postgres's raw
  `invalid input syntax for type uuid` error (SQLSTATE `22P02`), which
  `isPgError()` doesn't recognize (it only checks `23505`/`23503`), so
  it propagates uncaught instead of becoming a clean, user-facing
  error. Hit and fixed once in `createCard()`'s branch-ownership check
  (5a) — check for it in any new function taking an id from outside
  input, especially once forms (5c) start passing user-facing values
  through.
- `branches` has no unique constraint on `(businessId, name)` —
  deliberate, not an oversight. Duplicate branch names under the same
  business are allowed; nothing in the product requires uniqueness
  there the way `users.email` or `businesses.ownerId` do. Because of
  this, anywhere a branch is shown to an admin (the card-creation
  branch `<select>`, the branch list, the per-card branch annotation in
  `admin/businesses/page.tsx`) must label it with more than just the
  name — currently `name — googleReviewUrl` — or two same-named
  branches (e.g. two "Main Street" locations) become visually
  indistinguishable and an admin could attach a card to the wrong one
  with no visible error. Reviewer-caught in 5c.
- **Vercel Preview deployments use their own separate Neon database
  branch, not the shared production one** — discovered while verifying
  4c on Preview: a session created via login on a Preview URL never
  showed up when queried from local scripts (which use `.env.local`'s
  `DATABASE_URL`, pointing at production). Any future DB-inspecting/
  mutating script aimed at verifying a Preview deployment must run
  against Preview's own `DATABASE_URL`, not the local one — or, more
  simply, drive the test entirely through the deployed app's own
  routes (e.g. using its `logout` action to delete a session
  server-side) rather than reaching into the DB directly from outside.
  Also: Preview URLs are gated behind Vercel's own SSO by default —
  `curl` needs the `x-vercel-protection-bypass` header with a secret
  from Project Settings → Deployment Protection → "Protection Bypass
  for Automation" to reach them at all.
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
  silently rerouted to a misleading error instead of `/` (the login
  page). Hit and
  fixed once already in `createBusinessAction` (4c); confirmed correctly
  followed in 4d's `createBusinessAction` extension and the new
  `addBusinessOwnerAction`. Keep following it for any future mutation
  that reuses `requirePlatformAdmin()`/`verifySession()`/
  `requireOwnedBusiness()`.
- `businesses.owner_id` has a DB-level `UNIQUE` constraint (added in
  4d, after the reviewer caught that the documented one-owner-per-
  business invariant had no enforcement beyond app code) — Postgres
  unique constraints permit unlimited `NULL`s, so this doesn't restrict
  how many businesses can have no owner yet. `createBusinessOwner()`
  also has an app-level pre-check rejecting an attempt to add an owner
  to a business that already has one (a different, narrower protection
  than the DB constraint — the constraint stops one user owning two
  businesses; the pre-check stops a business's existing owner from
  being silently overwritten).
- Saffron (the one real business) still has no owner account as of V4's
  completion — a real owner account for it is a manual follow-up
  whenever the owner is ready to actually use `/dashboard`, via
  `/admin/businesses`'s "Add owner" form, not something to script.
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
- (Retired as of 4c — see below) `ADMIN_USERNAME`/`ADMIN_PASSWORD` and
  the Basic Auth gate they protected no longer exist anywhere in this
  project. Real accounts replaced them entirely.
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
  **Superseded 2026-08-17**: see the full-wipe entry below — this
  scan-event caveat no longer applies, `scan_events` is empty now.
- **2026-08-17: production database fully wiped at the owner's explicit
  request**, after confirming scope in two separate rounds (per the
  bulk-delete rule this prompted in `CLAUDE.md`). Deleted: the Saffron
  Middle Eastern Restaurant business (the original V1 seed data, plus
  its `saffron` plate — never actually printed/handed to a real
  business, confirmed safe to remove), the "01" test batch and all 21
  of its plates (recorded as QR capability, not the real 20-unit NFC
  order — that hadn't been entered yet), all 69 scan events, and all 18
  stale login sessions. Preserved: the platform_admin user
  (`gary_reyes@dlsu.edu.ph`) only. The database is a clean slate as of
  this date — anything referencing Saffron, batch "01," or pre-8/17 scan
  counts in earlier session history describes data that no longer
  exists.
- **The V7 decision to have the business partner share the owner's one
  admin login (see `ARCHITECTURE.md` § V7) was reversed on 2026-08-17.**
  `/admin/team` now lets any existing platform_admin create another one
  with their own separate credentials — motivated by shared-login
  drawbacks (can't tell who did what, can't revoke one person's access
  without changing the password for everyone). Still no self-service
  signup and no "forgot password" flow, matching the V4 baseline;
  account recovery stays a direct DB script.
- **`pdfkit` must stay in `next.config.ts`'s `serverExternalPackages`,
  not get bundled.** It resolves its built-in standard fonts (Helvetica
  etc.) from `.afm` files via a `__dirname`-relative path at runtime —
  Turbopack/webpack bundling rewrites that path and breaks font loading
  with an `ENOENT` for a path that never existed (hit this literally, on
  the first real request, while building the 2026-08-17 inventory
  exports). Any future library with the same "reads its own files
  relative to `__dirname` at runtime" pattern will likely need the same
  `serverExternalPackages` treatment, not a code-level fix.
- **QR-capability physical-provisioning problem (discovered
  2026-08-18) — resolved in software, still needs supplier
  confirmation before the next order.** The physical acrylic plates
  come from the Alibaba manufacturer with the QR code already
  printed/etched in at the factory — a paper sticker on top would ruin
  the finish, so the code has to be decided and handed to the supplier
  *before* they print. `npm run qr:generate-order -- <count>` (run
  before ordering) generates the slug/URL list to send the supplier;
  `recordInventoryArrival()` now accepts that same pre-made slug list
  (via `/admin/inventory`'s "Pre-made slugs" field) instead of always
  generating random ones, so the plates created on arrival match
  exactly what's already printed. **Still unconfirmed**: whether the
  actual supplier will agree to print a QR code we provide per unit,
  rather than their own random one — don't place a QR/combo order until
  that's confirmed. NFC is unaffected either way (chips are rewritable
  after manufacture, which is why the current 20-unit order is
  all-NFC). See `onboarding.md`'s QR section for the full sequence.
- **"Add a business" no longer auto-creates a plate (2026-08-18).**
  Originally, filling in a Slug field on that form immediately created
  one untracked, ad-hoc plate alongside the business — a leftover from
  before batch/inventory tracking existed. Removed once real usage
  showed it was pure clutter at real scale (an orphan plate on every
  single business, forever, on the Plates page). The standalone "Add
  plate" form still on each business's own card is unaffected — still
  the intentional path for a genuinely one-off untracked plate.
- **`/admin/plates`'s "Assign one to business" can target a specific
  slug now (2026-08-18), not just an arbitrary pick from the group.**
  Added specifically for pre-printed QR stock: once the physical unit
  in hand already has a fixed code on it, "any unassigned plate in this
  group" isn't good enough — the wrong slug ending up on the wrong
  physical card would mean a QR that redirects nowhere useful. Optional
  and irrelevant for NFC, where any unassigned chip still works the
  same as before.
