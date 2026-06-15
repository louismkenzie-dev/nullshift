# Nullshift Design System

> Luxury, tech-focused, futuristic, industrial. Dark, precise, intentional.
> **Web development & brand creation** — built with intention.

Nullshift is a UK-based web & brand studio that designs and builds fast, bespoke
websites, brand identities, and custom business systems (booking, CRM, client
portals, automations) for businesses "doing the work." Their own product surfaces —
a marketing site and an internal admin CRM — run on the **Halo UI System**, a dark,
three-tier architectural system with a single emerald brand colour. This design
system packages that visual language so any agent can produce on-brand Nullshift
work.

---

## The three principles

1. **Dark architectural system.** Three surface tiers — `background → surface →
   elevated`. Components live at their tier. No arbitrary depth or shadow stacking;
   only modals get drop shadows. Hairline 1px borders define geometry.
2. **One brand colour, used precisely.** Emerald `#10B981` is reserved for actions:
   CTAs, focus rings, active states, the brand dot. Signal colours (danger, warning,
   success, info) are for **status only** — never decoration.
3. **Typography as structure.** Inter 600 for all headings — sentence case, `-0.03em`
   tracking, `1.04` line-height, never weight 900. Layout communicates hierarchy
   before colour does.

---

## CONTENT FUNDAMENTALS

How Nullshift writes. The voice is **confident, plain-spoken, and anti-fluff** — a
craftsperson who respects your time.

- **Person.** Talks as **"we"** (the studio), addresses the reader as **"you"** /
  "your business." Warm but direct: *"We learn your business, your goals, and your
  customers. No assumptions — just honest conversation."*
- **Casing.** Headlines and UI are **sentence case** ("What we do.", "The process.",
  "Ready to go online?"). Section eyebrows and mono system markers are **UPPERCASE**
  ("// 02 — COLOUR PALETTE", "05 — WHY US"). The wordmark **NULLSHIFT** is all-caps.
- **Punchy triads & full stops.** Short declaratives, often in threes, terminated
  with a hard period for rhythm: **"No templates. No bloat. No nonsense."** Headlines
  frequently end in a full stop even when fragments.
- **Mono for system truth.** Reference IDs, prices, tags, timestamps, and "code
  markers" (`// INBOX`, `CUSTOM_BUILD / NO_TEMPLATES`) are set in JetBrains Mono —
  it signals precision and engineering.
- **Concrete promises, no hype.** "Fixed pricing. No hidden fees.", "Most projects
  delivered in 2–4 weeks.", "Response within 24 hours." Numbers over adjectives.
- **British spelling** — colour, optimise, organisation.
- **No emoji.** Status is shown with dots, mono badges, and signal colour — never
  emoji. Iconography is geometric glyphs, not illustration.
- **Vibe:** industrial precision meets restraint. Every word earns its place;
  whitespace and a near-black canvas do the rest.

Example copy lifted from the product:
> *"We build more than websites. From bespoke booking systems and automated email
> campaigns to interactive courses and custom workflows, we create digital solutions
> tailored to your brand."*

---

## VISUAL FOUNDATIONS

**Colour & vibe.** Cool near-black canvas (`#0A0B0F`) — never pure black. Everything
lives in a near-black → grey → off-white range, punctuated by a single emerald. The
mood is dark, engineered, premium. Imagery (when used) skews cool and low-key; a
faint fractal **noise layer** (`.ns-noise`, 2.5% opacity) sits over the canvas for
texture. Radial emerald **glows** (5–7% opacity) pool behind hero and "why us"
sections.

**Surfaces.** Three tiers only: `--bg` (page) → `--surface` `#14151C` (cards, panels,
inputs, nav) → `--elevated` `#1E2029` (modals, dropdowns, active tabs, hover state).
Components never invent intermediate greys.

**Type.** Inter for everything visible; JetBrains Mono for system text. Headings:
Inter 600, sentence case, `-0.03em`, `1.04` line-height. Body: Inter 400/500, `15px`
base, `1.55` line-height, `-0.005em`. Eyebrows: uppercase sans, `0.08em`, with an
emerald dot. Mono markers: `// 01 — SECTION`.

**Borders & geometry.** **1px hairline borders carry the design.** `--border`
`#2A2D38` for dividers and card outlines; `--border-strong` `#3A3D4A` for inputs and
secondary buttons. Bordered grids (services, process, why-us) are a signature — cells
divided by hairlines, not gaps. No heavy rules, no coloured left-accent borders.

**Corner radii.** `sm 6` (badges) · `md 10` (buttons, inputs, chips) · `lg 16`
(cards, panels) · `xl 24` (hero cards, modals) · `full` (pills, dots, avatars).

**Cards.** Surface fill, 1px `--border`, **no shadow**. The featured card in a set
gets an emerald edge (`highlighted`) — a 38%-mixed border plus a 1px emerald
inner-ring; pricing's hero plan adds a 2px emerald top accent line and glow. Hover on
interactive cards lifts the fill to `--elevated` and strengthens the border.

**Shadows.** Restrained and reserved. `--shadow-sm/md` exist but only modals/popovers
earn `--shadow-lg`. Drop shadows are not used to separate flat content — borders do
that.

**Buttons.** Primary = emerald fill + `--inset-top-light` (a 1px top highlight),
brightens to `--primary-hover` `#34D399`. Secondary = transparent + `--border-strong`.
Ghost = transparent, muted → fg on hover. Destructive = danger text + danger border.
40–48px tall, `--radius-md`, sentence case, sans (never mono on buttons). One primary
per view.

**Focus & states.** Focus ring is always emerald: `0 0 0 3px rgba(16,185,129,.30)`.
Hover = lighter fill / brighter colour (never darker). Press on links nudges
`translateY(1px)`. Selection highlight is emerald at 25%.

