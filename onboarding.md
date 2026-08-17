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

You only need to do this once per shipment, not per sale. **NFC and QR
work differently here** — read the one that matches what you actually
ordered.

### NFC stock (this is what the current 20-unit order is)

1. Log in at `nfc-side-hustle.vercel.app` and go to **Inventory**.
2. Fill in **Record inventory arrival**: a name for this batch (e.g.
   `02`), capability **NFC only**, how many units, and what you paid
   per unit. Leave "Pre-made slugs" blank.
3. Click **Record arrival**. This creates that many blank, unassigned
   plates in the system — nothing is written to a physical chip yet,
   this just tells the system "we have N of these to sell." The system
   picks a random code for each one; it doesn't matter what it is,
   since you write the real address onto the chip yourself at sale
   time (see the NFC section below).

### QR (or combo) stock — do this BEFORE placing the order

QR plates are different: the manufacturer prints/etches the QR code
into the acrylic at the factory, so the code has to be decided and
handed to the supplier *before* they print anything — you can't
generate it afterward like you can with NFC.

1. **Before ordering**, from your computer, run:
   ```
   npm run qr:generate-order -- 50
   ```
   (replace `50` with however many units you're ordering)
2. This creates a folder under `qr-codes/orders/` with two files:
   - `supplier-urls.txt` — the actual URLs to send the supplier so they
     print/etch the right thing onto each unit
   - `slugs.txt` — the same codes, without the full URL — **keep this
     one**, you'll need it in step 5
3. Send `supplier-urls.txt`'s contents to the manufacturer as the list
   of what to print, one per unit.
4. Wait for the order to arrive.
5. Once it's physically in hand: log in, go to **Inventory**, fill in
   **Record inventory arrival** as usual (batch name, capability
   QR/combo, unit cost) — but this time, open `slugs.txt` from step 2
   and paste its contents into **Pre-made slugs**. Quantity fills in
   automatically from however many lines you pasted; you don't need to
   type it separately.
6. Click **Record arrival**. The plates created now match exactly
   what's already printed on the physical units — nothing more to
   write, they're ready to hand out as-is.

If you ever record an arrival with the wrong slug list by mistake, it's
not catastrophic — those plate rows just won't match anything physical
and can be ignored or deleted; nothing was actually printed based on
what you entered here, since the printing already happened before this
step.

You can see stock waiting on the **Plates** page either way, grouped
together as "N unassigned plates" under that batch.

---

## At the sale: assigning a plate to the business

You've just convinced a local business to take a plate. Here's what to
do, in order.

### 1. Is this a business you've already entered, or a brand new one?

**New business** → go to **Businesses** → **Add a business**. Fill in:
- **Business name** — what shows up everywhere in the admin (e.g. "Golden
  Wok Restaurant")
- **Google review URL** — the link that opens their Google review box
  directly. The easiest way to get this: search the business on Google
  Maps, click "Write a review," and copy the URL from that page.
- **Owner email / password** (optional, can add later) — only fill
  this in if you're also setting them up with dashboard login access
  right now. Skip it if you're not ready to do that yet.

Click **Add business**. This creates the business only — no plate yet,
nothing to ignore or clean up. The actual plate you hand to the
customer comes from your tracked batch stock in step 2 below.

**Existing business** (e.g. selling them a second plate for another
location) → you don't need to do anything here, just find them on the
**Businesses** page when you get to step 2.

### 2. Assign a plate

Go to **Plates**. Find the unassigned group matching what you're
physically holding (same capability — QR, NFC, or combo — and ideally
the right batch).

Fill in the **Assign one to business** row:
- **Choose a business** — pick the one from step 1
- **Specific slug (optional)** — for NFC, leave this blank; it doesn't
  matter which physical chip you grab, since you write the address onto
  it afterward. **For pre-printed QR, fill this in** with the exact
  code already printed on the unit you're physically handing over —
  otherwise the system might pick a *different* slug from the group
  than the one on the card in your hand, and the QR you hand over won't
  actually work. Read it off `slugs.txt`/`supplier-urls.txt`, or scan
  the physical code with your phone to see it.
- **Sale price (₱)** — what they actually paid. This is required now —
  you can't submit without it. It's what makes the revenue/profit
  numbers on the Inventory page mean anything, so don't skip it or
  round it off.

Click **Assign**. If you left the slug blank, the system picks any
plate out of that group for you. If you filled it in, it assigns that
exact one — and fails cleanly (with a clear error) if that slug is
already taken or doesn't exist in this group, rather than silently
assigning a different one.

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

## QR-capability plates — how the printing actually works

This depends on one thing being true: **the supplier agrees to print a
QR code you provide, per unit, instead of their own random one.** A lot
of suppliers for this exact product will do this if you send them the
URL list before they print — worth confirming with yours before
ordering. If they can't or won't do this, the "Before you're in the
field" QR steps above don't apply and this needs a different plan (ask
what their own random QR actually does when scanned, and whether
there's any way to configure its destination).

Assuming they can: the whole thing is already built and tested. The
short version, already covered step by step above:
1. `npm run qr:generate-order -- <count>` **before** ordering — this
   decides the codes and gives you the URL list to hand the supplier.
2. Send them `supplier-urls.txt`. They print/etch it into the acrylic.
3. When it arrives, record the arrival on `/admin/inventory` using
   `slugs.txt`'s contents in the **Pre-made slugs** field — this
   creates plate rows matching exactly what's already printed, nothing
   left to write by hand.
4. From there, selling a QR plate to a business works exactly like NFC:
   find its group on **Plates**, assign it, done. The only difference
   from NFC was in getting the physical unit correctly provisioned in
   the first place — there's no separate "print a QR" step at sale
   time the way there is for QR generated on your own computer.

The old, no-longer-recommended path (`npm run qr:generate -- <slug>` +
printing/sticking a paper QR onto a plate yourself) still exists and
still works correctly if you ever need a one-off, DIY QR for something
that isn't a supplier-manufactured acrylic plate — just not for the
real product line.

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
