# Marketing site — UI kit

A full-page recreation of the Nullshift marketing website: the public face of the
studio. Dark, architectural, one emerald accent.

## Screens / sections
- **`MarketingNav`** — sticky nav that condenses + frosts on scroll. Logo lockup, anchor links, `Client login` (secondary) + `Book a call` (primary).
- **`Hero`** — eyebrow, oversized Inter 600 headline with the emerald `intention.` hero-glow, lead paragraph, dual CTA, live-status line.
- **`Services`** — three numbered service cards (hairline borders, hover-lift) + industry `Tag` row.
- **`Process`** — four-step grid bordered with hairlines.
- **`Pricing`** — three `PricingCard`s, middle plan highlighted.
- **`Contact`** — two-up: copy + a brief CTA panel.
- **`BriefModal`** — interactive multi-step project brief (contact → project → details → done) over a blurred overlay.

## Interaction
Every CTA (`Book a call`, `Start your project`, `Tell us more`) opens the `BriefModal`.
The brief is a 3-step form with a progress bar and a success state.

## Composition
Built entirely from design-system primitives — `Logo`, `Button`, `Eyebrow`, `Tag`,
`Card`, `PricingCard`, `Input`, `Textarea` — via `window.NullshiftDesignSystem_7b523b`.
No component logic is re-implemented here; the kit only arranges them.

## Files
- `index.html` — entry; loads React + the DS bundle, mounts the page.
- `sections.jsx` — nav, hero, services, process, pricing.
- `brief.jsx` — contact, footer, and the brief modal.
