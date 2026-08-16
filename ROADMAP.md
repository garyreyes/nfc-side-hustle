# Roadmap

Tracks status per sub-phase. Each sub-phase = one `feature-planner` build-loop pass.

## Phase 1 — V1: QR Scan Tracking

Source: `ARCHITECTURE.md` (confirmed).

- [x] **1a. Database schema + Neon connection + seed** — done
      Drizzle schema for Business/Card/ScanEvent, connect to Neon, run
      first migration, seed script inserting the one Business + one Card
      row.
- [x] **1b. Redirect route** — done
      `GET /r/[slug]`: validate slug against real Card rows, write a
      ScanEvent, 302-redirect to the Business's Google review URL.
- [x] **1c. Deploy + real-world QR verification** — done
      Wire the Vercel↔Neon integration, deploy, generate an actual QR
      code pointing at the live slug URL, verify end-to-end by scanning
      it with a phone.

**Phase 1 (V1) complete.**

## Phase 2 — V2: Multiple businesses, routing, CRUD

Architecture confirmed (see `ARCHITECTURE.md` § V2) — routing already
works with no changes; scope is admin CRUD (Create + Read only) behind
HTTP Basic Auth.

- [x] **2a. Basic Auth middleware** — done
      `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`, same
      functionality) gating everything under `/admin/*`, built and
      verified before any admin route exists. Verify: no credentials →
      401, correct credentials → passes through, missing env vars →
      fails closed.
- [x] **2b. Business/Card creation + listing logic** — done
      `features/business-management/api.ts` — `createBusiness()`,
      `createCard()`, `listBusinesses()`, with server-side validation
      (slug format, required fields). Testable independently of any UI.
- [x] **2c. Admin page (list + create form)** — done
      `app/admin/businesses/page.tsx` — wires 2a + 2b together: a form
      to add a business + its card, and a list of existing ones.
      Replaces `scripts/seed.ts` as the real way to onboard businesses.

**Phase 2 (V2) complete.**

## Phase 3 — V3: Dashboard, analytics

Architecture confirmed (see `ARCHITECTURE.md` § V3) — no schema
changes; full scope (time-series chart + per-card-type breakdown),
reusing V2's Basic Auth gate unchanged. Test-data contamination from
V1/V2 verification handled via a `DASHBOARD_DATA_START_AT` cutoff
constant rather than row filtering.

- [x] **3a. Analytics query layer** — done
      `features/analytics/api.ts` + `constants.ts` —
      `getBusinessScanTotals()`, `getScanTimeSeries(businessId, range)`,
      `getScanBreakdownByCardType(businessId, range)`, plus the
      `DASHBOARD_DATA_START_AT` cutoff constant. No UI — testable
      independently, same pattern as 2b.
- [x] **3b. Dashboard overview page** — done
      `app/admin/dashboard/page.tsx` — lists every business with its
      total scan count (post-cutoff), links into each business's
      detail page. Wires into 3a's `getBusinessScanTotals()`.
- [x] **3c. Per-business detail page: chart + breakdown** — done
      `app/admin/dashboard/[businessId]/page.tsx` — Recharts
      time-series chart (7/30/90-day range picker, defaults to 30) and
      the qr/nfc card-type breakdown, wired to 3a's remaining two
      queries.

**Phase 3 (V3) complete.**

## Phase 4 — V4: Accounts, auth, roles

Architecture confirmed (see `ARCHITECTURE.md` § V4) — real accounts
for both the platform admin and business owners, database sessions,
DAL-based authorization replacing V2's Basic Auth entirely. First
schema change since V1. `security-baseline` pass already run and
folded into the architecture doc and the sub-phases below.

- [x] **4a. Schema + auth infrastructure** — done
      `User`/`Session` tables, `Business.ownerId` (nullable) migration,
      `lib/auth/passwords.ts` (bcryptjs), `lib/auth/session.ts`
      (encrypt/decrypt, cookie set/delete, createSession/
      deleteSession). No routes, no UI — testable independently via
      scripts, same pattern as 1a/2b. Existing Basic Auth gate
      completely untouched — zero risk to the live admin section.
- [x] **4b. Login/logout flow** — done
      `features/auth/api.ts` (credential check, timing-safe/generic
      errors, rate-limited via existing `lib/rate-limit.ts`),
      `features/auth/actions.ts` (loginAction, logoutAction as POST
      Server Actions), `app/login/page.tsx`, `lib/auth/dal.ts`
      (`verifySession()`). Includes a one-time script (mirrors
      `scripts/seed.ts`) to create the platform_admin account.
      `/admin/*` still runs on Basic Auth, untouched — proves the
      login mechanism in isolation before anything live depends on it.
