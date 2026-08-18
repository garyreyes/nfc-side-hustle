# Changes

## Unreleased

### 2026-08-18 — Group assigned plates by business and branch on /admin/plates
Previously every assigned (active/suspended) plate was its own flat
card, in no particular order — hard to scan once a business had more
than one plate. `/admin/plates` now groups them into Business →
Branch → Plate: one collapsible section per business, with a "No
branch" sub-group first and any branches with plates listed after,
alphabetically. A branch with zero plates doesn't get an empty
section. The redundant "Business" label on each plate card was removed
since the group heading already says it.

Verified against a real multi-branch scenario (9/9 checks): a plate
with no branch lands under "No branch," two plates sharing a branch
both land under that branch's heading, an unused branch gets no
section, and "No branch" sorts before named branches.

### 2026-08-18 — Undo a sale, or delete a plate entirely
`/admin/plates` gained two new actions on every assigned (active or
suspended) plate, for correcting a mistaken sale: **Undo sale** clears
the business/branch/sale price and returns the plate to unassigned
inventory, so the same physical unit can be reassigned and resold —
the slug itself is untouched. **Delete plate** permanently removes the
row and its scan history, for a plate that shouldn't exist at all; the
slug can never be reused afterward. Delete is the one destructive,
irreversible action in this admin UI, so it's the only button with a
confirm prompt (everything else here stays deliberately single-click).

Verified against real production data (9/9 checks): undoing a sale
clears business/branch/price/date and makes the plate genuinely
reusable (resold the same slug successfully); undoing an
already-unassigned plate is rejected, not silently accepted; deleting a
plate that has scan history actually removes both the plate and its
scan events (the FK would otherwise block the delete).

### 2026-08-18 — Quick sales without a review link yet, and editable business details
Two related gaps found while selling in the field: a walk-in sale
sometimes happens before you have the business's real Google review
link in hand, and there was previously no way to fix a business's name
or URL after creation, or to jot down anything about who you actually
talked to.

**Quick sale**: `businesses.googleReviewUrl` is now optional. "Add a
business" only requires a name — assign and sell a plate right away,
and the plate honestly tells whoever scans it "this business hasn't
finished setting up their review link yet" (a normal 200, not an error)
until the real URL is added. `plates.businessId` was already nullable
from V6, but this reuses the simpler path: a real Business row always
exists, it just starts incomplete instead of blocking the sale.

**Edit business**: every business card on `/admin/businesses` now has a
"Details" form to update name, review URL, and three new optional,
reference-only fields — contact name, contact email, and free-text
notes (e.g. "the owner who gave us coffee, bald") — unrelated to the
existing Owner login. Notes/contact name show as a short preview right
in the collapsed card header so they're useful while scanning search
results, not just after opening a card.

Verified against real production data (11/11 checks): a business
created with no URL redirects its plate to the friendly "not set up
yet" message instead of a 500; editing in a real URL immediately makes
the same plate redirect correctly; invalid contact emails are rejected
on both create and edit. Migration `0008_small_madrox.sql` (drops
`NOT NULL` on `google_review_url`, adds `contact_name`/`contact_email`/
`notes`) applied to production.

### 2026-08-18 — Choose a specific slug when assigning; remove the auto-plate from "Add a business"
Two fixes found while field-testing the pre-printed-QR flow for real.

**Assigning a specific slug**: `/admin/plates`'s "Assign one to
business" gained an optional slug field. Previously it always picked an
arbitrary plate out of the group — fine for NFC, where the physical
chip is interchangeable until written to, but wrong for pre-printed QR,
where the code is already fixed on the unit in hand. Leaving the field
blank keeps the old random-pick behavior exactly as before; filling it
in assigns that exact plate and fails cleanly (not a silent fallback to
a different slug) if it's already taken or not in this group.

**No more auto-plate on "Add a business"**: that form used to
immediately create one untracked, ad-hoc plate using a typed slug — a
leftover from before batch/inventory tracking existed. Real usage
showed this is just clutter once you have more than a few businesses
(one orphan "No batch" plate per business, forever). Removed; a
business now starts with zero plates, matching how every real plate
actually gets created today (Record Inventory Arrival + Assign). The
standalone "Add plate" form on each business's own card is unaffected.

Verified against real production data (5/5 checks): assigning a
specific slug picks exactly that plate; re-assigning an already-taken
slug is rejected; assigning a nonexistent slug is rejected; omitting
the slug still does an ordinary random pick; `createBusinessAction`
now creates zero plates for a new business.

### 2026-08-18 — Pre-printed QR support: order slugs before manufacturing, not after
Closes the QR-provisioning gap flagged in the previous entry.
`recordInventoryArrival()` now accepts an optional pre-made `slugs`
list — when given, those exact slugs are used instead of generating
random ones, so a batch whose QR codes were already printed by the
supplier before arrival gets recorded with plates that match exactly
what's physically on the units. `/admin/inventory`'s arrival form
gained a **Pre-made slugs** field (one per line); quantity derives from
the list automatically rather than being typed and re-counted by hand.

New `npm run qr:generate-order -- <count>`, run *before* placing an
order — generates the slug list with zero database writes (nothing
exists yet), saving both the full URLs to hand the supplier and the
bare slugs to paste back in once the batch arrives.

Verified against real production data: pre-made slugs are used exactly
as given, mismatched quantity/slug-count is rejected, invalid slug
format is rejected, duplicates are rejected, and the ordinary
random-slug (NFC) path is unchanged — 5/5 checks passed. Also validated
the full sequence end-to-end with a mock QR image generated *before*
any database row existed, confirming that same image correctly
resolved to the right business once the plate was later recorded and
sold.

Still unconfirmed: whether the actual Alibaba supplier will print
custom per-unit QR content — this removes the software gap, not the
open business question. Don't place a QR/combo order until that's
settled with the supplier (see `PROJECT_FACTS.md`).

