---
name: Review Card Dashboard
description: QR/NFC review-card management and scan analytics — a plain, credible SaaS dashboard.
colors:
  bg: "#f4f5f7"
  surface: "#ffffff"
  surface-sunken: "#eef0f3"
  border: "#e3e6ea"
  border-strong: "#cfd4db"
  ink: "#14171f"
  ink-secondary: "#565d6b"
  ink-muted: "#6b7280"
  ink-on-accent: "#ffffff"
  accent: "#157a53"
  accent-strong: "#0f6142"
  accent-soft: "#e3f3ec"
  accent-soft-ink: "#0f6142"
  danger: "#b02a2a"
  danger-soft: "#fbeaea"
  danger-border: "#eecaca"
typography:
  body:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Hanken Grotesk, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "40px"
  8: "56px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-soft-ink}"
    rounded: "{rounded.pill}"
    padding: "3px 12px"
---

# Design System: Review Card Dashboard

## Overview

**Creative North Star: "The Plain Fintech Dashboard"**

This is the category-standard SaaS dashboard, executed at full craft rather than reinvented. The owner was offered two named cultural-concept directions — a Manila wet-market "price tag" world and a "receipt ledger" world — and a competitive challenger ("Jet-Age Ticket Wallet"), and explicitly chose the plain, familiar SaaS-dashboard register instead, held to the craft bar of Oripio, a fintech-dashboard reference screenshot. The build honors that choice: a white/light-gray ground, rounded cards on a soft offset+blur shadow, one restrained green accent, and a white sidebar with a green active-nav state. Nothing here performs a theme; it reads as a professional tool a small-business owner would trust enough to pay for.

Density is calm rather than enterprise-dense — generous card padding (24px), an 8-step spacing scale used consistently, and stat numbers set large enough to read at a glance. Tabular numerals appear on every count so scan totals in tables and stat cards line up predictably. No decorative device (illustration, gradient, background texture) exists anywhere in the build; the only color note allowed to stand out is the single green accent.

**Key Characteristics:**
- Light, flat ground (`#f4f5f7`) with white surfaces raised on a real offset+blur shadow, never a flat glow
- One accent color only (`#157a53`), used sparingly: active nav, primary buttons, accent badges, chart line, focus ring
- Rounded-pill primary/secondary buttons and badges; large-radius (18px) cards; small-radius (8-12px) inputs and nav items
- Hanken Grotesk throughout, no secondary/display typeface
- Tabular numerals on every stat value and every numeric table column

## Colors

A near-monochrome neutral scale carries the interface; the single green accent is reserved for state and emphasis, never decoration.

### Primary
- **Signal Green** (`#157a53`): the one accent. Used on the sidebar's active-nav background (paired with `accent-soft`), primary buttons, the chart line, focus-visible outlines, and text selection. Its darker step, **Deep Green** (`#0f6142`), is the primary-button hover/pressed state and the ink color used on top of `accent-soft`.
- **Soft Green** (`#e3f3ec`): the accent's low-emphasis fill — active-nav background, accent badges, text-selection background.

### Neutral
- **Paper Gray** (`#f4f5f7`): the page background (`body`/`--color-bg`) — every screen sits on this, never on white.
- **Card White** (`#ffffff`): every raised surface — cards, the sidebar, inputs, the login card.
- **Sunken Gray** (`#eef0f3`): recessed fills — table-row hover, the range-picker pill track, scrollbar track, neutral badges.
- **Hairline** (`#e3e6ea`): the default border/divider color — card borders, table row dividers, sidebar border.
- **Hairline Strong** (`#cfd4db`): input borders and the scrollbar thumb — anywhere a border needs to read as interactive/structural rather than decorative.
- **Ink** (`#14171f`): primary text and headings.
- **Ink Secondary** (`#565d6b`): subtitles, field labels, nav-link default state.
- **Ink Muted** (`#6b7280`): the quietest text — table-header labels, meta text, empty-state copy. (Contrast against `Card White` was flagged and fixed during finish review; this is the corrected value.)

### Status
- **Danger** (`#b02a2a`) on **Danger Soft** (`#fbeaea`) with a **Danger Border** (`#eecaca`): the only non-neutral, non-accent color pairing in the system, reserved for error banners, danger badges, and the logout button's hover state.

### Named Rules
**The One Accent Rule.** Green (`#157a53`/`#0f6142`/`#e3f3ec`) is the only color besides ink/neutral/danger anywhere in the UI. It marks state (active, primary action, focus) — it is never used for decoration or to differentiate content that isn't actually the primary action.

## Typography

