@AGENTS.md

# Project safety rules — nfc-side-hustle

## Orient here first
- `ARCHITECTURE.md` — entities, stack, security baseline, folder structure
- `ROADMAP.md` — phase/sub-phase breakdown and status
- `CHANGES.md` — dated log of what's shipped
- `PROJECT_FACTS.md` — durable project-specific decisions

## Irreversible / high-blast-radius actions — always confirm first
- Running a database migration against the deployed (Neon) database, as
  opposed to a local/dev branch — schema changes to live data are hard to
  undo cleanly.
- Deleting or regenerating seed/production data once a real business is
  using its plate/QR — a business's `slug` going away breaks a plate
  that's already printed and handed out. This includes broad/bulk
  deletes ("clear all data") — confirm exact scope in plain language
  before running one, since there is no separate dev database (see
  below) and a vague scope is how a real business gets wiped by mistake.
- Any change to `.github/workflows/ci.yml` or branch protection settings.
- Force-pushing or rewriting history on `main`.

## Flat rules, not judgment calls
- There is no separate dev database — local dev, scripts, and production
  all point at the same Neon instance via `DATABASE_URL`. Treat every
  local script run as a production action, not a sandboxed one.
- `DATABASE_URL` (the Neon connection string) is a server-only secret —
  it must never be imported into client-component code, sent to the
  browser, or logged. It lives in Vercel env vars and local `.env.local`
  (gitignored) only.
- The `/r/[slug]` redirect route must validate the slug against a real
  `Plate` row before writing a `ScanEvent` — never write a scan event or
  redirect based on unvalidated input.
- No public write-endpoint (admin form, API for creating
  businesses/plates) gets added without an explicit auth/authorization
  design first — V1–V3 intentionally have no accounts (see
  `ARCHITECTURE.md`), so until V4, all data entry is via seed
  scripts/direct DB access, not a public form.
- Don't skip the lint/build/test gates (local pre-commit/pre-push hooks,
  or CI) with `--no-verify` or equivalent.

## Layer boundaries
- UI components (`app/`, page-level `.tsx`) contain no business logic
  and make no direct database/external calls — they call functions in
  `features/*/api.ts` (queries/mutations) or `features/*/actions.ts`
  (Server Actions), never `db` or a third-party SDK directly.
- Business logic and all outbound calls (database, future third-party
  APIs) live in `features/*/api.ts` or `lib/`, not scattered across
  route handlers or components.
- Route handlers (`app/**/route.ts`) stay thin: parse the request, call
  a `features/*/api.ts` function, return a response — no query-building
  or business rules inline in the handler itself.

## Security hard-halts for NEW auth/payment work
This project's existing session/password logic (`lib/auth/session.ts`,
`lib/auth/passwords.ts`, `lib/auth/dal.ts`) is a **documented, accepted
exception** to the "never hand-roll auth" rule below — it predates that
rule and went through a real `security-baseline` review (see
`ARCHITECTURE.md` § V4: bcryptjs over bcrypt to avoid a build-risk class
already hit once in this codebase, httpOnly/secure/sameSite session
cookies, DB-row deletion on logout, timing-safe login to prevent email
enumeration, rate limiting). It is not a template to copy for anything
new. Any auth or payment surface added *from here on* follows the hard
rule with no further exception:
- Never hand-roll a **new** authentication mechanism, session scheme, or
  password-reset flow — reuse the existing `lib/auth/` module, don't
  build a second one.
- Never hand-build raw payment or OAuth requests. Use the official SDK,
  and put it behind one wrapper module (e.g. `lib/payments.ts`) that
  feature code imports — never the SDK or raw API directly.

## Gates
- `npm run lint`, `npm run build` (includes TypeScript checking), and
  `npm run test` must all pass. Enforced locally via Husky
  (`.husky/pre-commit`, `.husky/pre-push`) and in CI
  (`.github/workflows/ci.yml`) on every PR to `main`. Branch protection
  requires the `gates` check (applies even to the repo admin) and blocks
  force-pushes/deletions on `main`.
