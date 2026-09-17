# Phase 1 — accessibility notes for the client portal prototype

Scope: `/admin/next/portal/**` as built in task `p1-portal`, judged from the CSS and markup
(`portal.module.css`, `_ui/Frame.tsx`, the six pages). **No browser was available**; every
layout claim below is a reading of the stylesheet and must be confirmed against the §13
verification matrix on a preview deployment before the prototype is shown to a client.

## 1. Focus order

Document order is the visual order, top to bottom, and nothing is reordered with CSS
(`order`, `flex-direction: row-reverse`, absolute positioning) inside the frame:

1. Staff preview controls (client → role → width). They are outside the frame and marked with
   `aria-label="Preview controls (staff only)"`; a real client build omits them entirely.
2. Frame top bar: the back link (when present) is the first focusable element inside the frame.
3. Page header (`h1`), then each section in reading order: progress link → exception card
   actions → next-step action → dates → help button.
4. Step screens: facts → notice → what happens → hosted-flow note → form fields (label,
   hint, input, in that order; `aria-describedby` binds the hint) → sticky action bar
   (primary button, then "Save and return later"/"Not now", then the explanatory note the
   button references via `aria-describedby`).
5. Bottom navigation last (Home, Checklist, Billing, Help), with `aria-current="page"` on the
   active tab.

The sticky bar is in the DOM after the form, so tabbing off the last field reaches the primary
action next; it is never reached before the fields it submits.

Headings: one `h1` per screen, `h2` per section, every section labelled with
`aria-labelledby`. Checklists are `<ol>`/`<ul>` with `aria-label`; each row is one link
containing the label, the state chip and the owner/evidence line, so a screen reader hears
"Company and billing details, In progress, You, Saved yesterday 16:12, 4 of 7 fields, link".

## 2. Keyboard

- Every interactive element is a native `<a>` or `<button>`; no `div` handlers, no
  hover-only actions (hover only recolours).
- Visible focus: `.frame :focus-visible, .controls :focus-visible { outline: 2px solid
var(--ns-info); outline-offset: 2px }`; inputs also swap their border to the info colour.
  `--ns-info` (#3DD7E5) on the page background is 11.3:1, on the surface 10.3:1.
- Prototype buttons that do nothing use `aria-disabled="true"` rather than `disabled`, so they
  stay in the tab order and their explanation (`aria-describedby`) is announced. When wired to
  real actions, keep them focusable while pending and announce the result in a status region.
- No dialogs, drawers or menus exist in this slice, so there is no focus-trap or
  focus-return behaviour to verify yet. When the filter sheet (§4.5) is added: trap focus,
  close on Escape, return focus to the opener.
- Skeleton: `role="status"` "Loading your portal" is announced once; blocks are
  `aria-hidden`. Error boundary: `role="alert"` on the frame; the retry button is the first
  control.
- Links inside the frame carry the client/role/width query so keyboard navigation never
  drops the reviewer out of the fixture they were inspecting.

## 3. Contrast (WCAG 2.x relative luminance, computed by hand)

Backgrounds: page `--ns-bg` #0A0B0F (L≈0.0034), surface `--ns-surface` #14151C (L≈0.0068).

| Token            | Hex         | On #0A0B0F | On #14151C | Verdict                                                                                      |
| ---------------- | ----------- | ---------- | ---------- | -------------------------------------------------------------------------------------------- |
| `--ns-fg`        | #F2F4F8     | ≈17.6:1    | ≈16.6:1    | body text                                                                                    |
| `--ns-muted`     | #9AA0AE     | ≈7.5:1     | ≈7.0:1     | passes AA at every size used (13–15 px), passes AAA                                          |
| **`--ns-faint`** | **#5C6170** | **≈3.2:1** | **≈3.0:1** | **fails 4.5:1 for normal text; on the surface it does not even reach 3:1 for large text/UI** |
| `--ns-primary`   | #10B981     | ≈7.8:1     | ≈7.3:1     | link/active tab colour, and `--ns-on-primary` text on a primary button is the same 7.8:1     |
| `--ns-success`   | #2BE08C     | ≈11.4:1    | ≈10.7:1    | chip text                                                                                    |
| `--ns-warning`   | #F5D547     | ≈13.6:1    | ≈12.8:1    | chip/notice text                                                                             |
| `--ns-info`      | #3DD7E5     | ≈11.3:1    | ≈10.6:1    | chip text, focus ring                                                                        |
| `--ns-danger`    | #FF3A5C     | ≈5.6:1     | ≈5.3:1     | chip text (11 px mono uppercase — AA needs 4.5:1, met)                                       |

**Where `--ns-faint` is avoided.** `portal.module.css` does not reference `--ns-faint` at all.
Every piece of secondary text in the portal — owner/evidence lines, hints, dates' meanings,
the "preview only" notes, the eyebrow labels — uses `--ns-muted` (7:1). Placeholders use the
input's own colour (`--ns-muted`) with a dashed border, not a faint colour. Disabled/inert
buttons use `--ns-muted` text and a `--ns-border` outline (the button remains 7:1 legible;
its inert state is conveyed by `aria-disabled` and the adjacent sentence, not by colour).

The faint token remains in the **shell** (`next.module.css`, outside this task): the Today
page's "Source freshness" line, disabled rail links, the search placeholder, and
`.btn:disabled`. Those are decorative or non-essential today; if any becomes essential, switch
it to `--ns-muted` or lift the token to at least #8A8F9C (≈5.9:1 on #0A0B0F).

**Colour never carries state alone.** Every chip prints its state as text ("Done", "Blocked",
"Waiting for you"); the checklist mark prints a tick or the step number; the completion bar
is accompanied by "n of m done" as text; invoice states are words.

## 4. Layouts (from the CSS)

Frame: `width: 100%; max-width: 420px`, gutters 16 px (`.body` padding), `overflow-wrap:
anywhere` so long company names and references wrap instead of overflowing. Nothing inside the
frame sets a fixed width wider than the frame; `kv` and `facts` grids use `minmax(0, 1fr)`;
the top-bar client name is ellipsised.

- **320 px phone.** The admin shell drops to one column below 900 px, content padding
  becomes 16 px, so the frame is 288 px wide with 16 px internal gutters → 256 px of text.
  Row layout is `28px | minmax(0,1fr)`; chips are `white-space: nowrap` but sit in a
  `.cardHead` row with `flex-wrap: wrap`, so a long step label and the widest chip
  ("Waiting for you") drop onto two lines at 256 px instead of overflowing.
  The preview controls wrap (`flex-wrap`) and are 32 px tall — they are staff-only.
- **390 px phone.** Frame 358 px; comfortable. Bottom nav is four cells of ≈89 px with
  11 px uppercase labels; all four labels fit on one line.
- **768 px tablet.** Still under the 900 px shell breakpoint: shell bottom nav is shown and
  the frame's sticky nav/action bar are lifted above it via `--shell-nav` (56 px + safe
  area). Frame is 420 px centred with the shell's 16 px padding either side.
