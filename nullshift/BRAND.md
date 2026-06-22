# Nullshift — Brand & Design System

> **Single source of truth.** Paste this whole file (or the relevant section) into
> Claude Design, v0, Cursor, Figma AI, or any other tool to keep everything
> on-brand. It documents the system **as actually shipped** on nullshift.co.uk.
> Companion machine-readable tokens: [`design-tokens.json`](./design-tokens.json).
>
> Last updated 2026-06-22 · UK English throughout.

---

## 0. One-paragraph brief (paste this to start any tool)

> Nullshift is an **agentic-AI automation partner**. Design language is a bold,
> editorial, "AI-automation-agency" look: **near-black and warm-cream sections
> that alternate**, a single **emerald** accent (`#10b981`), **square corners
> everywhere** (no rounded anything except true circles), **UPPERCASE display
> headlines** set in **TASA Orbiter**, and **Roboto Mono** for all labels,
> eyebrows and numbers. Hairline 1px borders, generous whitespace, oversized
> numbers, mono `[01]`-style section markers, and subtle scroll-reveal motion.
> Confident and concrete, never fluffy. Think: a precision engineering studio
> that automates businesses with AI.

---

## 1. Brand essence & voice

**What we do.** Bring us any idea — or just a pain point — and we build the
**agentic AI** that automates the operational work draining a business's staff
cost, time and revenue ("leakage"). We find what to automate, we build it fast
with cutting-edge AI, we **carry the liability**, and we scale businesses past
the bureaucratic ceiling into exponential growth. **You own everything.**

**Positioning pillars** (use these as the message spine):

1. **Bring any idea, or just a pain point** — clients don't need a spec; our
   automation consultants deep-dive operations and find what to automate.
2. **A senior team + real AI R&D** — cutting-edge AI and agentic techniques,
   complex systems built fast and at low cost. "We build the systems others can't."
3. **Watertight — we carry the liability** — responsible for data breaches,
   security and compliance. Not a prototype you're left to defend.
4. **Scale past the ceiling** — automate the bottlenecks that funnel back to the
   founders; set the business up for exponential, not linear, growth.
5. **You own it** — code, data, every account. No per-seat fees, no lock-in.
6. **Move into the AI era — we do the how.**

**Voice & tone**

- Confident, direct, concrete. Short sentences. Active voice.
- Lead with the customer's pain and outcome, not our process.
- Specific over vague: "cut staff cost, time and leakage" not "drive efficiency".
- A little swagger is on-brand ("the systems others can't"); never arrogant or hypey.
- No emoji in product/marketing copy. No exclamation marks.
- **Use:** automate, agentic, own it, watertight, leakage, the ceiling, deep-dive,
  end to end, scale, operations, bespoke, fast, low cost.
- **Avoid:** "solutions", "synergy", "revolutionary", "cutting-edge" (overused —
  use sparingly), "world-class", generic AI hype, naming specific competitor tools.

**Casing**

- **Display headlines: UPPERCASE.** Highlight 1–2 keywords by wrapping them in
  `[brackets]` AND colouring them emerald, e.g. `ANY IDEA. ANY PAIN POINT.
[AUTOMATED] BY AI YOU [OWN].`
- **Eyebrows / labels / numbers: UPPERCASE**, Roboto Mono, letter-spaced.
- **Body & leads: sentence case.**

---

## 2. Logo & mark

**The mark.** Two staggered, rounded **pills** — one light grey, one emerald,
offset to suggest a _shift_ — paired with the **NULLSHIFT** wordmark.

**Assets** (`apps/web/public/logos/`):
| File | Use |
|---|---|
| `nullshift-pill-dark.svg` | Mark on dark — nav/footer (≈22–28px) |
| `nullshift-pill-light.svg` | Mark on light/cream |
| `nullshift-wordmark.svg` | Full lockup (mark + wordmark) — OG, slides |
| `nullshift-mark-dark.png` · `nullshift-mark-light.png` | Raster mark, hi-DPI |
| `nullshift-wordmark.png` | Raster lockup |