### 2026-08-18 — Fix QR codes missing the `?src=qr` channel marker; add onboarding.md, app.md, and a real README
`scripts/generate-qr.ts` was encoding the plain `/r/<slug>` URL into
every generated QR code, never the `?src=qr` marker the redirect route
reads to attribute a scan to the QR channel (see `src/app/r/[slug]/
route.ts`). Every real QR scan would have logged as "unknown" on the
"By channel" breakdown forever, silently defeating that whole feature.
Fixed — the script now encodes `?src=qr` while still verifying against
the plain URL (the redirect behavior doesn't depend on the marker).
Verified against a real temporary plate: ran the script for real,
confirmed the printed "Generated QR for..." line includes `?src=qr`.

Added two operating docs the project never had: `onboarding.md` (the
field playbook — creating a business, assigning a plate, and the full
physical QR-printing / NFC-writing steps, written for zero prior NFC
experience) and `app.md` (a feature-by-feature reference of every real
screen in the current app, for re-orienting later). Also wrote a real
`README.md` — previously just a bare title — opening with why this
project exists (practicing door-to-door sales, helping local businesses
actually use Google reviews) before the technical orientation.

### 2026-08-17 — Inventory exports: Excel workbook + PDF report
`/admin/inventory` gained two download buttons. "Export to Excel"
produces a 3-sheet `.xlsx` (Inventory Summary — the existing verified
numbers, just formatted; Batches — new `listBatchSummaries()`, grouped
by batch+capability so a capability-split batch reports correctly;
Items Sold — new `listSoldPlates()`, one row per plate ever sold,
suspended or not). "Download PDF report" produces a one-page summary
(totals, per-capability table, most-sold-by-capability ranking) via
`pdfkit`, chosen over a headless-browser renderer specifically to avoid
Puppeteer/Chromium's bundle-size and cold-start cost on Vercel
serverless.

Hit and fixed a real bundler issue: pdfkit loads its built-in standard
fonts from `.afm` files via a `__dirname`-relative path, which Turbopack
rewrites, breaking font loading with an `ENOENT` for a path that never
existed. Fixed via `serverExternalPackages: ["pdfkit"]` in
`next.config.ts`, keeping it unbundled so Node's real module resolution
applies.

Classified correctness-adjacent (new aggregation queries, though the
core money figures are the already-verified `getInventorySummary()`
untouched) and verified against real production data: downloaded both
files through the real gated routes with a known test batch in place,
confirmed the XLSX's batch/sold-item rows match hand-calculated expected
values exactly, and confirmed the PDF is a real, valid file (not just a
200 status) — 10/10 checks passed. Verification script and all test
data deleted afterward and confirmed absent.

### 2026-08-17 — Full production data wipe
At the owner's explicit request, after confirming exact scope twice
(what's in the DB, then a final go/no-go naming the specific
consequence): deleted the Saffron Middle Eastern Restaurant business and
its plates, the "01" test batch (21 plates, recorded QR when the real
order is NFC — never the real inventory), all 69 scan events, and all 18
stale sessions. Preserved only the platform_admin user. This prompted
the new bulk-delete confirmation rule added to `CLAUDE.md` in the prior
harness-setup audit — exercised for real here for the first time.

### 2026-08-17 — Admin team management (`/admin/team`)
Reverses the V7 decision that the business partner would share the
owner's one admin login — added a proper way to create additional
`platform_admin` accounts instead. New `features/team-management/`
(separate from `business-management/` since creating an admin has no
business association at all): `listPlatformAdmins()` and
`createPlatformAdmin()`, mirroring `createBusinessOwner()`'s shape
almost exactly (hash via the existing `lib/auth/passwords.ts`, insert
into `users` with a role, gated by `requirePlatformAdmin()` at both the
Server Action and api layers). `/admin/team`: a list of current admins
+ an "Add an admin" form. No new auth mechanism — reuses `lib/auth/`
entirely, per the hard-halt just added to `CLAUDE.md`. No self-service
signup, no email verification, no password-reset flow, matching the V4
baseline.

Classified as correctness-critical (grants the highest privilege level
in the app) and verified against real production data via a temporary
authenticated route: confirmed an unauthenticated request and a
`business_owner`-role session both get cleanly redirected without
creating anything, a real `platform_admin` session succeeds, and the
newly created admin can itself pass `requirePlatformAdmin()` — 5/5
checks passed. Verification route, script, and all test users/sessions
deleted afterward and confirmed absent.

### 2026-08-17 — Require a sale price to assign a plate
The "Assign one" form on `/admin/plates` no longer accepts a blank sale
price — `sellPrice` is now a `required` field client-side, and
`assignNextUnassignedPlateAction` rejects a blank submission server-side
with a clean error before calling into the database, closing the gap
that made 7b's revenue figures able to silently undercount a real sale
as untracked. `assignNextUnassignedPlate()`'s `sellPriceCents` parameter
is now required at the type level too, not just optional-with-a-runtime-
check, so a future caller forgetting to pass it is a compile error.

Also removed `assignPlateAction`/`assignPlateToBusiness` — the original
per-plate assign path, made unreachable when the previous change grouped
unassigned plates by batch (nothing in the UI has called it since; this
is dead-code cleanup, not a behavior change).

### 2026-08-17 — Grouped unassigned plates + business search/fold (scale pass)
Two scalability fixes to admin UI that was one-card-per-row with no way
to collapse or filter, ahead of the real 20-unit NFC batch (and future
100+-unit batches) landing.

`/admin/plates`: unassigned plates within one batch+capability are
interchangeable pre-sale (nobody picks *which* generic unit goes to a
business, only how many are left), so they're now collapsed into one
summary row per batch+capability group ("94 unassigned — Assign one")
instead of one card per physical unit. The group's "Assign one" form
picks an arbitrary still-unassigned plate atomically — added
`assignNextUnassignedPlate()`, using the same check-and-set discipline as
`assignPlateToBusiness()`: the `status = 'unassigned'` guard is repeated
in the UPDATE's own WHERE clause (not just the subquery that picks which
row), so two concurrent "Assign one" clicks against the same group can't
double-assign one physical unit — the loser gets a clean stockout error,
not a silent double-sell. Already-sold plates (meaningfully distinct by
which business owns them) keep their individual cards. Also added a
group-level "Fix capability for all N" bulk action
(`updateCapabilityForUnassignedGroup()`), replacing the per-plate
capability editor that grouping would otherwise have silently removed
for unassigned stock (e.g. correcting a batch recorded as QR when the
physical units are actually NFC).

