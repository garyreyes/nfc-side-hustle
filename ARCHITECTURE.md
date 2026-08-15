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
  middleware.ts                    # NEW — Basic Auth gate for /admin/*
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

## Roadmap context

This is Version 2 of 5 from the project roadmap:
1. V1 — one business, one QR code, redirect + log ✅
2. **V2 (this doc)** — multiple businesses, routing (already works),
   admin CRUD (Create + Read)
3. V3 — dashboard, analytics
4. V4 — accounts, auth, roles
5. V5 — multi-branch hierarchy

The entity/folder choices from V1 were made specifically so V2–V5
extend this structure rather than requiring a rebuild — V2 is the first
proof of that: no schema change, no folder restructure, purely
additive.