The wordmark text "NULLSHIFT" is set in the brand display face (TASA Orbiter, 800,
uppercase, ~-0.03em tracking). A "®" in Roboto Mono / muted grey may follow it.

**Do**

- Keep clear space of **at least the mark's width** on all sides.
- Minimum lockup width **120px**; minimum mark **18px**.
- Place on near-black (`#0a0a0a`) or cream (`#f4f4e8`).
- Keep the **light-pill / emerald-pill** colour relationship intact.

**Don't**

- Rotate, stretch or distort the mark or pills.
- Recolour the pills or change the scheme.
- Add effects (the only approved glow is the emerald `hero-glow` text effect).
- Place on busy or low-contrast backgrounds.
- Re-letter or recreate the wordmark.

---

## 3. Colour

One brand colour (**emerald**), reserved for **actions, accents and one
highlighted word per headline**. Everything else is the near-black ⇄ cream ⇄ grey
range. Signal colours are for **status only**, never decoration.

### 3a. The two section themes (marketing site)

Sections **alternate** cream and dark. Each theme is a set of CSS vars (`.k-cream`
/ `.k-dark`) so components auto-adapt. **This is the canonical brand palette.**

| Token               | Dark (`.k-dark`)        | Cream (`.k-cream`)   | Role                         |
| ------------------- | ----------------------- | -------------------- | ---------------------------- |
| `--k-bg`            | `#0a0a0a`               | `#f4f4e8`            | Section background           |
| `--k-fg`            | `#f4f4e8`               | `#0a0a0a`            | Primary text                 |
| `--k-muted`         | `#9a9a90`               | `#55554c`            | Secondary text               |
| `--k-faint`         | `#6a6a62`               | `#8a8a7e`            | Captions / meta              |
| `--k-surface`       | `#141414`               | `#ecece0`            | Cards / raised fills         |
| `--k-border`        | `rgba(244,244,232,.14)` | `rgba(10,10,10,.16)` | Hairline dividers            |
| `--k-border-strong` | `rgba(244,244,232,.28)` | `rgba(10,10,10,.32)` | Inputs, ghost buttons        |
| `--k-accent`        | `#10b981`               | `#10b981`            | Emerald — actions/highlights |
| `--k-accent-2`      | `#34d399`               | `#34d399`            | Emerald hover                |
| `--k-on-accent`     | `#04140d`               | `#04140d`            | Text on emerald fills        |

Rule of thumb: **dark hero**, then alternate cream/dark down the page. Functional
data widgets (calculators, dashboards) always sit on **dark**.

### 3b. App / auth surfaces (admin, portal, funnel)

These use the "Halo" token set (always dark). Same emerald, same square corners,
same fonts — just one fixed dark theme rather than alternating.

| Token                     | Value     | Role                         |
| ------------------------- | --------- | ---------------------------- |
| `--background` / `T.bg`   | `#0A0B0F` | App canvas (cool near-black) |
| `--surface` / `T.surface` | `#14151C` | Cards, inputs, nav           |
| `--elevated`              | `#1E2029` | Modals, dropdowns            |
| `--foreground` / `T.fg`   | `#F2F4F8` | Primary text                 |
| `--muted-foreground`      | `#9AA0AE` | Secondary text               |
| `--faint-foreground`      | `#5C6170` | Captions                     |
| `--border`                | `#2A2D38` | Hairline                     |
| `--border-strong`         | `#3A3D4A` | Inputs, ghost buttons        |

### 3c. Brand + signal colours (shared)