- [x] **4c. Cutover: retire Basic Auth, gate /admin/* via the DAL** — done
      Rewrite `proxy.ts` to optimistic-only checks; add
      `verifySession()` + role checks to `business-management/api.ts`
      and the admin dashboard routes; add baseline security headers
      (`next.config.ts`); remove `ADMIN_USERNAME`/`ADMIN_PASSWORD` from
      Vercel + `.env.local` once verified live. Single highest-risk
      sub-phase — the only access-control mechanism this app has ever
      had gets replaced here. Ships only after 4b is proven working.
- [x] **4d. Business owner accounts + scoped /dashboard** — done
      Extend business creation to also create/link an owner `User`
      account; add defense-in-depth `businessId` scoping inside
      `analytics/api.ts`'s query functions; build
      `app/dashboard/page.tsx` (business owner's own view, reusing
      3c's chart/breakdown components).

**Phase 4 (V4) complete.**

## Phase 5 — V5: Multi-Branch Locations

Architecture confirmed (see `ARCHITECTURE.md` § V5) — optional
per-branch locations, each with its own Google review URL and scan
tracking. Purely additive: new `Branch` table + `cards.branchId`
(nullable FK), no migration of existing data. Lower risk than V4 — no
new permission model, `business_owner` stays read-only, no dedicated
`security-baseline` pass needed.

- [x] **5a. Schema + branch/card creation logic** — done
      New `Branch` table (`id`, `businessId`, `name`,
      `googleReviewUrl`); `cards.branchId` (nullable FK) migration.
      `createBranch()` in `business-management/api.ts`; `createCard()`
      extended to accept an optional `branchId`, validated against the
      target business. No UI yet — testable independently via
      scripts, same pattern as 1a/2b/4a.
- [x] **5b. Branch-aware redirect** — done
      `GET /r/[slug]` resolves `card.branch?.googleReviewUrl ??
      business.googleReviewUrl`. Small, focused — the actual
      customer-facing payoff of the phase.
- [x] **5c. Admin UI for managing branches** — done
      Extends `/admin/businesses` to create/list branches per
      business; the card-creation form gains an optional branch
      selector.
- [x] **5d. Per-branch dashboard breakdown** — done
      New per-branch scan query in `analytics/api.ts`; extends the
      shared `BusinessAnalyticsView` with a branch breakdown section,
      shown only for businesses that actually have branches — works
      identically for the admin view and a business owner's own
      `/dashboard`. Last sub-phase — V5 (and the whole V1-V5 roadmap)
      complete once this ships.

**Phase 5 (V5) complete. V1-V5 roadmap complete.**

## Phase 6 — V6: Plate Inventory & Reseller Model

Architecture confirmed (see `ARCHITECTURE.md` § V6) — bulk-manufactured
hardware exists as inventory before any business owns it. First
genuinely structural schema change since V4 (`Card`→`Plate` rename,
`businessId` becomes nullable). Real deadline: a real 20-unit NFC pilot
batch is already ordered and arrives in ~2 weeks — V6a must ship before
those units can be provisioned.

- [x] **6a. Schema migration** — done
      Rename `cards`→`plates`, `type`→`capability` (add `combo`,
      `businessId` now nullable), add `status` enum
      (`unassigned`|`active`|`suspended`, existing real rows backfilled
      to `active`), add `batches` table + `plates.batchId`, add
      `scan_events.interactionType`. No UI/behavior change — same
      low-risk, schema-only pattern as 1a/4a/5a. **Gates the real
      hardware batch — must ship before the 20 ordered units arrive.**
      Caused a brief live outage (migration ran before the matching code
      deployed) — fixed immediately, see `CHANGES.md`/`PROJECT_FACTS.md`.
- [x] **6b. Real QR/NFC attribution + unassigned/suspended redirect** — done
      `GET /r/[slug]` reads a `?src=qr`/`?src=nfc` query marker and logs
      the real `interactionType` on `ScanEvent` (missing marker →
      `"unknown"`). Also defines distinct redirect behavior for an
      `unassigned` plate (never sold) vs. a `suspended` one (was active,
      paused) instead of reusing the generic malformed-URL 500.
- [x] **6c. Bulk batch generator script** — done
      TypeScript, extends `scripts/generate-qr.ts`'s slug/QR logic
      (`scripts/generate-batch.ts` already exists as a first pass from
      planning — needs review/hardening as a real sub-phase). Generates
      unique slugs, QR PNGs, NFC payload text (with the `?src=` marker),
      a manifest.csv, and a spec-sheet for a physical supplier order.
- [x] **6d. Admin inventory UI** — done
      `/admin/plates` — list/filter plates by status/batch, assign an
      `unassigned` plate to a business (+ optional branch) to make it
      `active`, edit `capability`, toggle `active`/`suspended`. This is
      also the tool used to provision the 20-unit NFC pilot batch by
      hand once it arrives.
- [ ] **6e. Channel breakdown on dashboards** — not started
      Once `interactionType` is real data, add a qr-vs-nfc breakdown to
      the shared `BusinessAnalyticsView` (same pattern as the existing
      card-type breakdown) — both the admin detail page and a business
      owner's own `/dashboard` get it for free.

**Not in scope for V6, deliberately**: no billing/payment system
(suspension is a manual admin toggle only), no custom domain (staying on
the free `.vercel.app` subdomain), no generic per-plate redirect target
beyond Google review links (menu/website destinations are future work,
not built speculatively now).
