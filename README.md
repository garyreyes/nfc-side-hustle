# nfc-side-hustle

My friend and I started this to practice door-to-door selling — actually
talking to people, actually getting told no, actually closing a deal
face to face, not from behind a screen. We picked local businesses and
Google reviews as the reason to knock, because in our experience most
small businesses around here don't really treat their Google reviews as
something worth investing in — a slow trickle of reviews if any, no easy
way for a happy customer to actually leave one on the spot. We wanted to
change that in our own small way: sell a physical plate (QR code and/or
NFC tap) that a business puts on their counter, so a customer can leave
a review in ten seconds instead of never getting around to it.

That's the actual business. Everything below is the software behind it.

## What this is

A platform for selling and managing physical review plates:

- **The plate itself** — a card or table-top piece with a QR code and/or
  an NFC chip. Tap or scan it, land straight on the business's Google
  review page.
- **An admin side** for us — track hardware we've bought, sell it to
  businesses, see what sold and for how much, watch scan activity roll
  in.
- **A dashboard for each business we sell to** — so they can see their
  own scan activity without needing to ask us.

## Where to start

- [`onboarding.md`](onboarding.md) — the actual field playbook: what to
  do, step by step, when you're standing in front of a business that
  just said yes. Includes the QR/NFC provisioning steps in full,
  written for zero prior experience with either.
- [`app.md`](app.md) — a reference for every screen in the app and what
  it actually does, for whenever you've forgotten.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the technical design: entities,
  stack, security baseline, folder structure. For working on the code
  itself.
- [`ROADMAP.md`](ROADMAP.md) — what's been built, phase by phase.
- [`CHANGES.md`](CHANGES.md) — a dated log of what shipped and why.
- [`PROJECT_FACTS.md`](PROJECT_FACTS.md) — durable decisions and lessons
  that don't belong in the code comments but matter across sessions.
- [`CLAUDE.md`](CLAUDE.md) — safety rules for this specific project
  (irreversible actions, gates, layer boundaries).

## Running it locally

```
npm install
npm run dev
```

Needs a `.env.local` with `DATABASE_URL` (a Neon Postgres connection
string) and `SESSION_SECRET` set. There's no separate dev database —
local runs talk to the same Postgres instance as production, so treat
every local script run accordingly (see `CLAUDE.md`).

Useful scripts:
- `npm run lint` / `npm run build` / `npm run test` — the same gates CI
  and the pre-commit/pre-push hooks run
- `npm run qr:generate -- <slug>` — generate a QR code PNG for an
  already-assigned plate
- `npm run admin:create` — bootstrap a platform-admin account directly
  (normally you'd use `/admin/team` instead once one admin already
  exists)
