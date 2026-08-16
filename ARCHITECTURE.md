# NFC/QR Review-Tracking System — V1 Architecture

## What this app does

The smallest working version of the product: a business has a QR code
(NFC card support added later, same mechanism) pointing at a unique URL.
Scanning it logs the scan and redirects the customer straight to the
business's Google review page.

```
Customer scans QR
      ↓
GET /r/[slug]
      ↓
Look up Card by slug → find its Business
      ↓
Write a ScanEvent (timestamp)
      ↓
302 redirect → Business's Google review URL
```

No dashboard, no accounts, no multi-business UI yet — those are V2/V3/V4
in the roadmap. V1 exists to prove this loop works end-to-end with a real
QR code and a real phone.

## Entities & relationships

```
Business (id, name, google_review_url)
Card     (id, business_id, slug, type: "qr" | "nfc")
ScanEvent(id, card_id, scanned_at)

Business 1---* Card
Card     1---* ScanEvent
```

- **Business** and **Card** are modeled separately from day one — even
  though V1 has exactly one of each — so adding a second business or a
  second card (including an NFC card once one is in hand) later is just
  inserting a row, never a schema change.
- **Card.type** is informational only (`"qr"` vs `"nfc"`). It doesn't
  change any behavior today, but keeps scan source distinguishable for
  future analytics (V3).
- **ScanEvent** is intentionally minimal — just `card_id` and
  `scanned_at`. Richer fields (user-agent, referrer, etc.) can be added
  later without breaking anything that reads it today.

## Data entry (no admin UI in V1)

There's no login and no admin form yet — auth/accounts is V4 in the
roadmap. Since V1 is exactly one Business and one Card, that single row
pair is inserted with a one-time seed script (`scripts/seed.ts`) rather
than building a whole (and, since unauthenticated, publicly reachable)
admin UI to save one manual edit. Revisit this once V2 needs multiple
businesses.

## Stack & hosting

- **Framework**: Next.js, deployed on **Vercel**
- **Database**: **Neon** (managed Postgres) — chosen over Supabase since
  free-tier Supabase capacity is already used by other projects. Neon's
  free tier doesn't expire, scales to zero when idle, and has a native
  Vercel integration that wires `DATABASE_URL` automatically.
- **Query layer**: **Drizzle ORM** — typed, but still SQL-shaped and
  transparent about the SQL it runs, which fits the goal of actually
  learning SQL rather than having it hidden behind heavy codegen (as
  Prisma would).

**Why this scales to V2–V5 without migrating:** adding businesses,
branches, or a dashboard is just more rows and more tables in the same
Postgres database — never a provider switch. The only time a database
migration would become a real conversation is at a scale far beyond
local DLSU-area businesses (thousands of businesses, heavy concurrent
traffic), and even then the fix is normally upgrading Neon's paid tier,
not switching engines.

## Security baseline (V1)

- `DATABASE_URL` (Neon connection string) lives only in Vercel
  server-side env vars — never shipped to the browser/frontend bundle.
- The redirect route validates `slug` against real `Card` rows before
  writing a `ScanEvent` — no blind writes on arbitrary input.
- No public write-endpoint exists in V1 (no admin form), so there's no
  unauthenticated mutation surface to defend beyond the redirect route
  itself.
- Revisit this checklist when V4 (accounts/auth) is designed — that's
  where a real auth/authorization model gets introduced.

## Folder structure

```
src/
  app/
    r/
      [slug]/
        route.ts       # GET handler: look up Card by slug, log ScanEvent, redirect to Business's review URL
  features/
    scan-tracking/
      api.ts            # getCardBySlug(), logScanEvent() — logic behind the route
  lib/
    db/
      client.ts         # Neon connection
      schema.ts         # Business, Card, ScanEvent table definitions (Drizzle) — single source of truth for the data model
  shared/
    types.ts             # Business, Card, ScanEvent TS types, derived from schema.ts — shared since V2/V3 features will need them too
scripts/
  seed.ts                 # one-time insert of the single Business + Card row
```

