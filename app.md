# App reference

What every screen in nfc-side-hustle actually does, as of the current
build (through the inventory-exports and admin-team-management
additions). This is a reference for you, not a client doc — written
assuming you know roughly what the project is, just not necessarily what
every screen does today.

Everything below describes the *screens*, not whatever's actually in
the database right now — data changes constantly as you use the app,
this file doesn't try to track it. (For reference: the production
database was fully wiped on 2026-08-17, so anything from before that
date is gone — see `PROJECT_FACTS.md` for the details of what was
deleted and why.)

There are two kinds of login: **platform admin** (you and your
teammate — see everything, manage everything) and **business owner**
(a client — sees only their own scan activity). What you see depends on
which one you're logged in as.

---

## `/` — Log in

The only public page besides the redirect route. If you're not logged
in: email + password form. If you already are: instead of the form, it
shows who you're logged in as and a button straight to the right place
(`/admin/businesses` for an admin, `/dashboard` for a business owner),
plus a log-out button.

There's no "forgot password" link and no self-signup — both are
deliberately absent. Recovery for a locked-out account is a direct
database script, not a UI flow.

---

## Platform admin pages

All of these are under `/admin/*` and require a `platform_admin`
session — a business owner hitting any of them gets redirected back to
`/`.

### `/admin/businesses` — client roster

- Two stat cards: total businesses, total scans across all of them.
- **Add a business** form: name, slug, Google review URL, optional
  owner email/password. Submitting this *also* immediately creates one
  plate for that business (using the slug you typed) — a legacy
  behavior from before batch/inventory tracking existed. See
  `onboarding.md` for how this affects the real sales workflow.
- Below that, every business as a collapsible card (closed by default,
  click to expand) — collapsed to stay usable once you have more than a
  handful of clients. A search box (`?q=`) filters by name and
  auto-expands matches.
- Inside each expanded card: its plates (slug, capability, branch),
  branches (name + review URL, with a form to add more), and owner
  info (email if one exists, or a form to create one if not).

### `/admin/dashboard` — scan activity, all businesses

A table: every business and its total scan count, with a "View
details" link into the per-business breakdown below. This is the
platform-wide view — a business owner never sees this page, only their
own slice of it.

### `/admin/dashboard/[businessId]` — one business's scan activity