`/admin/businesses`: added a name search (`?q=`, server-rendered GET
form, no client JS — same pattern as `/admin/plates`' `?status=` tabs)
and made each business card a native `<details>`/`<summary>` disclosure,
collapsed by default so a long business list stays scannable. A search
match auto-expands (since finding one implies wanting its detail), an
unfiltered browse stays collapsed.

Verified `assignNextUnassignedPlate()`'s concurrency-safety guarantee and
`updateCapabilityForUnassignedGroup()` against real production data via a
temporary authenticated route: assigned 3 plates out of a real 3-unit
test group one at a time, confirmed all 3 were distinct and a 4th attempt
against the same group failed cleanly with a stockout error rather than
reassigning an already-sold unit; confirmed a bulk capability fix flipped
exactly the targeted group. All temporary batches/plates/sessions and the
verification route deleted afterward and confirmed absent.

### 2026-08-17 — Sale price, revenue & profit tracking (7b)
Follow-up to 7a, closing the "no revenue/sale-price tracking" gap that
sub-phase deliberately left out. One new nullable column on `plates`:
`sellPriceCents`, set optionally alongside `assignPlateToBusiness()` —
the same "sold" event `assignedAt`/`unitCostCents` already key off, so a
sale gets priced (or not) at the same moment it's recorded, not through
a separate flow.

`/admin/plates`'s "Assign to business" form gained a "Sale price (₱)"
field. `/admin/inventory` gained a second table, "Sales & revenue": sold
count + revenue for today/this week/this month, revenue and cost of
goods sold all-time, and profit all-time (revenue minus cost of goods
sold — distinct from the first table's "Total cost," which includes
still-unsold stock). Profit shows as "—" rather than ₱0 whenever nothing
priced has sold yet, so "no data" can't be misread as "broke even." Also
added "Sold today" and "Revenue today" stat cards to the top of the page
— sold-today already existed in the per-capability table but had no
top-level total.

Correctness-critical (money math). Verified against real production data
via a temporary authenticated Route Handler: inserted four priced/costed
test plates across today/this-week/this-month/all-time buckets (one
deliberately left unpriced to confirm a null sale price is excluded from
revenue sums, not counted as ₱0) plus one unassigned unit, and checked
all 13 derived figures (sold counts, revenue, cost of goods sold, total
cost, ordered/remaining, and profit) against hand-calculated expected
values as an exact before/after delta — all 13 passed. Verification
route, script, and all test data deleted afterward and confirmed absent.

### 2026-08-17 — Internal inventory & cost tracking (7a) — V7 complete
First and only sub-phase of V7 (see `ARCHITECTURE.md` § V7 /
`ROADMAP.md` Phase 7) — owner-only procurement bookkeeping, never seen
by clients or business owners. Two new nullable columns on `plates`:
`assignedAt` (set by `assignPlateToBusiness()`, the only thing that now
records *when* a plate was sold — nothing before V7 did) and
`unitCostCents` (integer centavos, only set for plates created through
the new arrival flow).

New `/admin/inventory` page: a "Record inventory arrival" form (batch
name, capability, quantity, unit cost) that creates a real `batches` row
plus that many real `unassigned` plates — the moment a physical delivery
becomes trackable stock, even generic unserialized cards with nothing
printed yet. This is a deliberate workflow shift from "create a plate
row lazily when it sells" to "create it the moment it physically
arrives," which is what makes "how many remain" computable directly from
`plates` (`count(status = "unassigned")`) with no separate
ordered-quantity ledger needed. A per-capability (qr/nfc/combo)
breakdown table shows ordered (all-time), sold (today/week/month/all-
time, in Asia/Manila local time — no DST, so a fixed +08:00 offset is
correct), remaining, and total/average cost (only counting plates whose
cost was actually recorded).

Centralized slug-generation (`generateRandomSlug`/`generateUniqueSlugs`)
into `lib/slug.ts`, removing the duplicate copy in
`scripts/generate-batch.ts` — same precedent that already moved
`isValidSlug()` there after it was duplicated once before.

Classified as correctness-critical (money math + stock counts) and
verified accordingly — real data, no new test harness, same standing
approach as 6d/6e. Verified end-to-end against real production via a
temporary authenticated Route Handler: invalid quantity and negative
cost both rejected cleanly; a real 3-unit qr arrival created exactly 3
unassigned plates with the correct cost and no `assignedAt`; the summary
deltas matched exactly (+3 ordered, +₱4.50 total cost); a duplicate
batch name rejected; assigning one plate to a business set `assignedAt`
and correctly moved remaining/soldToday/soldAllTime by exactly one. All
temporary businesses/plates/batches/sessions and the verification route
deleted afterward and confirmed absent.

**V7 (internal inventory & cost tracking) is complete.**

### 2026-08-17 — Channel breakdown on dashboards (6e) — V6 complete
Fifth and last sub-phase of V6. Added `getScanBreakdownByInteractionType()`
to `features/analytics/api.ts` — same "derived from the schema enum,
zero-filled" pattern as the existing capability breakdown, but rooted at
`scan_events` (not `plates`), since interaction type is a property of
the individual scan, not the plate. Wired into the shared
`BusinessAnalyticsView` as a new "By channel" table, so both the admin
detail page and a business owner's own `/dashboard` get real qr-vs-nfc
data for free — the actual payoff of everything 6a-6d built (the
`?src=` marker, the redirect route reading it, the inventory model that
led to it).

Read-only, no schema change, no new write path — verified more lightly
than 6d's write actions accordingly: ran the same grouped-count query
logic directly against real production data (Saffron's real business)
and confirmed the per-channel counts summed to exactly the same total
as an independent unscoped count query (1 qr + 1 nfc + 6 unknown = 8,
matching).

**V6 (plate inventory & reseller model) is complete — 6a schema/rename,
6b real attribution + status-aware redirect, 6c hardened batch
generator, 6d admin inventory UI, 6e channel breakdown all shipped.**
The 20-unit real NFC pilot batch can now be provisioned end-to-end
through `/admin/plates` once it arrives.

### 2026-08-17 — Admin inventory UI (6d)
Fourth sub-phase of V6. New `/admin/plates` page: lists every plate with
status/capability/business/branch/batch, filterable by status
(All/Unassigned/Active/Suspended, with counts). Four new write actions
in `business-management/api.ts`, all `platform_admin`-only:
`assignPlateToBusiness()` (unassigned → active, atomic check-and-set via
the WHERE clause rather than select-then-update, so no transaction is
needed to avoid a TOCTOU race against a concurrent assignment),
`setPlateBranch()` (separate from assignment on purpose — a
dependent business→branch dropdown isn't possible in a plain
server-rendered form without client JS, so branch is its own follow-up
action, scoped to whichever business the plate already has, and doubles
as how an already-assigned plate's branch gets changed later),
`updatePlateCapability()`, and `setPlateStatus()` (active↔suspended
only, can't touch an unassigned plate — enforced the same atomic way).

Classified the assignment logic as correctness-critical during planning
(wrong business = a customer's scan lands on the wrong reviews) but
this project has no DB-mocking test harness and no precedent for one —
confirmed with the owner to verify against real data instead, matching
every prior correctness-critical piece in this codebase (the V4 auth
cutover, business/branch scoping, analytics authorization).

Verified end-to-end against real production data via a temporary
authenticated Route Handler (same technique as 5a — these functions
need a real request context for `requirePlatformAdmin()`, which a
standalone script can't provide), hit with a session cookie signed
directly using the app's own `SESSION_SECRET`/session-row logic rather
than going through the login form. Covered: assigning an unassigned
plate (status→active, businessId set); re-assigning an already-active
plate correctly rejected; setting a branch that belongs to a *different*
business correctly rejected (the same class of check 5a/5c already
established for `createPlate`/`createBranch`); setting and clearing a
valid branch; updating capability; suspending an unassigned plate
correctly rejected; suspend then reactivate both working. All 9 checks
passed on the first run. All temporary businesses/branches/plates/
sessions and the verification route itself deleted afterward and
confirmed absent via a direct query.

### 2026-08-17 — Bulk batch generator script, hardened (6c)
Third sub-phase of V6. `scripts/generate-batch.ts` existed as a
first-pass local-file-only generator from planning (before V6a's schema
existed) — hardened it into the real sub-phase deliverable:

- Count and capability mix are now CLI-configurable
  (`npm run batch:generate -- <name> [count] [qr|nfc|combo|even]`)
  instead of hardcoded to 30 units / an even 3-way split, so it can
  actually serve a real future order (an all-NFC batch, a QR-heavy
  batch, etc.), not just the one pilot shape it was built to illustrate.
- **Now creates real database rows**, not just local files: inserts a
  `batches` row and the generated plates as real `unassigned` rows tied
  to it, *before* writing any local QR/manifest/spec-sheet output — so a
  scan against a generated serial resolves as "not yet activated" (6b's
  real behavior) from the moment the script finishes, never a bare 404,
  even before the physical hardware exists. DB writes go directly
  through `db`/schema (same pattern as `scripts/seed.ts`/`create-admin.ts`),
  not through `business-management/api.ts`'s session-gated functions,
  since a standalone script has no request/session context to check
  against — matches this codebase's existing convention for admin-run
  CLI tools.
- Batch-name collisions are pre-checked with a clear error rather than
  silently duplicating or throwing a raw Postgres error. A failure
  between the batch insert and the plates insert (no transaction support
  — see `PROJECT_FACTS.md`) can leave an orphaned batch row with zero
  plates; accepted as the same low-volume, admin-only risk class already
  established for `createBusinessOwner()`'s two-write sequence, with a
  clear console message telling the admin to check and clean up manually
  before retrying.

Verified end-to-end against real production: generated a real 4-plate
throwaway batch (2 qr, 1 nfc, 1 combo), confirmed the manifest/QR files
matched the created rows, confirmed a generated serial resolved through
the live `/r/[slug]` route with the real "not yet activated" message
(200, not 404) — proving the script's output is immediately live
inventory, not just paperwork for a future migration. All test rows and
local files deleted afterward and confirmed absent.

### 2026-08-17 — Real qr/nfc attribution + unassigned/suspended redirect handling (6b)
Second sub-phase of V6. No schema change — 6a already shipped the
columns this reads/writes, so unlike 6a there was no migration/deploy
sequencing risk this round.

`GET /r/[slug]` now reads the `?src=qr` / `?src=nfc` marker (baked into
plates since the pilot batch generator) and logs the real
`interactionType` on every `ScanEvent`, instead of leaving every scan at
the `"unknown"` default forever. `getPlateBySlug` (renamed from
`getPlateWithBusinessBySlug`) now left-joins businesses/branches instead
of inner-joining, so an `unassigned` plate resolves distinctly from a
slug that doesn't exist at all — previously both looked identical (a
plain 404). The route now branches on plate status: `unassigned` shows
a "hasn't been activated yet" message, `suspended` shows a "temporarily
paused" message, `active` is unchanged (redirects as before). Every real
hit against an existing plate is still logged regardless of status —
useful telemetry even for a paused or not-yet-sold plate.

No reviewer findings — self-verified directly against the real dev
server, real production data, and the real deployed route this time
(learning applied from 6a: code was already fully committed, pushed,
CI-green, and merged before any production behavior depended on it, so
there was no outage window this round).

Verified end-to-end against real production: `/r/saffron?src=qr`,
`/r/saffron?src=nfc`, and a plain `/r/saffron` all still redirect
correctly, and a direct read of the three resulting `scan_events` rows
confirmed `interactionType` was logged as `"qr"`, `"nfc"`, and
`"unknown"` respectively, in that order. Also verified the two new
status branches directly against production using temporary test
plates: an `unassigned` plate returned the "hasn't been activated yet"
message (200), a `suspended` plate (tied to the real Saffron business)
returned the "temporarily paused" message (200) — both cleaned up
afterward and confirmed absent.

### 2026-08-17 — Card → Plate rename + inventory schema (6a)
First sub-phase of V6 (see `ARCHITECTURE.md` § V6 / `ROADMAP.md` Phase 6).
Renamed the `Card` entity to `Plate` throughout the schema, every
`features/` module, and the admin UI, to match the reseller model: plates
are now bulk-manufactured inventory that can exist before any business
owns them, not something provisioned only when a business signs up.

`schema.ts`: `cards` table → `plates`, `businessId` now nullable
(unassigned pre-sale inventory), `type` → `capability` (adds a third
`"combo"` value, now editable after creation — an NFC chip can fail in
the field), new `status` enum (`unassigned`/`active`/`suspended`,
manually admin-toggled, no billing system involved), new `batches` table,
new `scanEvents.interactionType` column (populated for real starting
6b). The underlying Postgres enum type name was deliberately left as
`card_type` even though the TS binding is `capabilityEnum` — renaming
that too would have added migration risk for a purely internal detail.
Migration (`drizzle/0005_v6_plate_inventory.sql`) was hand-written using
`RENAME` statements throughout (drizzle-kit's interactive rename
detection needs a TTY not available in this environment), so existing
production rows were preserved, not dropped and recreated.

**Caused a brief live outage**: the migration was run against production
before the matching code was deployed, so the currently-deployed (old)
code kept querying the now-renamed `cards` table and `/r/[slug]` 500'd
for a few minutes — a real customer scanning Saffron's QR code during
that window would have hit an error instead of the review redirect.
Fixed by immediately committing, pushing, and merging the already
locally-verified code (PR #29); CI passed, merge restored `/r/saffron`
to a clean 302 against production. See the new `PROJECT_FACTS.md` entry
— this sequencing mistake must not repeat on 6b–6e.

Verified: `typecheck`/`lint`/`test`/`build` all clean; production data
confirmed intact post-migration via a direct read-only query (Saffron's
real business/plate row survived with `capability: "qr"`,
`status: "active"`, `batchId: null`; all 59 historical `scan_events`
correctly backfilled to `interactionType: "unknown"`); live redirect
route confirmed restored post-merge.

### 2026-08-16 — First real UI/UX pass (via `/impeccable`)
Outside the versioned V1-V5 roadmap. Every screen (login, admin business
management, both admin dashboards, the business owner's own dashboard)
was plain, unstyled inline-HTML through the end of V5 — this was the
first actual design pass, run through `/impeccable init` → new-work →
finish review.

`/impeccable init` wrote `PRODUCT.md` (users, purpose, positioning,
constraints — confirmed this is a paid/soon-to-be-paid service, so the
UI needed to read as credible, not a hobby project). A real new-work
decision round then offered a genuine roll (an assigned "Palengke Price
Tag" world, a "Resibo Ledger" pick, a "Jet-Age Ticket Wallet"
challenger, and the plain category-standard "Fintech SaaS Dashboard" as
the standing exit) — the owner chose the standing exit, with **Oripio**
(a reference screenshot shared twice) as the craft bar. Recorded as a
durable brand commitment in `PRODUCT.md`.

Built: a design-token system in `globals.css` (one restrained green
accent, a 3-step ink/muted text scale, a spacing/radius/shadow scale,
self-hosted Hanken Grotesk), a shared `AppShell` sidebar+content layout
(collapses to a stacked top bar under 860px) plus a small shared
component set (`Card`, `StatCard`, `Badge`, `SubmitButton`) and shared
form/table stylesheets — all in the new `src/shared/ui/` — applied
across all five screens. No functional/data changes; purely visual.

Reviewer (`impeccable-finish-reviewer`) findings, all fixed and
re-verified: (1) `--color-ink-muted` failed WCAG contrast on white
(~3.1:1) — darkened to a value that passes (~4.8:1), fixing every table
header, URL, and chart axis label using it; (2) the platform admin's
actual post-login landing page (`/admin/businesses`) didn't match the
direction contract's promised "leads with stat cards" pattern — added a
Businesses/Total-scans stat-card row reusing the existing analytics
query; (3) no form submit button showed a pending/loading state — added
a shared `SubmitButton` (`useFormStatus`-based) used by every form in
the app. Detector (`detect.mjs`) ran clean on all changed files, both
before and after the fixes.

`DESIGN.md` (+ `.impeccable/design.json` sidecar) now records the built
system as ground truth for future UI work — read it before extending
any screen rather than re-deriving conventions from scratch.

Verified visually via headless-Chrome screenshots (desktop 1440px +
mobile 390px) against real production data, both before and after the
review fixes — including catching and fixing a genuine mobile-layout
defect the screenshots surfaced (the sidebar's nav row was truncating
"Dashboard" to "Dast" and cramping the logout button at narrow widths;
fixed by giving nav its own full-width row on mobile instead of sharing
one with the brand mark and logout button).

### 2026-08-16 — Login page moved to root; login now redirects straight to the dashboard
Outside the versioned V1-V5 roadmap (a fix, not a new phase). The
production root URL (`/`) had never been touched since `create-next-app`
scaffolded it — it still showed the default Next.js starter page, even
though a real, working login page already existed at `/login`. Moved
that page's logic to `/` as-is and deleted `/login` entirely (plus the
now-orphaned `page.module.css`); updated every hardcoded `/login`
redirect target (`proxy.ts`, `lib/auth/dal.ts`,
`features/auth/actions.ts`) to `/`.

Also fixed the login flow itself: a successful login used to redirect
back to the login page, which then showed a "logged in as X, click here
to go to your dashboard" link the user had to click manually. It now
redirects straight to the role-appropriate dashboard
(`/admin/businesses` for platform_admin, `/dashboard` for
business_owner) — no extra click.

Reviewer sub-agent found no code bugs (no redirect loop, rate limiting
untouched, `force-dynamic` still correctly justified); it did catch two
stale `/login` references left behind in `ARCHITECTURE.md` and
`PROJECT_FACTS.md`'s current-state documentation — both fixed.

Verified end-to-end against real production data: unauthenticated
visits to `/admin/businesses` and `/dashboard` both redirect to `/`;
old `/login` now 404s; logging in as the real platform_admin account
redirects straight to `/admin/businesses` (confirmed via the `Location`
header); the "already logged in" branch and logout both work, with
logout confirmed to actually clear the session. Business_owner redirect
verified via a temporary throwaway test business + owner account
(logged in, confirmed redirect to `/dashboard` and correct rendering,
then fully deleted and confirmed absent afterward — no real account was
touched; Saffron still has no owner, unchanged).

### 2026-08-16 — Per-branch dashboard breakdown (5d) — V5 complete, V1-V5 roadmap complete
Last sub-phase of V5. Both the admin's per-business dashboard
(`/admin/dashboard/[businessId]`) and a business owner's own
`/dashboard` now show a "By branch" table — new `getBranchScanBreakdown()`
in `analytics/api.ts`, wired into the shared `BusinessAnalyticsView`
component so both routes get it identically for free. Rendered only
when the business actually has branches; disappears entirely for a
branch-less business (verified both directions: appeared correctly
with a temporary branch, disappeared again once it was deleted).

Query is deliberately rooted at `branches`, not `cards`, so a branch
with no card yet still shows a 0 total rather than silently vanishing
(same completeness reasoning already used for card-type breakdown). A
second, separate query buckets cards with no branch at all into an
explicit "No branch" row, since those can't be reached by rooting at
`branches` — the two queries are provably non-overlapping since
`cards.branchId` is a single nullable FK, confirmed by the reviewer
sub-agent along with authorization correctness (reuses the same
`businessExists`/`sessionCanAccessBusiness` guard as its sibling
queries — no gap letting a business_owner see another business's
branch data) and consistent `startAt` cutoff handling between both
queries. No real findings from the review.

Verified end-to-end against real production data: created a real
branch, a real card attached to it, generated 3 real scans via the
actual redirect route, confirmed the dashboard showed the branch's
correct total plus a correct "No branch" total (using one intentional
extra scan on the real Saffron card — left in place afterward, same
established precedent as 1c/2c's test-scan residue, rather than risk
deleting real traffic). All temporary branch/card/scan-event test data
cleaned up and confirmed absent afterward.

**V5 (multi-branch locations) is complete — 5a schema, 5b
branch-aware redirect, 5c admin branch management, 5d per-branch
dashboard breakdown all shipped.** This closes out the full V1-V5
roadmap.

### 2026-08-16 — Admin UI for managing branches (5c)
Third sub-phase of V5. `/admin/businesses` now lets a platform admin
create and view branches per business, and gained a standalone
"add card" form — previously a card could only be created bundled with
a brand-new business, so there was no way to add a second card (e.g.
for a second branch) to a business that already existed. The new card
form includes an optional branch selector.

`listBusinesses()` in `business-management/api.ts` extended to also
return each business's branches and each card's `branchId` (a second,
separate query merged in JS — this driver has no transactions).
`createBranchAction`/`createCardAction` added to `actions.ts`, following
the same bound-Server-Action, `requirePlatformAdmin()`-first pattern as
the existing `addBusinessOwnerAction`.

Reviewer sub-agent's finding, fixed: branch names aren't required to be
unique within a business (deliberate, see `PROJECT_FACTS.md`) — the new
branch `<select>` and branch/card listings originally showed only the
branch name, so two same-named branches would be visually
indistinguishable and an admin could attach a card to the wrong one.
Fixed by labeling every branch display with `name — googleReviewUrl`,
re-verified with two intentionally same-named test branches.

Also found and cleaned up during this pass, unrelated to 5c itself: two
stray `_Verify Tmp Branch` rows in production, leftover residue from an
earlier, incompletely-cleaned verification pass — confirmed with the
owner before deleting.

Verified end-to-end via the real rendered admin UI (not a temporary
Route Handler this time — logged in through the real `/login` form with
the real platform_admin credentials, then drove the actual bound Server
Actions via curl): created a real branch, created a card attached to it
and a card with no branch, confirmed both listed correctly with the
right branch annotation, confirmed both redirect correctly (tying 5b
and 5c together end-to-end). All test data cleaned up and confirmed
absent afterward.

### 2026-08-16 — Branch-aware redirect (5b)
Second sub-phase of V5 — the actual customer-facing payoff. `GET
/r/[slug]` now resolves `branch.googleReviewUrl ?? business.googleReviewUrl`
instead of always using the business's URL. `getCardWithBusinessBySlug()`
in `scan-tracking/api.ts` gained a LEFT JOIN to `branches` (left, not
inner, since `cards.branchId` is nullable) and now resolves the fallback
internally, so it still returns the exact same `{ cardId, googleReviewUrl }`
shape as before — `route.ts` itself needed zero changes.

Verified against real production data: a temporary branch-linked card
redirected to the branch's own URL, a temporary branch-less card
redirected to the business's URL exactly as it always has (Saffron's
real card, unaffected). No auth-bypassing Route Handler needed this time
— the redirect route is public by design — verified directly via curl
against the real dev server. All test data (including the scan events
the verification itself generated) cleaned up and confirmed absent
afterward.

Reviewer sub-agent found no real bugs; confirmed both the LEFT JOIN/`??`
fallback logic and the unchanged `route.ts` URL-validation path (a bad
branch URL gets the same friendly 500 a bad business URL always has).

### 2026-08-16 — Schema + branch/card creation logic (5a)
First sub-phase of V5. Added a new `branches` table (id, businessId,
name, googleReviewUrl) and a nullable `cards.branchId` — purely
additive, no migration of existing data, Saffron's data untouched.
`createBranch()` added to `business-management/api.ts`; `createCard()`
extended to accept an optional `branchId`, validated to actually belong
to the target business before the card is created (defense in depth
against an admin typo/tampered form attaching a card to another
business's branch). `branches.businessId` cascades on business delete
(a branch has no meaning without its business); `cards.branchId` sets
to null on branch delete (a printed, handed-out card must keep working
via fallback to the business-level URL, not break). No UI, no
redirect-route changes yet — that's 5b/5c.

Reviewer sub-agent's finding, fixed: a malformed (non-UUID) `branchId`
would have thrown a raw, uncaught Postgres error instead of a clean
`BusinessManagementError` — added the same UUID-format pre-check
pattern already used in `analytics/api.ts`, verified directly.

Verified end-to-end against the real dev server and real production
database, via a temporary authenticated Route Handler (these functions
require a real session through `requirePlatformAdmin()`, which needs a
real request context — a standalone script can't call `cookies()`,
confirmed the hard way on the first attempt): created a branch under
Saffron; created a card with that branch (`branchId` set correctly)
and a card without one (`branchId` correctly `null`, unchanged
behavior); confirmed attaching a card to another business's branch is
correctly rejected; confirmed a malformed `branchId` is rejected
cleanly after the fix; confirmed an unauthenticated request is blocked
entirely. All test data cleaned up and confirmed absent afterward.

### 2026-08-16 — Business owner accounts + scoped /dashboard (4d) — V4 complete
The last piece of V4: business owners get their own login showing just
their own business's data, nothing else. Added `lib/auth/dal.ts`'s
`requireOwnedBusiness()` (resolves a business_owner's own business from
their session, never trusts an external businessId) and
`sessionCanAccessBusiness()` (defense-in-depth check added to
`analytics/api.ts`'s `getScanTimeSeries()`/`getScanBreakdownByCardType()`
— platform_admin sees any business, business_owner only their own,
"doesn't exist" and "not yours" are deliberately indistinguishable from
outside). `getBusinessScanTotals()` now also requires platform_admin
(previously had no check at all). Extracted the shared
`BusinessAnalyticsView` component (chart + range picker + breakdown
table) so the admin detail page and the new `app/dashboard` render
identically without duplicating the markup. `business-management/api.ts`
gained `createBusinessOwner()`, used both when creating a new business
(optional owner fields) and to retrofit an owner onto an existing one
(`admin/businesses` shows "Owner: email" or an inline add-owner form).
`proxy.ts`'s matcher extended to cover `/dashboard`.

Reviewer sub-agent's findings, all fixed: `createBusinessOwner()` had no
guard against silently reassigning a business that already has an
owner (a stale second browser tab could overwrite it with no error,
orphaning the first owner's account) — fixed with a pre-check that
rejects with a clear error, verified directly by reproducing the exact
stale-tab scenario against production and confirming no overwrite and
no orphan account. Also added a DB-level unique constraint on
`businesses.owner_id` (a real migration, confirmed before running) so
the documented one-owner-per-business invariant is enforced by
Postgres, not just app code — Postgres unique constraints permit any
number of `NULL`s, so this doesn't block businesses without an owner
yet. Also fixed: the business-linking update didn't check whether it
actually affected a row; and `/login`'s "already logged in" view had no
link forward to `/admin/businesses` or `/dashboard` depending on role —
a freshly-onboarded business owner would have had no way to find their
own page.

Verified extensively against the real dev server and real production
database, cleaning up all test data afterward: an admin adding an owner
to a business that had none; that owner's `/dashboard` correctly
showing only their own business's real data; that same session
correctly blocked (307) from all `/admin/*` routes, including the
admin-only detail page for their own business; the deepest test —
directly probing the scoped query functions while authenticated as the
owner, confirming their own business returns data, an unrelated
business returns `null`, and the same unrelated business returns data
when requested as platform_admin instead; and the stale-tab
double-owner scenario correctly rejected after the fix.

### 2026-08-16 — Cutover: retire Basic Auth, gate /admin/* via sessions (4c)
The highest-risk change in the project so far: `src/proxy.ts` no longer
does Basic Auth at all — rewritten to an optimistic-only check (reads
the session cookie, redirects to `/login` for UX) per Next's own
current auth guidance, since Proxy is explicitly not meant to be the
real security boundary. The actual enforcement is `lib/auth/dal.ts`'s
new `requirePlatformAdmin()`, called in two places per protected path
deliberately: once at the top of each `/admin/*` page for a clean early
redirect, and again inside every `business-management/api.ts` function
itself (defense in depth, so a future caller can't accidentally read/
write business data without a valid platform_admin session even if it
forgets the page-level check). Added baseline security headers (CSP,
`X-Frame-Options`, `Referrer-Policy`) via `next.config.ts`.

Reviewer sub-agent's finding, fixed: `requirePlatformAdmin()`'s
`redirect()` calls happening *inside* `createBusiness()`/`createCard()`
(both invoked from within `createBusinessAction`'s try block) risked
being caught by the action's generic `catch` and silently rerouted to a
misleading "Something went wrong" instead of `/login` — the same class
of Next.js gotcha this project already knew about (`redirect()` must
never be reachable from inside a try/catch that could swallow it).
Fixed by calling `requirePlatformAdmin()` explicitly at the very top of
`createBusinessAction`, before the try block, so an invalid session
redirects immediately and the internal calls never execute. Also fixed:
a stale code comment still describing the old Basic Auth model, and the
CSP was missing the dev-only `'unsafe-eval'` Next's own docs specify
(React's dev-mode error-stack reconstruction needs it; production is
unaffected either way).

Verified extensively against the real dev server and real production
database, including the two things prior sub-phases relied on:
`ADMIN_USERNAME`/`ADMIN_PASSWORD` sent via a real Basic Auth header no
longer grant any access at all; and — specifically testing the
defense-in-depth claim, not just the happy path — logged in for a real
cryptographically-valid signed cookie, then deleted the underlying
database session row directly while keeping that cookie, and confirmed
`/admin/*` still correctly redirected to `/login` (caught by the DAL's
real DB check, not proxy's cookie-only check, confirmed by different
response headers on that redirect). Also confirmed, using the same
orphaned-session technique, that submitting the create-business form
now correctly redirects to `/login` (not a misleading generic error)
and creates no business row. `npm run build` verified both with and
without `.env.local` present.

Verified live on Vercel before merging: tested the actual PR Preview
deployment (via Vercel's "Protection Bypass for Automation" secret,
since Preview URLs are otherwise gated behind Vercel's own SSO) —
confirmed `proxy.ts` behaves correctly under real Vercel infrastructure
(the same class of Edge-vs-Node.js concern that broke `timingSafeEqual`
once before, in 2a), old Basic Auth grants nothing, login/admin
access/defense-in-depth (via Preview's own `logout` to orphan a session
server-side, since Preview turned out to use its own separate Neon
branch rather than the shared one) all work correctly. After merging,
ran the same smoke test against real production (login, all three
admin pages, real Saffron data, logout, old Basic Auth still dead) —
all passed.

### 2026-08-16 — Retire ADMIN_USERNAME/ADMIN_PASSWORD
Removed from Vercel's env vars and `.env.local` now that 4c is
confirmed live and stable — nothing in the codebase reads them anymore.
**V4's cutover from Basic Auth to real sessions is complete.**

### 2026-08-16 — Login/logout flow (4b)
Added `features/auth/api.ts` (`verifyCredentials()`), `features/auth/
actions.ts` (`loginAction`/`logoutAction` as POST Server Actions),
`app/login/page.tsx` (shows the form, or "Logged in as X" + logout if
already authenticated), `lib/auth/dal.ts` (`verifySession()`, the real
DB-backed enforcement point), and `scripts/create-admin.ts` (creates
the real platform_admin account). `getClientIp()` in `lib/rate-limit.ts`
was refactored to take a plain `Headers` object instead of `NextRequest`
so it can be called from a Server Action, which has no request object
of its own; the one existing call site (`/r/[slug]`) and its tests were
updated to match. `/admin/*` still runs entirely on Basic Auth,
untouched — nothing live depends on any of this yet.

Reviewer sub-agent caught and this fixes: `loginAction` was trimming
the password the same way it trims other form fields, which would
silently alter a user's actual input before comparison — a future
account whose password contains whitespace could hash one way and
verify another, permanently locking it out. Fixed with a dedicated
non-trimming `passwordField()` helper. Also fixed: failed login
attempts weren't being logged server-side, despite that being a
settled requirement in `ARCHITECTURE.md` § V4's security baseline —
added a log line (email attempted + timestamp, never the password).
Also fixed: `scripts/create-admin.ts` used a select-then-insert check
for email uniqueness, the exact TOCTOU pattern this codebase already
moved away from once in 2b — switched to catching the Postgres unique-
violation instead, matching the established `isPgError` convention.

Verified end-to-end against the real dev server and real production
database: correct credentials succeed (session cookie `Secure`+
`HttpOnly`+`SameSite=lax`, 7-day expiry); wrong password and a
whitespace-padded correct password both fail with a generic error;
the login page shows the logged-in state and a working logout, which
was confirmed (via a direct DB query) to delete the session row, not
just clear the cookie; failed attempts appear in the server log; and
`create-admin.ts` is idempotent on a second run. (Verification also
surfaced and resolved an unrelated environment issue: several
`npm run dev` background processes had accumulated without being
killed, since `pkill`/`kill -9` don't reliably terminate
Windows-spawned Node processes from Git Bash — cleared via PowerShell's
`Stop-Process`, which does work reliably here.)

### 2026-08-16 — Schema + auth infrastructure (4a)
Added `users`/`sessions` tables and a nullable `businesses.owner_id`
column (first schema change since V1), plus `lib/auth/passwords.ts`
(bcryptjs hash/verify) and `lib/auth/session.ts` (jose-based
encrypt/decrypt, cookie set/delete, `createSession()`/`deleteSession()`
backed by real DB session rows). No routes, no UI, and the existing
Basic Auth gate is completely untouched — zero risk to the live admin
section. Two migrations run against production, each confirmed
separately beforehand: the initial additive schema, then a follow-up
fixing the two new foreign keys' `ON DELETE` behavior.

Reviewer sub-agent caught and this fixes: `decrypt()` was calling the
`SESSION_SECRET`-dependent key lookup *inside* its try/catch, so a
misconfigured or missing secret at runtime would silently look
identical to "no session" instead of failing loudly — fixed by moving
the key lookup outside the catch, matching how `encrypt()` already
behaved. Also fixed: both new foreign keys defaulted to Postgres's
`NO ACTION` rather than a deliberate choice — `sessions.user_id` now
cascades on user delete (no orphaned session rows), and
`businesses.owner_id` now sets to `NULL` on owner delete (a business
with printed QR cards must never be deleted just because its owner
account was).

Verified end-to-end against real production data: password
hash/verify correctness; `users`/`sessions` tables writable; session
cookie is `HttpOnly`+`Secure` and the DB row it references matches;
`deleteSession()` removes both the cookie and the DB row (not just the
cookie); and, after the fix, `ON DELETE CASCADE`/`SET NULL` both
verified directly by deleting real rows and checking the result.

### 2026-08-16 — Per-business detail page: chart + breakdown (3c)
Added `app/admin/dashboard/[businessId]/page.tsx`: the Recharts
time-series chart (7/30/90-day picker via `?days=`, default 30) and a
qr/nfc breakdown table, wired to 3a's `getScanTimeSeries()` and
`getScanBreakdownByCardType()`. A missing or malformed `businessId`
correctly 404s via `notFound()`. New dependency: `recharts`.

Reviewer sub-agent's findings, all fixed: `ARCHITECTURE.md` documented
a `CardTypeBreakdown.tsx` component that was never actually built (the
breakdown ended up as a plain inlined table, matching the rest of
`/admin/*`'s table convention — doc updated to match reality instead of
building an unnecessary extraction); the chart had no heading or
accessible alternative (added an `<h2>` and Recharts' `accessibilityLayer`
prop); the selected date-range link had no semantic "current" indicator
(added `aria-current`); `searchParams.days` was typed as `string`
when Next's actual runtime shape allows `string[]` (widened the type
and normalized explicitly, rather than relying on `NaN` failing safe by
accident). Also flagged and confirmed correct: one internal link had to
use `next/link`'s `<Link>` instead of the codebase's usual plain `<a>`,
because of a real quirk in Next's `no-html-link-for-pages` ESLint rule
(its dynamic-segment regex for this same route also matches the
empty-segment case) — traced through the rule's source to confirm it's
a rule quirk, not a routing bug, and left an explanatory comment.

Verified end-to-end against the real dev server and real Basic Auth:
no-auth → 401; real business + default/`?days=7` → 200 with all 7
Manila-local days zero-filled correctly and both qr/nfc rows rendering;
a well-formed nonexistent UUID and a malformed `businessId` both → 404.
Confirmed via the build route table that the new route renders
dynamically (`ƒ`), not statically prerendered.

### 2026-08-16 — Set real dashboard launch cutoff
`DASHBOARD_DATA_START_AT` set to `2026-08-15T20:11:15Z`, confirmed with
the owner — the real cutoff excluding all V1/V2/V3 test `scan_events`
from the dashboard going forward. No manual testing during 3a/3b/3c hit
the live production redirect route, so nothing real is excluded by this.

**V3 (Phase 3) is complete**: dashboard overview + per-business
time-series chart + qr/nfc breakdown, all behind the existing Basic
Auth gate, showing only real post-launch scan data.

### 2026-08-16 — Dashboard overview page (3b)
Added `app/admin/dashboard/page.tsx`: lists every business with its
total scan count (via 3a's `getBusinessScanTotals()`), linking to each
business's detail page (`/admin/dashboard/[businessId]`, built next in
3c — those links 404 until then, an expected short-lived state). Same
plain-inline-styled-HTML Server Component pattern as `/admin/businesses`,
gated by the existing Basic Auth proxy with zero proxy changes needed.

Caught and fixed before review: this page had no dynamic route segment
or `searchParams`, so Next.js was silently statically prerendering it at
build time — confirmed via the build route table (`○` instead of `ƒ`).
For a live-data page this both breaks the CI build (no `DATABASE_URL` at
build time) and would freeze scan counts at deploy-time values in
production. Fixed with `export const dynamic = "force-dynamic";`,
verified by rebuilding with `.env.local` temporarily hidden.

Reviewer sub-agent's only finding: an empty `<th>` (the actions column
header) had no `scope` or accessible label — fixed with `scope="col"`
on all three headers and a visually-hidden "Actions" label.

Verified end-to-end against the real dev server and real Basic Auth
credentials: no-auth request returns 401, correct-auth request returns
200 showing the real Saffron business (0 total scans, expected — the
3a cutoff constant is still a placeholder) with a correctly-linked
"View details" URL.

### 2026-08-16 — Analytics query layer (3a)
Added `features/analytics/api.ts` + `constants.ts`: `getBusinessScanTotals()`,
`getScanTimeSeries()`, `getScanBreakdownByCardType()` — read-only queries
behind 3b/3c's dashboard, no UI yet. Day-bucketing uses Asia/Manila
calendar days (not UTC), zero-filled so charts never show a misleading
gap. All three default to a `DASHBOARD_DATA_START_AT` cutoff constant,
currently a deliberate far-future placeholder so no test/dev traffic
counts as real until it's set to the actual V3 launch date in 3c.

Reviewer sub-agent caught and this fixes: `getScanTimeSeries()` and
`getScanBreakdownByCardType()` had no way to distinguish "business
doesn't exist" from "business exists with zero scans" (both produced an
identical all-zero result) — now both return `null` for a missing or
malformed `businessId`, so 3c's `/admin/dashboard/[businessId]` route
can 404 correctly instead of rendering an empty dashboard for a bad
link. Also fixed: a malformed (non-UUID) `businessId` would have thrown
an unhandled Postgres error rather than failing gracefully; the
qr/nfc breakdown's type list was hand-duplicated from the schema's enum
instead of derived from it.

Verified end-to-end against the real production database (temporarily
removing `server-only` to run via a throwaway script): real cutoff
placeholder returns all zeros as intended, an early test cutoff
correctly surfaces the real 56 scans split across two days with correct
zero-filling, and both a nonexistent well-formed UUID and a malformed
`businessId` return `null` instead of throwing.

### 2026-08-15 — Database schema, Neon connection, and seed (1a)
Added the Drizzle schema for Business/Card/ScanEvent, connected it to
the real Neon database, ran the first migration, and seeded the real
Saffron Middle Eastern Restaurant business + its `saffron` QR card so
there's real data to test the redirect route against.

### 2026-08-15 — Redirect route (1b)
Added `GET /r/[slug]`: looks up the card by slug, logs a scan event
(best-effort — a logging failure never blocks the redirect), and
302-redirects to the business's Google review URL. Includes rate
limiting, a generic 404 for unknown slugs, and a graceful error instead
of a crash if a business's review URL is ever malformed. Verified
end-to-end against the real dev server and real seeded Neon data
(valid slug, unknown slug, and rate-limit burst all behaved correctly).

### 2026-08-16 — Business/card creation + listing logic (2b)
Added `features/business-management/api.ts`: `createBusiness()`,
`createCard()`, `listBusinesses()` — no UI yet, just the logic 2c's
admin form will call. Slug validation extracted into shared
`lib/slug.ts` (was duplicated in `scripts/generate-qr.ts`).

Reviewer sub-agent caught and this fixes: a TOCTOU race on slug
uniqueness (select-then-insert had a window for two concurrent
requests to both pass the check), `createCard()` not validating that
`businessId` actually exists (raw FK-violation error would've leaked
through), and `listBusinesses()` silently duplicating a business's row
once per card instead of grouping — now fixed by catching Postgres
constraint violations (via drizzle's `Error.cause` chain) and
translating them to clean messages, and by grouping `listBusinesses()`
results into one entry per business with its cards nested.

Verified end-to-end against the real database (temporarily removing
`server-only` to run via a throwaway script, since no UI exists yet to
call this through) — including creating a real second business
(Saffron is no longer the only one in the database) and giving it a
second card to confirm the multi-card grouping fix.

### 2026-08-16 — Basic Auth proxy for /admin (2a)
Added `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`),
gating every route under `/admin/*` with HTTP Basic Auth checked
against `ADMIN_USERNAME`/`ADMIN_PASSWORD`. Fails closed if those env
vars are missing. Reviewer sub-agent caught three real issues, all
fixed: a shared `Response` singleton reused across concurrent requests
(risked a locked/empty body under load), a `||` short-circuit that
leaked which credential was wrong via response timing (defeated the
point of using `timingSafeEqual`), and a case-sensitive Basic-scheme
check that rejected RFC-compliant lowercase `basic` headers. Verified
against the real dev server: no/wrong/correct credentials, missing env
vars (fails closed even with an otherwise-correct header), 10
concurrent unauthenticated requests, and that the public `/r/[slug]`
route is completely unaffected.

### 2026-08-16 — Admin page: list + create form (2c)
Added `app/admin/businesses/page.tsx` (Server Component) and
`features/business-management/actions.ts` (Server Action) — the real
form that replaces `scripts/seed.ts`. Wires 2a's Basic Auth proxy and
2b's business-management logic together.

Reviewer sub-agent's main finding: the orphan-business tradeoff
accepted in 2b (rare DB failure leaves a business with no card) became
a *common* one here, since an ordinary admin typo (duplicate or
malformed slug) triggered it via the form — and V2 has no delete/update
to fix it. Fixed by validating slug format and uniqueness *before*
creating the business row, so only a genuinely rare concurrent-write
race can still cause it, matching the originally accepted risk. Also
fixed: FormData values weren't type-checked before use (a File part
could've been silently coerced to the string `"[object File]"`),
unexpected errors weren't logged server-side, and business
name/slug had no length caps.

Verified end-to-end against the real dev server and real database,
including confirming the fix directly: submitting a duplicate slug no
longer creates an orphan business (row count unchanged, business never
appears in the list), while a genuinely new business still succeeds
normally. Also verified — since the Next.js docs explicitly warn that
"render-time gating is not a security boundary" — that a raw POST
directly to the Server Action's URL (bypassing the rendered form
entirely) is blocked by the proxy exactly like a GET, not just
UI-level gating.

**V2 (Phase 2) is complete**: multiple businesses are now fully
supported end-to-end, from a real admin form through to the public
redirect.

### 2026-08-16 — Deploy + QR generation (1c)
Deployed to Vercel on the free `nfc-side-hustle.vercel.app` subdomain,
connected to the real Neon database via Neon's official Vercel
integration. Verified the live deployment end-to-end (valid slug,
unknown slug, and a real scan event written to production Neon).
Added a QR generation script (`npm run qr:generate -- <slug>`) that
validates the slug format and confirms the URL actually resolves to a
real card (302) before saving the PNG — refuses to generate a QR for a
typo'd or non-existent slug, since a printed QR can't be recalled once
handed to a business. V1 (Phase 1) is now complete: a real QR code for
Saffron Middle Eastern Restaurant is ready to print.
