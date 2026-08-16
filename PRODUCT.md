# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two personas:
- **platform_admin** (the project owner) — manages all businesses,
  branches, and cards from an admin section (`/admin/*`) on a laptop/
  desktop. Creates a business, its branches, and its QR/NFC cards, and
  reviews scan analytics across the whole platform.
- **business_owner** — the owner/staff of a single local business
  (e.g. Saffron Middle Eastern Restaurant, the one real business on the
  platform today) with a scoped login to their own `/dashboard`, showing
  only their own business's scan activity. Checks this from **both
  mobile and desktop** — confirmed with the owner, not assumed.

## Product Purpose

Drive more Google reviews for small local businesses via a frictionless
physical QR/NFC card: a customer scans it, a scan event is logged, and
they're redirected straight to the business's Google review page — no
login, no app install, no extra steps for the customer. The admin/owner
side exists to manage these cards and see how much engagement they're
generating over time (scan counts, trends, per-branch/per-card-type
breakdowns).

## Positioning

A lightweight, single-purpose alternative to enterprise review-
management SaaS, aimed at small local businesses (the current real
example, Saffron, is near DLSU Manila) that don't need — or can't
justify the cost of — a full reputation-management platform. This is a
**paid service** (planned, possibly already in motion) — the owner
confirmed the UI should read as a credible, professional product a
business owner would trust enough to pay for, not a hobby-project look.

## Operating Context

A physical printed QR (eventually NFC) card sits in the business's
physical location; a customer scans it with their own phone in the
moment, redirected instantly to leave a review. The platform_admin
manages the whole platform from an admin section. A business_owner
checks their own scan dashboard casually, from whatever device is
nearest — phone between customers, or a desktop/laptop at a desk —
both matter equally, confirmed by the owner rather than assumed
mobile-first or desktop-first.

## Capabilities and Constraints

- Fully built and shipped: QR scan tracking + redirect (`/r/[slug]`),
  multi-business admin CRUD, an analytics dashboard (time-series chart,
  card-type breakdown), real accounts with sessions (`platform_admin`/
  `business_owner` roles, no more Basic Auth), and multi-branch
  locations (a business can have several physical branches, each with
  its own Google review URL and its own scan breakdown). This redesign
  is a **visual/UX pass layered on a stable, working product** — routes,
  data model, and business logic are not changing.
- Once a QR code is printed and handed to a business, its target URL
  (its `slug`) is permanent — can't be recalled or changed after the
  fact.
- No delete-business or delete-card flow exists yet.
- Stack: Next.js 16 (App Router), Neon Postgres, Drizzle ORM, deployed
  on Vercel. No CSS framework/design system currently in place — all
  existing UI is plain, unstyled inline-HTML.
- One real business today: Saffron Middle Eastern Restaurant (slug
  `saffron`), which does not yet have an owner account linked.

## Brand Commitments

No public-facing product name or logo has been chosen yet.
"NFC Side Hustle" is the internal/repo name only — the owner
deliberately chose **not** to treat it as the real product name for
this design pass, to avoid inventing a brand identity that hasn't
actually been decided. Use a generic, unbranded wordmark/treatment for
now rather than designing around that name.

**Standing visual-direction preference (confirmed via `/impeccable`
new-work decision round):** the owner took the canon/standing-exit
path over two named cultural-concept directions (a Manila wet-market
"price tag" world and a carbon-copy "receipt ledger" world) —
deliberately choosing the plain, familiar SaaS-dashboard category
standard, executed at full craft, rather than a themed visual concept.
Craft-level reference: **Oripio** (the fintech-dashboard screenshot
the owner shared) — white/light-gray ground, rounded cards with soft
elevation shadow, a green accent, a white sidebar with a green
active-nav state, clean data tables. This is a durable preference: any
future new surface on this project should default to this same
restrained, familiar SaaS register rather than reopening a
concept-direction round, unless the owner explicitly asks to revisit
it.

## Evidence on Hand

Saffron Middle Eastern Restaurant is the only real business on the
platform. No logo, photography, or brand assets exist for it or for
the platform itself. No testimonials, customer logos, press mentions,
or case studies exist anywhere — none should be fabricated or implied
by the design (e.g. no placeholder "trusted by" logo rows).

## Product Principles

1. **Frictionless for the end customer.** The actual scan-to-review
   flow (`/r/[slug]`) is public and unauthenticated by design — nothing
   in this redesign touches or adds friction to that path.
2. **Credible enough to pay for.** As a paid (or soon-to-be-paid)
   service, the admin and owner-facing UI should read as a trustworthy,
   professional product — not a hobby project or an internal tool.
3. **Works equally well on mobile and desktop** for the business_owner
   persona specifically — confirmed, not assumed.
4. **Built for small local businesses, not enterprise.** Avoid
   enterprise-SaaS density/complexity — a non-technical restaurant
   owner should understand their own dashboard at a glance.
5. **Preserve what's already shipped.** V1-V5 are complete, reviewed,
   and live in production. This is a visual/UX layer on top of stable
   functionality, not a rebuild — data, routes, and behavior don't
   change because of this pass.

## Accessibility & Inclusion

No formal standard has been established. In practice, the audience
includes non-technical small-business owners checking a dashboard on
both mobile and desktop, so solid contrast, readable type at small
sizes, and a genuinely responsive (not just "shrinks okay") layout
matter even without a named compliance target.