**Body/Display Font:** Hanken Grotesk (with `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` fallback)

**Character:** A single well-crafted grotesque carries the whole system — no serif, no mono, no second display face. Weight and size do the differentiating work instead of a font-pairing.

### Hierarchy
- **Page title** (650, 22px, 1.2): the `AppShell` header — one per screen, names the page.
- **Card/section title** (650, 15px, 1.2): `Card` component titles, chart/table section headings within analytics views.
- **Stat value** (700, 28px, tabular numerals, -0.02em): the large number in a `StatCard` — the single largest text on any dashboard screen.
- **Body** (400, 15px base / 14px in forms & tables, 1.5): default running text, form inputs, table cells.
- **Label** (600-650, 12-13px, table headers uppercase with 0.02em tracking): field labels, table column headers, stat labels, sidebar section labels.

### Named Rules
**The Numerals-Line-Up Rule.** Every numeric value that represents a count (stat cards, table scan-count columns) uses `font-variant-numeric: tabular-nums`, applied globally to `table` and explicitly on `StatCard`'s value. Counts must always align in a column; this is non-negotiable for a dashboard whose whole job is showing numbers at a glance.

## Layout

Two layout modes only: the centered pre-auth login card, and the post-auth sidebar shell — no third pattern exists.

**Login (`/`, unauthenticated):** a single card (max-width 380px) centered in the viewport on the `--color-bg` ground, padding `40px 32px`, gap `32px` between blocks.

**Authenticated shell (`AppShell`, every `/admin/*` and `/dashboard` route):** a fixed 240px white sidebar (brand mark + label, nav list, identity+logout footer pinned via `margin-top: auto`) beside a content column capped at `max-width: 1120px` and horizontally centered within the remaining space, with `32px 40px` padding. Every authenticated page follows the same shape: `pageHeader` (title + optional subtitle + right-aligned actions) leads the content, then the page body — stat cards first, then tables/cards/chart.

**Responsive breakpoint:** a single breakpoint at `860px`. Below it, the sidebar collapses from a fixed left column to a static top bar: nav becomes a horizontally-scrolling row, the identity/logout footer moves inline next to the brand row, and content padding drops to `24px 16px`. This is the only responsive rule in the system — it is deliberate given the business_owner persona checks the dashboard from both phone and desktop.

**Spacing rhythm:** an 8-step scale (`4/8/12/16/24/32/40/56px`, `--space-1` through `--space-8`) used exhaustively — no arbitrary pixel values appear in component CSS outside this scale. Stat-card and business-card grids use `repeat(auto-fit, minmax(180-240px, 1fr))` rather than fixed column counts, so grids reflow naturally at any width instead of relying on the single breakpoint.

## Elevation & Depth

Surfaces are flat at rest against the page ground and lift with a real offset+blur shadow — never a flat glow, per the direction contract's explicit shadow comment (`/* Shadows (always an offset + blur, never a flat glow) */`).

### Shadow Vocabulary
- **`shadow-sm`** (`0 1px 2px rgba(20,23,31,0.06)`): the default resting elevation for every card, stat card, business card, and table/chart card — a bare 1px hint of lift, structural rather than dramatic.
- **`shadow-md`** (`0 8px 24px rgba(20,23,31,0.08), 0 2px 6px rgba(20,23,31,0.05)`): reserved for the single highest-emphasis surface on a page — the login card, and the active-range-pill within the date-range switcher.

### Named Rules
**The Structural Shadow Rule.** Shadow depth tracks a surface's role in the hierarchy (login card and active pill get `shadow-md`; every ordinary content card gets `shadow-sm`), not decoration or hover flourish. There is no hover-lift/scale animation anywhere in the build.

## Shapes

Radius scales with a surface's size: the bigger the surface, the bigger the round. Cards and the login card use the largest radius (18px); buttons, badges, nav pills, and the range-picker use full pill radius; brand marks and inputs use the smallest radii (8-12px). Borders are always 1px and always the neutral `Hairline` or `Hairline Strong` color — no colored borders except the danger banner's border. Every raised surface pairs a 1px border with its shadow; the border is what keeps a `shadow-sm` card legible against the light `Paper Gray` ground.

## Components

