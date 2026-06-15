---
name: nullshift-design
description: Use this skill to generate well-branded interfaces and assets for Nullshift, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets
out and create static HTML files for the user to view. If working on production code,
you can copy assets and read the rules here to become an expert in designing with this
brand.

If the user invokes this skill without any other guidance, ask them what they want to
build or design, ask some questions, and act as an expert designer who outputs HTML
artifacts _or_ production code, depending on the need.

## Nullshift in one breath

Dark, architectural, precise. Three surface tiers (`background → surface → elevated`),
one emerald brand colour (`#10B981`) reserved for actions only, Inter 600 headings in
sentence case with `-0.03em` tracking, JetBrains Mono for system text, and 1px
hairline borders carrying the geometry. No emoji. No decoration in signal colour. One
primary button per view. See `README.md` for the full content + visual foundations.

## What's here

- `styles.css` — the one stylesheet to link; `@import`s every token + font.
- `tokens/` — colours, type, spacing, effects, fonts, base helper classes.
- `components/` — React primitives (Logo, Button, Card, Badge, Tag, Eyebrow, Input,
  Textarea, StatCard, PricingCard).
- `ui_kits/` — full-page recreations: `marketing/` (site + brief modal) and
  `admin/` (internal CRM dashboard).
- `guidelines/` — foundation specimen cards.
- `assets/` — logo SVGs + real Inter / JetBrains Mono webfonts.

## Using the components

In an HTML artifact, link `styles.css`, load React UMD + the compiled
`_ds_bundle.js`, then read components off `window.NullshiftDesignSystem_7b523b`. The
two `ui_kits/*/index.html` files are the canonical examples — copy one as a starting
point. For static slides/mocks without React, lean on the token CSS and the
`.ns-eyebrow` / `.ns-hero-glow` / heading helper classes directly.