**Rule of thumb for where new code goes:**
- New feature (V2 business CRUD, V3 dashboard, etc.) → new folder under
  `features/`
- Entity/table definition changes → `lib/db/schema.ts` only, never
  duplicated elsewhere
- Code used by 2+ features → `shared/`
- Infrastructure (DB client, future external API clients, auth config
  once V4 arrives) → `lib/`

## V2 Architecture — Multiple Businesses, Admin CRUD

V2's routing already works with zero code changes — `GET /r/[slug]`
looks up the card by slug from the database, so it already supports any
number of businesses. The actual gap V2 closes is **data entry**:
`scripts/seed.ts` only makes sense for exactly one business.

**No new entities or schema changes.** `Business`, `Card`, `ScanEvent`
already model this correctly — V2 is purely a new way to create rows in
tables that already exist.

**Scope: Create + Read only.** Update and Delete are deliberately left
out of V2. Per the existing "irreversible/high-blast-radius" rule below,
deleting or meaningfully changing a live business's data (especially
its `slug`) can break a card that's already printed and handed to a
real business — that deserves its own careful design pass later, not a
rushed addition here.

**Interface: a real internal admin section**, not a CLI script (the V1
pattern) and not Neon's dashboard directly — chosen specifically because
the roadmap's stated learning goal for V2 is "APIs, CRUD," and because a
non-technical co-founder should eventually be able to use this without
needing terminal access. This means a real, reachable write-endpoint
exists for the first time — which is exactly what the flat rule below
was written to gate.

**Protection: HTTP Basic Auth via Next.js middleware.** A single shared
username/password (env vars `ADMIN_USERNAME` / `ADMIN_PASSWORD`, never
in code or git) gates every route under `/admin/*`. This is not a full
accounts system (no per-user identity, no audit trail of who did what)
— that's still V4's job. It's a deliberate, explicit access decision,
which is what the existing rule requires; it is not "no protection."

Security baseline additions for V2:
- `/admin/*` fails **closed**: if `ADMIN_USERNAME`/`ADMIN_PASSWORD` are
  ever missing at runtime, middleware must deny all access, never fall
  through to open.
- Basic Auth credentials are checked server-side in middleware on every
  request — never trusted from a client-supplied cookie or header claim.
- The Create form's server-side handler validates input the same way
  the V1 redirect route does — slug format checked, no blind inserts on
  unvalidated input.

Folder structure additions for V2:
```
src/
  proxy.ts                         # NEW — Basic Auth gate for /admin/* (Next.js 16 renamed middleware.ts → proxy.ts)
  app/
    admin/
      businesses/
        page.tsx                  # NEW — list businesses (Read) + form to add one (Create)
  features/
    business-management/          # NEW feature folder
      api.ts                      # createBusiness(), createCard(), listBusinesses()
```
Everything under V1's structure (`app/r/[slug]`, `features/
scan-tracking`, `lib/db`) is unchanged.

## V3 Architecture — Dashboard, Analytics

V3 is a pure read-layer over data that already exists — **no new
entities, no schema changes.** `Business`, `Card`, `ScanEvent` already
have everything needed (`scanned_at` for time-series, `cards.type` for
the qr/nfc breakdown, `cards.business_id` for per-business grouping).

**Scope: full analytics**, chosen deliberately over a simpler
counts-only dashboard:
- A time-series chart (daily scan counts) per business, with a
  7/30/90-day range picker (defaults to 30)
- A per-card-type (`qr` vs `nfc`) breakdown per business
- An overview page listing every business with its total scan count,
  drilling into a per-business detail page for the chart + breakdown

**Test-data handling: cutoff date, not row filtering.** Roughly 56
`scan_events` rows from V1/V2 manual verification are mixed into
Saffron's real scan data with no way to distinguish them by inspection
(see `PROJECT_FACTS.md`). Rather than guess which historical rows are
real, every dashboard query filters `scanned_at >= DASHBOARD_DATA_START_AT`,
a constant set to V3's actual ship date. Everything before that date
(test or real) is excluded from all counts/charts; everything from that
point on is real by construction, since there's no reason to
hand-test the live Saffron QR again after this ships.

**Tech stack addition: Recharts** for the time-series chart — React-
native, lightweight, no separate backend. The chart component is a
Client Component (SVG interactivity needs the browser); data fetching
stays server-side, with a Server Component querying the DB and passing
plain data down as props — same split the rest of the app already uses.

**Security: reuses V2's Basic Auth gate unchanged.** `src/proxy.ts`'s
matcher is `/admin/:path*`, which already covers any new route under
`/admin/dashboard` with zero proxy changes. This is the lowest-risk
phase so far — pure reads, no new write endpoints, no new secrets.

Folder structure additions for V3:
```
src/
  app/
    admin/
      dashboard/
        page.tsx              # NEW — overview: every business + its total scan count
        [businessId]/
          page.tsx            # NEW — drill-down: time-series chart + qr/nfc breakdown for one business
  features/
    analytics/                 # NEW feature folder
      api.ts                   # getBusinessScanTotals(), getScanTimeSeries(businessId, range), getScanBreakdownByCardType(businessId, range)
      constants.ts              # DASHBOARD_DATA_START_AT
      components/
        ScanTimeSeriesChart.tsx # Recharts wrapper (Client Component)
