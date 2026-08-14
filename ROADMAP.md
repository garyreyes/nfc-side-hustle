# Roadmap

Tracks status per sub-phase. Each sub-phase = one `feature-planner` build-loop pass.

## Phase 1 — V1: QR Scan Tracking

Source: `ARCHITECTURE.md` (confirmed).

- [ ] **1a. Database schema + Neon connection + seed** — not started
      Drizzle schema for Business/Card/ScanEvent, connect to Neon, run
      first migration, seed script inserting the one Business + one Card
      row.
- [ ] **1b. Redirect route** — not started
      `GET /r/[slug]`: validate slug against real Card rows, write a
      ScanEvent, 302-redirect to the Business's Google review URL.
- [ ] **1c. Deploy + real-world QR verification** — not started
      Wire the Vercel↔Neon integration, deploy, generate an actual QR
      code pointing at the live slug URL, verify end-to-end by scanning
      it with a phone.

## Phase 2 — V2: Multiple businesses, routing, CRUD

Not yet sub-phased — needs its own `app-architect` pass before Phase 1 is
broken down further. Source: `AI_Engineering_and_NFC_Roadmap.md` §10.

## Phase 3 — V3: Dashboard, analytics

Not yet sub-phased — needs its own `app-architect` pass. Source:
`AI_Engineering_and_NFC_Roadmap.md` §10.

## Phase 4 — V4: Accounts, auth, roles

Not yet sub-phased — needs its own `app-architect` pass, and is the
trigger point for a full `security-baseline` review (auth, sessions,
authorization). Source: `AI_Engineering_and_NFC_Roadmap.md` §10.

## Phase 5 — V5: Multi-branch hierarchy

Not yet sub-phased — needs its own `app-architect` pass. Source:
`AI_Engineering_and_NFC_Roadmap.md` §10.
