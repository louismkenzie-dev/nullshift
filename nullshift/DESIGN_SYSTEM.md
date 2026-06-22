# Nullshift Design System — KYMA edition

The single source of truth for the Nullshift visual language. The marketing site
(`apps/web/app/(marketing)`) is the reference implementation. **Admin**
(`apps/web/app/admin`) and the **client portal** (`apps/web/app/portal`) must match it.

> Everything below already exists in the codebase. Admin and portal live **inside
> `apps/web`**, so they share `apps/web/app/globals.css` (all `.k-*`/`.kb` classes and
> `--k-*` vars) and can import the kit from `@/components/kyma`. **Do not** extract to
> `packages/ui`. **Do not** edit `globals.css`, `packages/ui/*`, or `components/kyma/*`
> during a rebrand — only restyle pages with what's already here.

---

## 1. Foundations (tokens — never hardcode these)

| Thing           | Value                                                       | How to use                                                                    |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Accent          | **emerald `#10b981`** (`T.primary` / `var(--k-accent)`)     | actions, focus, accents — **sparingly**. Never acid green.                    |
| Surfaces (dark) | bg `#0a0a0a`, surface `#141414`, elevated `#1E2029`         | `var(--k-bg)`, `var(--k-surface)`; cards use `.k-kard`                        |
| Foreground      | `var(--k-fg)` / `var(--k-muted)` / `var(--k-faint)`         | text hierarchy                                                                |
| Borders         | `var(--k-border)` (hairline), `var(--k-border-strong)`      | 1px only — geometry comes from borders, not shadows                           |
| Display font    | **TASA Orbiter** (`T.sans` / `T.display`)                   | ALL headings, UPPERCASE, weight ≤ 800, tracking `-0.03em`                     |
| Mono font       | **Roboto Mono** (`T.mono`)                                  | labels, eyebrows, badges, numbers-as-labels, UPPERCASE, tracking `0.08–0.1em` |
| Body            | TASA Orbiter (`T.sans`)                                     | sentence case, `var(--k-muted)`                                               |
| Radius          | **0 everywhere** except true circles (`999px`)              | NO rounded corners. (Image cards may use ≤ 8px.)                              |
| Motion easing   | `var(--ease-out-expo)` arrive, `var(--ease-in-expo)` depart | already in `effects.css`                                                      |
| Motion timing   | 120 / 150 / 240ms (`--motion-fast/base/slow`)               | hover & state transitions                                                     |

Tokens: `import { T } from "@nullshift/ui/tokens"` (JS) or `var(--k-*)` (CSS). `--k-*`
default to the **dark** theme at `:root`, so app surfaces are dark KYMA automatically —
no wrapper needed. Wrap a band in `className="k-cream"` only for a deliberate light section.

---

## 2. The kit (import and use — don't reinvent)

**From `@/components/kyma`:**

- `Section`, `Container` — themed bands (`theme="dark"|"cream"`, `pad`, `grid`).
- `Eyebrow` — `[01] LABEL_` section marker (mono, emerald index, **auto scramble + blinking cursor**). Use for every section/page label.
- `Display` — UPPERCASE TASA heading. Sizes `sm|md|lg|xl|hero`. App pages: `sm`/`md` (NOT hero).
- `Lead` — muted intro paragraph.
- `SectionHeader` — Eyebrow + Display + Lead combo.
- Buttons: `BtnPrimary` (emerald), `BtnGhost` (outline), `BtnSolid`, `BarButton` (full-width CTA w/ sweep), `TextLink`. All square, mono, uppercase.
- `Tag`, `MonoTag` — chips / labelled rules.
- `StatBig`, `StatGrid` — oversized KPI numbers (CountUp built in). Marketing-scale.
- `CellGrid`/`Cell`, `ServiceGrid` — bordered hairline grids.
- `Marquee`, `BrandStrip` — ticker / emerald brand band (marketing only).
- `Accordion` — disclosure.

**App-surface kit — `@/components/app/AppKit`** (built for dashboards/forms/tables):