Reached by clicking "View details" above (or a business owner lands on
the same underlying view at `/dashboard`, just without the "view any
business" framing). Shows:
- A date-range picker (7 / 30 / 90 days)
- A time-series chart of scans over that range
- **By capability** — scans split QR vs NFC vs combo
- **By channel** — scans split by *how* they happened: `qr` (scanned a
  QR code), `nfc` (tapped an NFC tag), or `unknown` (no marker present
  — either an old scan from before this tracking existed, or someone
  hit the bare URL directly rather than through a real plate)
- **By branch** — only shown if this business actually has branches set
  up; otherwise this section doesn't appear at all

### `/admin/plates` — inventory of physical units

- Stat cards: total / unassigned / active / suspended counts.
- Filter tabs by status.
- **Unassigned plates are grouped**, not listed individually — e.g. "94
  unassigned plates" under one batch+capability, with:
  - An **Assign one to business** form (business + sale price, both
    required) — picks one plate out of the group automatically; you
    don't choose which specific physical unit.
  - A **Fix capability for all N** form — bulk-corrects the whole
    group if it was recorded wrong (e.g. marked QR when the physical
    units are NFC).
- **Already-assigned plates get their own individual card** (they're no
  longer interchangeable once tied to a business), showing:
  - The plate's slug as a clickable `/r/<slug>` link
  - Which business it belongs to
  - A **Branch** dropdown (only meaningful if that business has
    branches)
  - **Suspend**/**Reactivate** — suspending makes the plate show a
    "temporarily paused" message instead of redirecting, without
    losing the assignment
  - A **Capability** dropdown, editable per-plate even after assignment
    (an NFC chip can fail in the field and get swapped for a QR
    sticker, for example)

### `/admin/inventory` — procurement, cost, revenue (owner-only concern)

Never seen by business owners — this is purely for you and your
teammate to track the hardware side of the business.

- **Record inventory arrival** form: batch name, capability, quantity,
  unit cost. Submitting it creates that many real unassigned plates —
  this is what feeds the groups you see on `/admin/plates`. An optional
  **Pre-made slugs** field (one per line) is for stock whose QR code
  was already printed by the supplier before it arrived — pasting slugs
  in makes quantity derive from the list automatically and creates
  plates matching exactly what's physically on the units, instead of
  generating new random codes. See `onboarding.md` for the full QR
  ordering sequence this pairs with.
- Stat cards: ordered, remaining, sold today, sold all-time, revenue
  today, revenue all-time, profit all-time, total cost of everything
  ordered.
- A **Stock** table: per capability, ordered / remaining / sold
  (today, this week, this month, all-time) / total + average cost.
- A **Sales & revenue** table: per capability, sold count + revenue for
  today/week/month, plus all-time revenue, cost of goods sold, and
  profit. Profit shows as "—" rather than ₱0 whenever nothing priced
  has actually sold yet, so "no data" never gets misread as "broke
  even."
- Two export buttons:
  - **Export to Excel** — downloads a `.xlsx` with three tabs:
    Inventory Summary (the same numbers as the stat cards/tables
    above), Batches (one row per batch+capability: quantity, total
    cost, sold, remaining), and Items Sold (one row per plate that's
    ever sold — slug, business, branch, batch, date sold, cost, sale
    price, profit).
  - **Download PDF report** — a one-page summary: totals, the
    per-capability table, and a "most sold" ranking by capability.
    Meant for reading/printing/sharing, not for working the raw
    numbers.

### `/admin/team` — who has admin access

- A list of every current platform admin (email + date added).
- An **Add an admin** form (email + password) — grants full,
  unrestricted platform-admin access, identical to your own. No email
  gets sent; you tell them the password directly.
- No self-service signup, no password reset flow here either — same
  reasoning as the login page.

---

## Business owner pages

### `/dashboard` — a client's own scan activity

What a business owner sees after logging in — the exact same
range-picker / chart / capability / channel / branch breakdown as the
admin's per-business detail page, just scoped to only their own
business and framed without any "admin" language. They cannot see
other businesses, plate inventory, cost, revenue, or the team page —
none of that exists in their nav at all.

---

## The public redirect — `/r/[slug]`

This is what a QR code or NFC tap actually opens. No login involved —
anyone can hit it, since that's the whole point.

1. Looks up the plate by its slug.
2. If the slug doesn't match any real plate: a plain 404, "Plate not
   found."
3. If it matches, a scan gets logged **regardless of what happens
   next** — including for unassigned or suspended plates, since those
   are still worth knowing about (e.g. someone testing a plate before
   it's sold).
4. Then, depending on the plate's status:
   - **unassigned** → a message saying it hasn't been activated yet
   - **suspended** → a message saying it's temporarily paused
   - **active** → a real redirect (302) to the business's (or branch's,
     if assigned to one) Google review URL
5. The `?src=qr` / `?src=nfc` query parameter on the URL (added by the
   QR-generation script, or typed manually when writing an NFC tag) is
   what lets the channel breakdown on the analytics pages tell a scan
   apart from a tap. No marker present → logged as `unknown`.

There's also a basic rate limit on this route (per IP) to blunt
someone hammering it, unrelated to the login system entirely.

---

## Things that exist in the code but have no UI (yet)

- `scripts/create-admin.ts` and `scripts/seed.ts` — one-off scripts for
  bootstrapping data directly against the database. Not something you'd
  normally run day-to-day now that `/admin/team` and the normal
  add-business/inventory-arrival flows exist.
- `scripts/generate-batch.ts` — an older, more elaborate batch generator
  (writes local QR images + a manifest/spec sheet in addition to
  creating the DB rows) — a heavier alternative to **Record inventory
  arrival** on `/admin/inventory`. Along with `npm run qr:generate`, it
  assumes you can print/stick a QR image onto the physical plate
  yourself — not how the real acrylic QR-capability plates get
  manufactured. For those, use `npm run qr:generate-order` (before
  ordering) plus the **Pre-made slugs** field on Record inventory
  arrival instead — see `onboarding.md`'s QR section for the full
  sequence.