### Buttons
- **Shape:** full pill radius (999px), `12px 24px` padding (`8px 16px` for the `buttonSmall` variant used in inline admin forms).
- **Primary:** `Signal Green` background, white text, weight 650. Hover darkens to `Deep Green`.
- **Secondary:** white background, `Ink` text, `Hairline Strong` 1px border. Hover fills `Sunken Gray`.
- **Disabled/pending:** opacity 0.65, `cursor: default`, `pointer-events: none` — every submit button in the build is the shared `SubmitButton` client component (`useFormStatus()`), which disables itself and swaps its label to a "…ing…" pending label during a Server Action submit. This is a system-wide rule, not a per-form choice.
- **Logout button:** ghost variant — transparent background, `Ink Secondary` text; hover shifts to `Sunken Gray` background and `Danger` text, signaling a destructive-adjacent action without a permanent red state.

### Badges
- **Shape:** full pill radius, `3px 12px` padding, 12px/650-weight text.
- **Tones:** `neutral` (Sunken Gray bg / Ink Secondary text), `accent` (Soft Green bg / Deep Green text), `danger` (Danger Soft bg / Danger text). No other tone exists.

### Cards / Containers
- **Corner Style:** 18px radius, consistent across `Card`, `StatCard`, the business-management cards, and chart/table cards.
- **Background:** always `Card White` on the `Paper Gray` page ground.
- **Shadow Strategy:** `shadow-sm` at rest (see Elevation & Depth).
- **Border:** 1px `Hairline`.
- **Internal Padding:** `24px` (`--space-5`), uniform across every card variant in the build.

### Inputs / Fields
- **Style:** `Hairline Strong` 1px border, white background, 8px radius, `12px` padding, 14px text, full width within its field wrapper. Field label sits above the input in `Ink Secondary`, 13px/600.
- **Focus:** 2px `Signal Green` outline with 1px offset, border shifts to `Signal Green` — the same treatment as the global `:focus-visible` rule, so keyboard focus is consistent everywhere, not just in forms.
- **Error:** a page-level `errorBanner` (danger-soft background, danger border, danger text) precedes the form rather than inline per-field error states — no inline field-error pattern exists in the shipped build.

### Navigation (sidebar)
- **Style:** white sidebar, `Hairline` right border, nav links at 14px/550 weight in `Ink Secondary`.
- **Default/hover:** hover fills `Sunken Gray` and darkens text to `Ink`.
- **Active:** `Soft Green` background, `Deep Green` text, plus a small filled dot (`currentColor`, 6px circle) that is invisible (opacity 0) on inactive links and only appears active — the dot is a state indicator, not a bullet/decoration.
- **Mobile (below 860px):** the sidebar becomes a static top bar; the nav list rotates to a horizontally-scrolling row of pill-like links instead of a stacked list.

### Data tables
- **Style:** borderless-looking table (`border-collapse: collapse`), 14px body text, uppercase 12px/650 `Ink Muted` column headers with 0.02em tracking, 1px `Hairline` row dividers (no divider under the last row), row hover fills `Sunken Gray`.
- **Numeric columns:** right-aligned via `data-align="right"`, tabular numerals.
- **Empty state:** a single muted 14px line ("No businesses yet.") in place of the table — no illustration or empty-state graphic.

### Date-range switcher (signature component)
A pill-track segmented control (`Sunken Gray` track, 4px padding) used identically on both dashboard-detail screens to switch the analytics window between 7/30/90 days. The active option is a white pill with `shadow-md` floating inside the sunken track — the one place in the system a shadow reads as "selected," not just "raised."

## Do's and Don'ts

### Do:
- **Do** keep the accent to green only (`#157a53`/`#0f6142`/`#e3f3ec`) — no second accent color, ever, without an explicit new direction decision.
- **Do** use `shadow-sm` + `Hairline` border together on every card-like surface; never shadow without border or border without shadow.
- **Do** use tabular numerals on any new numeric/count display — this is load-bearing for a scan-count dashboard.
- **Do** route every new form submit button through the shared `SubmitButton` component so pending state is automatic, not something each new form has to remember.
- **Do** keep the single 860px breakpoint as the only responsive decision point; collapse sidebar-to-top-bar rather than introducing a hamburger/off-canvas pattern.
- **Do** cap authenticated content at `1120px` max-width, matching the existing `AppShell` content column.

### Don't:
- **Don't** introduce a second typeface, decorative display face, or serif — Hanken Grotesk carries the whole system by design.
- **Don't** add gradients, background textures, illustration, or photography — none exist in the build and PRODUCT.md explicitly warns against fabricating brand assets that don't exist yet (no logo, no photography, no placeholder "trusted by" rows).
- **Don't** use flat/glow-only shadows — the direction contract is explicit that shadows are always offset + blur.
- **Don't** invent a themed visual concept (market/ledger/ticket motifs) on any new surface — the owner explicitly declined all three in favor of this plain register; that decision is durable per PRODUCT.md, not open by default.