| Token                  | Value     | Use                                                                                                                     |
| ---------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `--primary`            | `#10b981` | **Emerald — the only brand colour.** CTAs, focus rings, active state, the brand dot, the one highlighted headline word. |
| `--primary-hover`      | `#34d399` | Hover                                                                                                                   |
| `--primary-pressed`    | `#059669` | Pressed                                                                                                                 |
| `--primary-foreground` | `#0A0B0F` | Text on emerald                                                                                                         |
| `--success`            | `#2BE08C` | Status only                                                                                                             |
| `--warning`            | `#F5D547` | Status only (e.g. "awaiting")                                                                                           |
| `--info`               | `#3DD7E5` | Status only                                                                                                             |
| `--danger`             | `#FF3A5C` | Status / "the bad number"                                                                                               |
| `--pill-light`         | `#D6D6D6` | The logo's light pill                                                                                                   |

**Colour rules**

- Emerald is **earned** — actions, focus, and **one** highlighted word/number per
  headline. Don't paint surfaces emerald.
- Hierarchy comes from **type and contrast**, not colour.
- Selection highlight: emerald at ~22% alpha.

---

## 4. Typography

Two faces. **Self-hosted, variable.**

| Face             | Role                                                           | Weights                                      | Casing                                        |
| ---------------- | -------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| **TASA Orbiter** | Display + body. The brand voice.                               | 400–800 (700 display, **800** giant numbers) | UPPERCASE for display, sentence case for body |
| **Roboto Mono**  | Eyebrows, labels, numbers, tags, nav status, button text, code | 400–600 (500 typical)                        | UPPERCASE, letter-spaced                      |

CSS: `--font-sans: "TASA Orbiter"`, `--font-mono: "Roboto Mono"` (both also
exposed as `T.sans` / `T.display` / `T.mono`). Fallbacks: TASA → Inter →
system-sans; Roboto Mono → ui-monospace.

### Type scale (px reference, fluid via clamp)

| Token                     | Size (min→max)                           | Weight  | LH        | Tracking    | Transform |
| ------------------------- | ---------------------------------------- | ------- | --------- | ----------- | --------- |
| Display `hero`            | `clamp(2.5rem, 6.4vw, 4.7rem)` ≈ 40→75px | 700     | 1.0       | -0.03em     | UPPERCASE |
| Display `xl`              | `clamp(2.4rem, 5.4vw, 3.9rem)`           | 700     | 1.0       | -0.03em     | UPPERCASE |
| Display `lg`              | `clamp(2rem, 4.4vw, 3rem)`               | 700     | 1.06      | -0.03em     | UPPERCASE |
| Display `md`              | `clamp(1.5rem, 2.8vw, 2rem)`             | 700     | 1.06      | -0.03em     | UPPERCASE |
| Display `sm` (card title) | `clamp(1.15rem, 1.7vw, 1.45rem)`         | 700     | 1.06      | -0.02em     | UPPERCASE |
| Giant number / stat       | `clamp(2.4rem, 5vw, 9rem)`               | **800** | 0.92–0.95 | -0.03em     | —         |
| Lead paragraph            | `1.0625–1.125rem`                        | 400     | 1.5       | -0.01em     | sentence  |
| Body                      | `0.9–0.95rem`                            | 400     | 1.5–1.55  | -0.005em    | sentence  |
| Eyebrow / label (mono)    | `0.7–0.74rem`                            | 500     | —         | **0.1em**   | UPPERCASE |
| Tag / meta (mono)         | `0.62–0.68rem`                           | 500     | —         | 0.06–0.12em | UPPERCASE |

**Type rules**

- Headings never exceed 800; display is usually 700.
- One emerald-highlighted span per headline, max.
- Mono labels always uppercase + tracked (≥0.08em).
- Body line length ≤ ~60ch; leads ≤ ~56ch.

---

## 5. Spacing, layout & shape

- **Spacing base: 4px.** Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- **Container:** `max-width` 1280px (default) / 1400px (wide) / 880px (narrow);
  `padding-inline: clamp(20px, 4vw, 40px)`.