**Animation.** Subtle and quick. Durations `120/150/240ms`, easing
`cubic-bezier(0.2,0.6,0.2,1)`. Fades and short slides — no bounce. The two named
motifs: the **hero-glow** brightness pulse (3.6s) on emerald headlines, and the
**pulse-dot** live indicator (2.5s). Honour `prefers-reduced-motion`.

**Transparency & blur.** Nav and overlays use backdrop blur — `blur(14px)` for the
condensed nav, `blur(20px) saturate(130%)` for modal overlays. Tints are
`color-mix`ed emerald/signal at low alpha (`--primary-soft` etc.), never opaque.

**Layout.** `1200px` max container, fluid `clamp(20px, 4vw, 48px)` padding. Nav 64px
(marketing) / 56px (admin). Bordered, full-width section bands stacked vertically.

---

## VISUAL LANGUAGE / signature graphics

The brand book names two abstract motifs — a **Gyroscope** (gimbal rings + glass band
+ mirror core: craft, precision, motion) and a **Neural sphere** (icosphere node
network in a glass cage: systems, intelligence, connection). These are thin-line,
emerald-on-dark line art. They aren't shipped as assets here; recreate as fine
emerald strokes on the near-black canvas if a hero needs a graphic, or request the
source SVGs from the brand owner.

---

## ICONOGRAPHY

Nullshift's icon language is **geometric, monospace-flavoured glyphs** rather than a
drawn icon set. In the live admin, nav items use Unicode geometric shapes as markers
(`○ ◫ ◈ ◇ ◻`) set in JetBrains Mono — terse, technical, on-brand. Status uses small
**dots** (filled circles) + mono labels, not pictograms. Arrows are literal `→`
glyphs. The pricing checklist uses `✓` / `✕` in tinted circular chips.

- **No emoji, ever.** No multi-colour icon sets, no skeuomorphism.
- **When a richer icon is genuinely needed** (e.g. a Lucide-style line icon in a
  marketing feature), match a **1.5px stroke, rounded-join, currentColor** outline
  icon — [Lucide](https://lucide.dev) is the closest CDN match to the brand's
  thin-line aesthetic. Tint with `--muted` or `--primary`; never fill. *(Substitution
  — the brand has no bundled icon font; flag if you adopt Lucide so the owner can
  confirm.)*
- The **logo mark** (two parallel pills, light + emerald) is the one fixed brand
  glyph — see `assets/logos/`.

---

## Assets

`assets/`
- `logos/nullshift-mark.svg` — the parallel-pill mark, transparent (light + emerald).
- `logos/nullshift-mark-app.svg` — app icon: mark on a `36px`-radius near-black tile.
- `fonts/` — real brand binaries: Inter (Latin + Latin-Ext, variable 400–900) and
  JetBrains Mono (Latin + Latin-Ext, 400–600), lifted from the codebase.

The full lockup (mark + wordmark) is the **`Logo`** component, not a static file —
the wordmark is live Inter 600 text so it stays crisp at any size. Rules: min width
120px, clear space = mark width, near-black backgrounds only, never recolour the
emerald pill, never rotate / re-letter.

---

## Index / manifest

**Foundations** (`tokens/`, all `@import`ed by root `styles.css`)
- `colors.css` · `typography.css` · `spacing.css` · `effects.css` · `fonts.css` ·
  `base.css` (body defaults + `.ns-eyebrow`, `.ns-marker`, `.ns-hero-glow`,
  `.ns-pulse-dot`, `.ns-noise`, heading helpers).

**Components** (`components/`) — React, consumed via
`window.NullshiftDesignSystem_7b523b`
- `brand/` — `Logo`, `LogoMark`
- `buttons/` — `Button` (primary · secondary · ghost · destructive · 3 sizes)
- `core/` — `Card`, `Badge`, `Tag`, `Eyebrow`, `Avatar`
- `forms/` — `Input`, `Textarea`, `Switch`
- `navigation/` — `Tabs` (underline · pill), `Dropdown`
- `feedback/` — `Toast`, `ToastViewport`
- `data/` — `StatCard`, `PricingCard`

**UI kits** (`ui_kits/`)
- `marketing/` — full marketing site + interactive brief modal.
- `admin/` — internal CRM dashboard with drawer nav + table view.

**Guidelines** (`guidelines/`) — specimen cards that populate the Design System tab
(Type, Colors, Spacing, Brand).

**Specimen / spec source.** `uploads/brand-guidelines.pdf` is the original brand book;
its renders are in `uploads/brand-page-*.png`.

---

## Sources

Built from material the Nullshift owner provided. Explore these to build richer,
more faithful Nullshift work:

- **Codebase:** `https://github.com/louismkenzie-dev/nullshift` — a Next.js + Tailwind
  app. Key files studied: `app/globals.css` & `lib/tokens.ts` (the token system),
  `app/brand/page.tsx` (the on-site brand book), `components/Logo.tsx`,
  `components/ui/button.tsx`, `components/Nav.tsx`, `components/PricingCard.tsx`,
  `app/page.tsx` (marketing home), `app/admin/(dashboard)/page.tsx` & `AdminNav.tsx`
  (the CRM). Real fonts and logo SVGs came from `public/fonts/` and `public/logos/`.
- **Brand book:** `uploads/brand-guidelines.pdf` (provided).
- **Logos:** `uploads/Pill Logo Only@4x.png`, `uploads/Artboard 1@4x.png` (provided).

> Note on fonts: the shipped webfont binaries are Latin + Latin-Extended subsets of
> the brand's own Inter / JetBrains Mono files — full English coverage. If you need
> wider Unicode coverage, pull the complete families from the codebase `public/fonts/`
> or Google Fonts.
