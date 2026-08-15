# Changes

## Unreleased

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
