# Changes

## Unreleased

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

**V3 (Phase 3) is complete once `DASHBOARD_DATA_START_AT` is set to its
real value and this PR merges** — see the follow-up entry below.

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