- `PageHeader({ index?, label, title, lead?, actions? })` — standard page top (Eyebrow + Display, Reveal-wrapped). Use on **every** admin/portal page.
- `Panel({ label?, title?, actions?, pad?, children })` — the workhorse card (`.k-kard` + hairline header). Use for every grouped block.
- `StatCard({ value, label, sub?, accent? })` — compact KPI card (CountUp value, mono label).

**Global CSS classes (in `globals.css`):** `.kb` + `.kb-primary|kb-solid|kb-outline` + `.kb-sm|kb-lg` (buttons), `.k-bar` (CTA bar), `.k-kard` / `.k-kard-h` (cards), `.k-vgrid` (hairline grid backdrop), `.k-hatch` (diagonal texture for inactive cells), `.k-tag`, `.k-livedot` (pulsing dot), `.k-clock-colon` (blinking clock colon), `.k-menu-links`.

**Motion components:** `Reveal` (`@/components/Reveal` — scroll fade/rise/blur, reduced-motion safe), `ClipReveal` (clip line-rise), `ScrambleText` (`@/components/anim/ScrambleText`), `CountUp` (`@/components/anim/CountUp`).

---

## 3. App-surface rules (admin + portal)

App UIs are **data-dense** — apply the brand _language_, not the marketing _layout_.

- **Stay dark.** No cream sections in dashboards (cream is a marketing rhythm device). Auth screens may use a single dark hero feel.
- **No marquees, no page-wipes, no giant hero type** in app chrome. Keep navigation instant.
- **Page top:** always `PageHeader` (Eyebrow label + Display `md` title). Replaces ad-hoc `// comment` headers.
- **Cards/panels:** `Panel` or `.k-kard`. Hairline borders, square, `var(--k-surface)`.
- **Buttons:** `.kb`/`.kb-primary`/`.kb-outline` or the kyma `Btn*` components. **Delete any rounded `.k-btn`** — square only.
- **Section labels** inside pages: `MonoTag` or `Eyebrow` (mono uppercase + emerald).
- **Tables:** keep the existing CSS-grid structure; restyle to hairline rows (`var(--k-border)`), mono uppercase column headers, `var(--k-fg)`/`muted` cells, emerald only for status/links. Row hover `var(--k-surface)`.
- **Forms:** square inputs, `var(--k-surface)` bg, `var(--k-border)` (focus → emerald ring `--focus-ring`), mono uppercase labels.
- **Badges/status:** `.k-tag` or tone-based mono chips (emerald/amber/red soft).
- **KPIs:** `StatCard` (CountUp).

---

## 4. Animation guidance ("where relevant")

Use, in app surfaces:

- `Reveal` on cards/sections/rows as they enter (stagger grids with `delay={i*0.05}`). `PageHeader`/`Panel` can be wrapped or you wrap groups.
- `Eyebrow` scramble + blinking cursor on labels (automatic).
- `CountUp` on KPI numbers (built into `StatCard`/`StatBig`).
- `.k-livedot` for "live/online" indicators; `.k-clock-colon` for any live clock.
- Hover transitions (150ms) on buttons, rows, cards (`.k-kard-h` lifts border).
- Login/auth: a tasteful entrance (Reveal + scramble label) — these are brand moments.

Do **not** add: marquees, the page-transition wipe, brand strips, or auto-playing motion to dense dashboards. Everything must respect `prefers-reduced-motion` (the kit already does).

---

## 5. Hard rules

1. **Presentation only.** Never change data fetching, server actions, auth/RLS logic, props, routing, or behavior. Preserve every handler, `await`, and `"use server"`/`"use client"` boundary.
2. **No new border-radius** except circles (dots/avatars). Remove rounded buttons/cards you find.
3. **Fonts:** TASA Orbiter (display) + Roboto Mono (labels) via `T.sans`/`T.mono`/`var(--font-*)`. Never Inter/JetBrains literals.
4. **Emerald is the only brand color.** No other hues except signal colors (success/warning/danger from `T`).
5. **Don't edit** `globals.css`, `packages/ui/*`, or `components/kyma/*`. Use what's there; if you truly need a one-off, inline-style it with `var(--k-*)`/`T`.
6. Keep it **server-safe**: only add `"use client"` if you introduce a hook. Most kit pieces are server-renderable.
7. Match the marketing site's restraint — lots of negative space, hairlines, one accent.
