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
- Deleting or regenerating the seed data once real businesses are using
  their card/QR — a business's `slug` going away breaks a card that's
  already printed and handed out.
- Any change to `.github/workflows/ci.yml` or branch protection settings.
- Force-pushing or rewriting history on `main`.

## Flat rules, not judgment calls
- `DATABASE_URL` (the Neon connection string) is a server-only secret —
  it must never be imported into client-component code, sent to the
  browser, or logged. It lives in Vercel env vars and local `.env.local`
  (gitignored) only.
- The `/r/[slug]` redirect route must validate the slug against a real
  `Card` row before writing a `ScanEvent` — never write a scan event or
  redirect based on unvalidated input.
- No public write-endpoint (admin form, API for creating
  businesses/cards) gets added without an explicit auth/authorization
  design first — V1–V3 intentionally have no accounts (see
  `ARCHITECTURE.md`), so until V4, all data entry is via seed
  scripts/direct DB access, not a public form.
- Don't skip the lint/build/test gates (local pre-commit/pre-push hooks,
  or CI) with `--no-verify` or equivalent.

## Gates
- `npm run lint`, `npm run build` (includes TypeScript checking), and
  `npm run test` must all pass. Enforced locally via Husky
  (`.husky/pre-commit`, `.husky/pre-push`) and in CI
  (`.github/workflows/ci.yml`) on every PR to `main`.
