# Smooth header handover

Local-only change. No deployment, billing, client-data or authentication changes.

## Implementation

- `apps/web/components/Nav.tsx`: full and compact presentations share one navigation landmark. They stay in their final layouts and crossfade with a small vertical slide, instead of abruptly changing flex order and removing status elements. Inactive controls are inert and hidden from assistive technology. Escape restores focus to the correct opener.
- `apps/web/components/Nav.module.css`: short staggered opacity/transform transitions, stable background inversion, preserved transparent compact controls, immediate keyboard-focus visibility, reversible transitions, reduced-motion opt-out.
- `apps/web/lib/navVisibility.ts`: compact mode enters after 56px and exits at 16px. The buffer prevents trackpad threshold chatter; its state persists when menu listeners restart.
- `apps/web/tests/navVisibility.test.ts`: threshold, reverse, overscroll and invalid-value regression coverage.
- This handoff note.

The opening header layout and colour palette, compact Menu-left / Nullshift-right placement, auto-hide, focus trapping, portal routing and non-homepage header remain intact. No per-frame React state, new scroll listener or animation dependency was added. CSS handles the handover and interruption/reversal.

## Verification

- 477 tests across 41 files passed.
- Production build, TypeScript and legal guard passed.
- Targeted ESLint: no errors; the same three pre-existing effect-state warnings remain in Nav.
- `git diff --check` passed.
- Bundled browser checks used Playwright because agent-browser is not installed.
- `work/verify-nav-handover.cjs`: desktop, phone, small phone, WebKit and reduced-motion checks passed. Sampled intermediate opacity values rather than checking endpoints only; verified reverse and rapid interrupted transitions, one interactive navigation layer, menu/Escape focus return within the threshold buffer, auto-hide/reveal and no overflow.
- Captures and sampled frames are in `work/nav-handover-checks/`.
- Updated existing local browser scripts to target the active compact presentation and distinguish the footer demo CTA from the newer hero CTA.

Preview: http://127.0.0.1:3112/
