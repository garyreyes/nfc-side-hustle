# Onboarding a new business — step by step

This is the walkthrough for the actual sale: what to do from "we have a
box of plates" to "the business owner is holding a working plate that
sends their customers to a Google review." It assumes zero prior
experience with QR codes or NFC tags — if you've never written an NFC
tag before, that part is spelled out in full.

This is for you and your teammate (both platform admins) — not for the
business owner. They never see any of this.

---

## Before you're in the field: get stock into the system

You only need to do this once per shipment, not per sale.

1. Log in at `nfc-side-hustle.vercel.app` and go to **Inventory**.
2. Fill in **Record inventory arrival**: a name for this batch (e.g.
   `02`), the capability (QR only / NFC only / Combo — whatever the
   physical units actually are), how many units, and what you paid per
   unit.
3. Click **Record arrival**. This creates that many blank, unassigned
   plates in the system — nothing is written to a physical card yet,
   this just tells the system "we have N of these to sell."

You can see them waiting on the **Plates** page, grouped together as
"N unassigned plates" under that batch.

---

## At the sale: assigning a plate to the business

You've just convinced a local business to take a plate. Here's what to
do, in order.

### 1. Is this a business you've already entered, or a brand new one?

**New business** → go to **Businesses** → **Add a business**. Fill in:
- **Business name** — what shows up everywhere in the admin (e.g. "Golden
  Wok Restaurant")
- **Slug** — lowercase letters/numbers/hyphens only (e.g.
  `golden-wok`). One quirk worth knowing: filling in this form
  immediately creates one extra plate for this business too, using
  whatever you type here — a leftover from before batch/inventory
  tracking existed, with no cost or sale price recorded against it.
  You don't need to do anything with that plate and can ignore it —
  the plate you actually hand to the customer comes from your tracked
  batch stock in step 2 below, not this one. So just type anything
  short and valid here; it doesn't need to mean anything.
- **Google review URL** — the link that opens their Google review box
  directly. The easiest way to get this: search the business on Google
  Maps, click "Write a review," and copy the URL from that page.
- **Owner email / password** (optional, can add later) — only fill
  this in if you're also setting them up with dashboard login access
  right now. Skip it if you're not ready to do that yet.

Click **Add business**.

**Existing business** (e.g. selling them a second plate for another
location) → you don't need to do anything here, just find them on the
**Businesses** page when you get to step 2.

### 2. Assign a plate

Go to **Plates**. Find the unassigned group matching what you're
physically holding (same capability — QR, NFC, or combo — and ideally
the right batch).

Fill in the **Assign one to business** row:
- **Choose a business** — pick the one from step 1
- **Sale price (₱)** — what they actually paid. This is required now —
  you can't submit without it. It's what makes the revenue/profit
  numbers on the Inventory page mean anything, so don't skip it or
  round it off.

Click **Assign**. The system picks one plate out of that group for you
— you don't choose which physical unit, since they're all identical
until you write something to them (next step).

### 3. Find the plate's web address

After assigning, that plate now shows up as its own card on the
**Plates** page (no longer grouped — it's tied to a real business now).
It shows something like:

```
/r/34mbqr
```

That `/r/34mbqr` part is the plate's **slug** — a short,
unique code (it's *not* the same as the business slug you typed in
earlier; the system generates its own random one per plate at arrival
time). The full web address customers will actually visit is:

```
https://nfc-side-hustle.vercel.app/r/34mbqr
```

Write this down or keep the tab open — you need it for the next step,
whether you're dealing with a QR code or an NFC tag.

---

## Writing the actual QR code (if the plate is QR)

You're generating an image with a pattern that, when scanned, opens
that plate's web address. This runs from your computer, not your
phone.

1. Open a terminal in the project folder.
2. Run:
   ```
   npm run qr:generate -- 34mbqr
   ```
   (replace `34mbqr` with the actual slug from the plate card —
   just the slug itself, not the full URL, and no `/r/` in front)
3. The script checks that the plate is real and actually resolves
   before generating anything — if you mistyped the slug, it'll tell
   you and refuse to make an image, rather than printing a QR code
   that leads nowhere.
4. It saves a PNG image into a `qr-codes/` folder in the project, named
   after the slug (e.g. `34mbqr.png`). That's the image you
   print onto the physical plate, or have printed at a shop.

You don't need to type the `?src=qr` part anywhere — the script adds it
automatically, invisibly, as part of the address it encodes. It's how
the system later tells "this scan came from a QR code" apart from "this
scan came from an NFC tap" on the analytics dashboards. You don't need
to understand it beyond that; just know the script handles it.

---

## Writing the NFC tag (if the plate is NFC) — full walkthrough

This is the part you said you're not familiar with, so here's every
step. You'll need a phone with NFC (basically any modern Android or
iPhone) and a free app called **NFC Tools** (search for it on the
Play Store or App Store — the icon is blue with a white "N").

1. **Install and open NFC Tools.**
2. On the home screen, tap **Write**.
3. Tap **Add a record**.
4. You'll see a list of record types — tap **URL/URI**.
5. Type in the plate's full web address, **but add `?src=nfc` at the
   end** — this is the part that's easy to miss and important not to
   skip:
   ```
   https://nfc-side-hustle.vercel.app/r/34mbqr?src=nfc
   ```
   (Same reasoning as the QR script above — this is what tells the
   system a scan came from tapping, not scanning. If you leave it off,
   the tap will still work and redirect the customer fine, it just
   won't show up correctly on the "by channel" breakdown in analytics.)
6. Tap **OK**, then tap **Write**.
7. Hold your phone against the physical NFC plate/card — usually the
   back of the phone, roughly where the camera is, held steady against
   the card for a second or two.
8. NFC Tools will show a success message once it's written. You can
   tap **Read** and scan the same card afterward to double-check it
   shows the URL you expect, including the `?src=nfc` at the end.

That's it — the plate is now live. Tapping a phone to it will open that
exact address.

---

## If the business has multiple locations (branches)

If this business has more than one physical location and you want each
one's plate to send customers to a *different* Google review page (per
branch, not the business's main one):

1. On **Businesses**, open that business and use **Add branch** to
   create the location (name + its own Google review URL).
2. Back on **Plates**, find that plate's card and use the **Branch**
   dropdown to assign it to that specific branch.

If you don't do this, every plate for that business just uses the
business's main Google review URL — which is exactly right for a
single-location business, so most of the time you can skip this
entirely.

---

## If something's wrong after the fact

- **Wrong capability recorded for a whole batch** (e.g. you marked 20
  units as QR but they're actually NFC): on the **Plates** page, use
  **Fix capability for all N** on the unassigned group — no need to
  fix them one at a time.
- **Printed/wrote the wrong URL, or need to reprint**: no problem — the
  plate's slug never changes once assigned, so you can regenerate the
  QR (`npm run qr:generate -- <slug>`) or rewrite the NFC tag with the
  same address any time. Nothing on the system side needs to change.
- **Business wants to pause the plate temporarily** (e.g. they're
  closed, or a dispute): on **Plates**, hit **Suspend** on their card.
  Scanning it will show a "temporarily paused" message instead of
  redirecting, until you hit **Reactivate**.
- **A plate isn't working / shows "hasn't been activated yet"**: that
  message means the plate was never assigned to a business — go
  assign it, or double check you wrote the right slug onto the
  physical unit.
