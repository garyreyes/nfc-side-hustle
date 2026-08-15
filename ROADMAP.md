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

- [ ] **3a. Analytics query layer**
      `features/analytics/api.ts` + `constants.ts` —
      `getBusinessScanTotals()`, `getScanTimeSeries(businessId, range)`,
      `getScanBreakdownByCardType(businessId, range)`, plus the
      `DASHBOARD_DATA_START_AT` cutoff constant. No UI — testable
      independently, same pattern as 2b.
- [ ] **3b. Dashboard overview page**
      `app/admin/dashboard/page.tsx` — lists every business with its
      total scan count (post-cutoff), links into each business's
      detail page. Wires into 3a's `getBusinessScanTotals()`.
- [ ] **3c. Per-business detail page: chart + breakdown**
      `app/admin/dashboard/[businessId]/page.tsx` — Recharts
      time-series chart (7/30/90-day range picker, defaults to 30) and
      the qr/nfc card-type breakdown, wired to 3a's remaining two
      queries. Last sub-phase — V3 complete once this ships.

## Phase 4 — V4: Accounts, auth, roles

Not yet sub-phased — needs its own `app-architect` pass, and is the
trigger point for a full `security-baseline` review (auth, sessions,
authorization). Source: `AI_Engineering_and_NFC_Roadmap.md` §10.

## Phase 5 — V5: Multi-branch hierarchy

Not yet sub-phased — needs its own `app-architect` pass. Source:
`AI_Engineering_and_NFC_Roadmap.md` §10.