- **Section vertical rhythm:** `sm` `clamp(40px,6vw,72px)` · `md`
  `clamp(64px,8vw,104px)` · `lg` `clamp(88px,11vw,140px)`.
- **Borders: 1px hairlines.** Bordered grids (cards share a 1px grid). No shadows
  on the marketing site except the soft `T.shadow` on the few floating cards.
- **Radius — SQUARE EVERYWHERE.** All radius tokens (`sm/md/lg/xl`, `--radius-*`,
  Tailwind `rounded-*`) = **0**. The **only** rounded things are **true circles**:
  avatars, status dots, toggles, spinners → `--radius-full` = `999px` / `50%`.
  Buttons, cards, inputs, badges, tags, modals: **all sharp 90° corners.**

---

## 6. Components (the kit)

Reusable primitives live in `apps/web/components/kyma/`. Re-create these shapes in
any tool:

- **Eyebrow** — `[01] LABEL` + a 7×13px emerald block "cursor". Mono, uppercase,
  0.1em tracking. One per section, names the topic.
- **Display** — uppercase TASA headline (sizes above). Emerald `[bracket]` highlight.
- **Lead** — sentence-case intro paragraph, `--k-muted`, ≤56ch.
- **Buttons (all square):**
  - _Primary_ — emerald fill, `--k-on-accent` text, mono uppercase label, arrow `→`.
  - _Ghost_ — transparent, `--k-border-strong` outline, `--k-fg` text.
  - _Solid_ — `--k-fg` fill, `--k-bg` text.
  - _Bar CTA_ — full-width pill-height bar, label left + arrow/meta right, with an
    **emerald progress underline** that fills to 100% on hover.
- **Tag / MonoTag** — small square chip, mono uppercase; MonoTag has a leading 1px rule.
- **StatBig / StatGrid** — oversized TASA-800 number + mono label beneath; in a 1px bordered grid.
- **ServiceGrid** — numbered cards in a hairline grid: mono label top-left, faint
  `[0X]` top-right, uppercase title, body, optional `▸` bullet points.
- **CellGrid / Cell** — generic bordered cell grid (process steps, etc.).
- **Accordion** — hairline rows; a circular `+` that rotates to emerald `×` on open;
  smooth grid-rows height reveal.
- **Marquee** — auto-scrolling mono strip (≈42s loop), `✳`/`·` accent separators,
  edge-fade mask, pauses on hover.
- **Section** — themed band (`theme="dark"|"cream"`), optional faint **vertical
  hairline grid** backdrop and an emerald radial spotlight.