```
The qr/nfc breakdown ended up as a plain HTML table inlined directly in
`app/admin/dashboard/[businessId]/page.tsx` rather than its own
component — a 2-category count table didn't warrant extraction, and it
matches the table convention already used elsewhere in `/admin/*`.
Everything under V1/V2 (`app/r/[slug]`, `features/scan-tracking`,
`features/business-management`, `lib/db`) is unchanged.

## V4 Architecture — Accounts, Auth, Roles

V4 replaces the shared HTTP Basic Auth password (V2) with real accounts.
**First real schema change since V1** — everything before this was
purely additive.

**Who gets accounts**, chosen deliberately over simpler options: both
the platform owner *and* individual business owners get their own
logins — not just one shared admin account. A business owner logging
in sees only their own dashboard, never the business list or other
businesses' data.

```
User      (id, email, passwordHash, role: "platform_admin" | "business_owner", createdAt)
Session   (id, userId, expiresAt, createdAt)
Business  (id, name, googleReviewUrl, ownerId -> User, nullable)   # NEW COLUMN
Card      (unchanged)
ScanEvent (unchanged)

User 1---* Session
User 1---1 Business   (via Business.ownerId — one owner per business, chosen
                        over a join table since no business needs multiple
                        logins today)
Business 1---* Card
Card 1---* ScanEvent
```

`Business.ownerId` is nullable — Saffron's existing row gets
`ownerId = NULL` until an owner account is created for it; no data
loss, no migration risk to existing rows.

**Auth mechanism**, per Next.js's own current guidance (not just prior
convention): database sessions, not stateless JWTs — matches the
self-rolled, revocable direction chosen over an auth library/provider.
`proxy.ts` performs only *optimistic* checks (read the cookie, redirect
to `/` — the login page — for UX) — it is explicitly **not** the
security boundary.
The real enforcement is a Data Access Layer (`lib/auth/dal.ts`,
`verifySession()`) called inside every Server Component, Server
Action, and query function that touches user-scoped data. This is a
meaningful shift from V1–V3, where `proxy.ts` alone was the entire
gate.

- Passwords: **`bcryptjs`**, not `bcrypt` — pure JS, zero native-binding
  build risk (the plain `bcrypt` package is a native addon; it usually
  builds fine on Vercel's Node.js serverless functions, but this
  project has been bitten by exactly this class of environment
  mismatch before — the Edge-runtime `timingSafeEqual` issue in 2a —
  so avoiding the risk entirely is worth the choice).
- No email service in V4: no self-serve signup, no "forgot password"
  email flow. The platform admin creates a business owner's account
  (with an initial password) when creating their business — same
  simplicity spirit as today's `admin123`. Recovery for the admin's own
  account, if locked out, is a direct DB script, matching the existing
  `scripts/seed.ts` pattern.
- Routing split: `/admin/*` stays platform-admin-only; a new top-level
  `/dashboard` is the business owner's own landing page — chosen over
  reusing `/admin/dashboard/[businessId]` with access control bolted
  on, so the URL itself never implies "admin" to someone who isn't one.

**Security baseline for V4** (supersedes V2's Basic Auth checklist
entirely — full checklist run via the `security-baseline` skill before
any V4 code; findings folded in below):
- Every user-scoped query requires a verified session; a
  `business_owner`'s analytics queries are scoped to their own
  `businessId` **inside the query function itself** (not just by the
  calling Server Component having checked first) — defense in depth,
  since Neon has no RLS-equivalent and the DAL is the *entire*
  enforcement boundary with no database-level backstop.
- `passwordHash` never leaves the server — Server Components/Actions
  return only the minimal session payload (userId, role).
- Session cookie: `httpOnly`, `secure`, `sameSite=lax`, ~7-day expiry
  (matches Next's own docs default). **Logout deletes the DB `Session`
  row**, not just the cookie — a stolen cookie must stop working the
  moment the real user logs out, not keep validating against a
  now-orphaned session record. Logout is a POST Server Action, never a
  GET link (a prefetched `<Link>` to a GET `/logout` would silently
  log users out via Next's own prefetching).
- Login error handling avoids the same class of timing leak 2a's
  review already caught once in this codebase (a `||` short-circuit
  that revealed which Basic Auth credential was wrong): always run a
  bcrypt compare against *some* hash — a dummy one when the email
  doesn't exist — and always return the same generic "Invalid email or
  password" message, so failed logins can't be used to enumerate valid
  business-owner emails.
- Login reuses the existing `lib/rate-limit.ts` (built for `/r/[slug]`
  in V1) rather than a new limiter — same known in-memory/per-instance
  limitation, already an accepted stopgap at this scale.
- `User.email` uniqueness relies on the DB unique constraint + catching
  Postgres's `23505` error (the established `isPgError` pattern from
  `business-management/api.ts`), not a select-then-insert check — same
  TOCTOU class of bug already fixed once in 2b.
- Failed login attempts are logged server-side (email attempted +
  timestamp, never the password) — matches the existing "log
  unexpected errors" convention from 2c.
- Baseline security headers (CSP, `X-Frame-Options`, `Referrer-Policy`)
  added via `next.config.ts` `headers()` — not previously needed when
  the app was just a redirect service, now directly protects the
  login page and session cookies.
- `/admin/*` requires `role = platform_admin`; `/dashboard` requires an
  authenticated user linked to a business — both enforced in the DAL;
  `proxy.ts` only provides the redirect-to-login UX shortcut.
- Server Actions (login/logout, matching every other mutation in this
  app) get Next 16's built-in CSRF protection automatically (Origin vs.
  Host header check) — confirmed via the bundled Next docs, not
  something to build separately.
- This is a full rewrite of the only access-control mechanism this app
  has ever had — the single biggest risk in this phase (a mistake
  could lock out the admin or leave admin data unprotected), which is
  why a dedicated `security-baseline` pass precedes any V4 code.

Folder structure additions for V4:
```
src/
  lib/
    auth/
      session.ts      # NEW — encrypt/decrypt, cookie set/delete, createSession()/deleteSession()
      dal.ts           # NEW — verifySession() (cached, DB-backed) — the real enforcement point
      passwords.ts     # NEW — bcryptjs hash/verify
  features/
    auth/               # NEW feature
      api.ts            # login credential check, user lookup
      actions.ts        # loginAction, logoutAction (Server Actions)
  app/
    login/
      page.tsx          # NEW — public login form
    dashboard/
      page.tsx          # NEW — business owner's own single-business view
    admin/                # unchanged paths, now gated via DAL instead of Basic Auth
  proxy.ts                # REWRITTEN — optimistic cookie check + redirect, not the security boundary
```
`business-management/api.ts` and `analytics/api.ts` both gain a
`verifySession()` call; `analytics` additionally scopes
`business_owner` results to their own business.

## V5 Architecture — Multi-Branch Locations

V5 supports a business having multiple physical locations (a "Branch"),
each with its own Google review URL and its own scan tracking — because
a real multi-location business typically has a *separate* Google
Business listing per physical location, not one shared review page.

**Purely additive — no migration of existing data.** Every prior
version's assumption (a card belongs directly to a business, a
business has one review URL) keeps working unchanged:

```
Business (id, name, googleReviewUrl, ownerId -> User, nullable)   [unchanged]
Branch   (id, businessId -> Business, name, googleReviewUrl)       [NEW]
Card     (id, businessId -> Business, branchId -> Branch, nullable, slug, type)  [+branchId]
ScanEvent(id, cardId, scannedAt)                                    [unchanged]

Business 1---* Branch
Business 1---* Card        (unchanged — a card without a branch behaves exactly as before)
Branch   1---* Card         (a card can optionally belong to a specific branch)
Card     1---* ScanEvent
```

**Scope, deliberately kept smaller than the alternative considered:**
Branch was scoped as *optional and additive* rather than mandatory for
every business — a simple single-location business (Saffron today)
never needs a Branch row at all, and nothing about its existing data or
code paths changes. The alternative (every business always has ≥1
Branch, Business becomes a pure container) was considered and rejected
specifically to avoid migrating Saffron's existing card and touching
every code path that currently reads `Business.googleReviewUrl`
directly, for a capability nothing currently needs.

**Redirect resolution**: `GET /r/[slug]` now resolves
`card.branch?.googleReviewUrl ?? business.googleReviewUrl` — a card
with no branch redirects exactly as it always has.

**Dashboard**: the per-business detail page (`BusinessAnalyticsView`,
shared by both the admin view and a business owner's `/dashboard`)
gains a per-branch scan breakdown, shown only for businesses that
actually have branches — this is the actual payoff of modeling
branches at all, letting an owner compare locations.

**Permissions: platform_admin only, no new capability for
business_owner.** V4 established business_owner as strictly read-only
(they can view their own dashboard but never create or edit anything).
Branch creation/management stays exclusively platform_admin, matching
how business/card creation already works — a business owner does not
get self-service branch creation in V5. Branch creation validates that
a card's `branchId`, if given, actually belongs to the target
business (defense in depth against an admin typo attaching a card to
the wrong business's branch).

Folder structure additions for V5 — purely additive, no new feature
folder (Branch is the same entity family as Business/Card):
```
src/
  lib/db/schema.ts                          # + branches table, cards.branchId (nullable FK)
  features/
    business-management/
      api.ts                                # + createBranch(), createCard() accepts optional branchId
      actions.ts                            # + createBranchAction, card form gains branch selector
    analytics/
      api.ts                                # + per-branch scan breakdown query
      components/BusinessAnalyticsView.tsx   # + branch breakdown section (only rendered if branches exist)
  app/
    r/[slug]/route.ts                       # branch-aware redirect resolution
    admin/businesses/page.tsx               # manage branches per business
```

## Roadmap context

This is Version 5 of 5 from the project roadmap:
1. V1 — one business, one QR code, redirect + log ✅
2. V2 — multiple businesses, routing (already works), admin CRUD
   (Create + Read) ✅
3. V3 — dashboard, analytics (full: time-series + per-card breakdown) ✅
4. V4 — real accounts (platform admin + business owners), database
   sessions, DAL-enforced authorization, replaces V2's Basic Auth
   entirely ✅
5. **V5 (this doc)** — optional per-branch locations, each with its own
   review URL and scan tracking, rolling up into the existing
   per-business dashboard

The entity/folder choices from V1 were made specifically so V2–V5
extend this structure rather than requiring a rebuild — V5 continues
that: no migration, no folder restructure, purely additive.