- **1440 px desktop.** Rail 248 px + content; frame 420 px centred in the remaining width.
  With `?wide=1` the frame grows to 920 px and the body becomes a two-column grid
  (`minmax(0,1fr)` × 2), keeping each column single-column content as §4.5 requires.

No horizontal page scroll: the only `overflow-x: auto` in the shell is on tables/tabs, and the
portal renders neither.

## 5. 200 % zoom

At 200 % on a 1440 px laptop the effective viewport is 720 px, which crosses the shell's 900 px
breakpoint: rail hides, shell bottom nav appears, frame goes edge-to-edge (borders removed)
and the sticky bar is lifted above the shell nav. Text and controls scale with the zoom
(everything is in px, no `vw` units, no `max-height` clamps on text containers); 48 px targets
stay 48 CSS px (96 device px), comfortably above the 44 px minimum. The frame's `min-height: min(780px, calc(100vh - 220px))`
shrinks with the shorter viewport rather than forcing internal scroll. On a phone at 200 %
(effective 160–195 px) the sticky bar becomes static (see §7) so it cannot eat the small
viewport.

Text reflow at 400 % (WCAG 1.4.10, 320 px) is the same layout as the 320 px phone case.

## 6. Reduced motion

The only transitions in the portal are none: `portal.module.css` declares no `transition` or
`animation` and no animation library is used. The shell's 120 ms colour transitions are
disabled under `prefers-reduced-motion: reduce` (`next.module.css`), and the portal repeats
that guard for its own subtree. The skeleton is static blocks, not a shimmer.

## 7. Sticky action vs keyboard rule (brief §4.5)

The primary action on a step screen (`.sticky`) is `position: sticky` at
`bottom: calc(var(--portal-nav) + env(safe-area-inset-bottom) + var(--shell-nav))`, i.e. it
docks above the portal's own bottom nav and, on small viewports, above the shell's nav too.
Three things keep it from covering the last field, the browser safe area or the software
keyboard:

1. **It is in flow after the form.** The body's 24 px bottom padding is absorbed by the bar's
   negative margin, so when the page is scrolled to the end the last field sits directly above
   the bar, never under it. Because it is sticky, not fixed, it cannot overlap content that is
   already at the bottom of the scroll container.
2. **Safe area.** Padding-bottom includes `env(safe-area-inset-bottom)` on both the nav and the
   bar.
3. **Keyboard.** When a software keyboard opens, the visual viewport height drops (iOS Safari
   and Android Chrome resize the layout viewport for `interactive-widget=resizes-content`, the
   Next default). At `@media (max-height: 560px)` the bar becomes `position: static` with no
   negative margin, so it scrolls with the form and can never sit over the focused field.
   The same rule covers landscape phones and 200 % zoom on small screens.

Rule to keep: **a sticky primary action may only be sticky while the viewport is taller than
560 px; below that it must be in flow.** Any future sticky element in the portal follows
`.sticky` rather than introducing `position: fixed`.

## 8. Still to verify in a browser

- Chip + long label wrapping at 320 px looks right (see §4).
- iOS Safari keyboard behaviour with `position: sticky` inside the shell's scroll container.
- Screen-reader reading of `<meter>` (VoiceOver announces "n of m"); the text count is the
  primary source regardless.
- Focus visibility of `aria-current` control links against the primary-tinted background.