- **Nav** — fixed, minimal: logo left · live status line (mono: "Agentic AI ·
  Automation · Systems" + "UK · Global reach" + live clock) center · **MENU** pill
  right → opens a **fullscreen overlay** with big uppercase `[0X]` links + CTAs.
  Condenses to a translucent blurred bar on scroll.
- **Footer** — dark; mono `[ COLUMN ]` link lists + a **giant 0.06-opacity NULLSHIFT
  wordmark** + status bottom-bar.

---

## 7. Motion

Subtle, weighty, premium. Respect `prefers-reduced-motion` everywhere.

- **Smooth scroll:** Lenis.
- **Scroll reveal:** fade + 12px blur→0 + rise + settle from scale .965, easing
  `cubic-bezier(.16, 1, .3, 1)` (easeOutExpo), ~0.7–0.95s, fires once in view.
- **Parallax:** big wordmarks drift ±~40px through the viewport.
- **Scroll progress:** 2px emerald gradient bar, spring-smoothed, pinned top.
- **Intro splash:** on first landing, a fullscreen "systems boot" — logo + emerald
  dot-grid + progress bar + mono status lines ("Initialising systems → … → Ready"),
  auto-dismisses (no buttons), wipes up. A short logo flash on tab re-focus.
- **Hover:** buttons shift fill / arrow nudges `translateX(4px)`; cards lift their
  border to `--k-border-strong`; bar-CTA underline fills.
- **3D hero:** an interactive Spline scene, desktop-only, edge-masked into the dark.
- **Timings:** fast 120ms · base 150ms · slow 240ms; standard ease
  `cubic-bezier(.2,.6,.2,1)`.

---

## 8. Graphics, imagery & icons

- **Hero 3D:** Spline scene (currently a dark robot placeholder), masked with a
  radial gradient so it dissolves into the background — never a hard rectangle.
- **Flat "product" mocks:** square, hairline-bordered UI previews built from the
  tokens (faux app chrome, mono labels) — not screenshots.
- **Texture:** faint vertical hairline grid (`--k-border` at 12.5% columns) and
  low-opacity emerald radial spotlights behind hero/CTA bands.
- **Watermarks:** giant 0.05–0.06 opacity uppercase TASA wordmarks behind content.
- **Icons:** Lucide, thin stroke, used sparingly; prefer mono glyphs (`→ ▸ ✳ + ×`)
  and numbers over decorative icons.
- **Photography:** rare; if used, dark-graded with a fade into `--k-bg`.

---

## 9. Do / Don't (quick reference)

**Do** — alternate cream/dark · uppercase TASA headlines · Roboto-Mono labels ·
square corners · 1px hairlines · oversized numbers · `[01]` markers · one emerald
highlight per headline · generous whitespace · sentence-case body.

**Don't** — rounded corners (except circles) · gradients-as-fills · emerald
surfaces · multiple accent colours · drop shadows on the marketing site · sans
labels (labels are mono) · Title Case headlines · centre-aligned body paragraphs ·
emoji or exclamation marks in copy.

---

## 10. Paste-ready prompt for design tools

```
Design in the Nullshift system: an agentic-AI automation agency.
- Palette: alternating near-black (#0a0a0a, text #f4f4e8) and warm cream
  (#f4f4e8, text #0a0a0a) sections. ONE accent: emerald #10b981 (hover #34d399),
  reserved for actions and a single highlighted word per headline. Status colours
  only for status (danger #FF3A5C, warning #F5D547).
- Type: TASA Orbiter for headlines (UPPERCASE, weight 700, tracking -0.03em) and
  body (sentence case). Roboto Mono for ALL labels/eyebrows/numbers (UPPERCASE,
  0.1em tracking). Giant stat numbers in TASA 800.
- Shape: SQUARE corners everywhere (radius 0). Only avatars/dots/toggles are
  circles. 1px hairline borders, bordered card grids, lots of whitespace, no
  shadows, no gradients-as-fills.
- Signature bits: "[01] LABEL" mono eyebrows with an emerald cursor block;
  bracket-highlighted keywords in emerald, e.g. "ANY [PAIN POINT], AUTOMATED";
  oversized numbers; a minimal logo + status-bar + MENU-overlay nav; a giant
  faint wordmark watermark; auto-scrolling mono marquee.
- Motion: subtle scroll-reveal (fade+rise, easeOutExpo), smooth scroll, parallax
  wordmarks. Respect reduced-motion.
- Voice: confident, concrete, UK English. Bring any idea or pain point → we build
  the agentic AI that automates it → we carry the liability → you own it.
```

---

## 11. Where it lives (for engineers)

- Tokens: `packages/ui/styles/{colors,typography,spacing,effects}.css` and
  `packages/ui/src/tokens.ts` (the `T` object).
- Theme vars + kit CSS: `apps/web/app/globals.css` (`.k-cream` / `.k-dark`, `.kb*`
  buttons, `.k-*` utilities).
- Component kit: `apps/web/components/kyma/*`.
- Fonts: `packages/ui/styles/fonts.css` + `apps/web/public/fonts/{tasa-orbiter,roboto-mono}`.
- Machine-readable tokens: [`design-tokens.json`](./design-tokens.json).
