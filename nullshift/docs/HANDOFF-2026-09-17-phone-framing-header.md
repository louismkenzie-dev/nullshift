# Parent Hub framing and transparent navigation

Local-only refinement. No deployment, billing change, database migration, source recording edit, or unrelated worktree cleanup.

## Changed files

- `apps/web/components/Nav.tsx`: compact homepage controls use white foregrounds and transparent backgrounds, with scoped brand/actions classes. The opening hero header, other routes, auth destinations, fullscreen menu and auto-hide behavior remain intact.
- `apps/web/components/Nav.module.css`: compact Menu left / Nullshift right; backdrop difference blending; monochrome mark; fine midtone keyline so inversion does not disappear over grey; the empty space between controls allows pointer events through.
- `apps/web/components/marketing/showcase/ShowcasePrototype.module.css`: remove the Parent Hub's 72px sticky-header gap; size the whole phone bezel against available container width and height; correct its vertical centre; preserve the registered screen overlay and transform-only zoom; feather photo boundaries into the grey backdrop/paper; reserve space for labels and controls; compact landscape copy and chapter controls.
- This handoff note.

No extra animation library, video or scroll listener was added. Existing offscreen gating, reduced-motion previews and full-resolution inspector recordings remain unchanged.

## Verification

- 475 tests across 41 files passed.
- Production build, TypeScript and legal identity guard passed.
- Targeted ESLint: no errors; three pre-existing Nav effect-state warnings remain.
- `git diff --check` passed.
- Browser checks used bundled Playwright because agent-browser is not installed.
- New `work/verify-phone-header.cjs` outside the repository: desktop 1440x900, split 866x787, phone 390x844, small phone 320x640, landscape 844x390, WebKit and reduced motion. Checked whole-bezel bounds at forward/reverse zoom positions, no horizontal overflow, no sticky gap, transparent/inverting header, left/right control placement, menu focus/Escape restoration, screen inspector and reduced-motion acquisition.
- Existing `work/verify-home-refinement.cjs` updated for the transparent header and passed desktop, phone, small phone, WebKit and reduced motion, including the booking CTA.
- Existing `work/verify-showcase-performance-update.cjs` passed homepage, mobile, WebKit, Client Stories, reduced-motion and private-prototype flows; chapter seeking and original-resolution inspector sources preserved.
- Visually inspected desktop, split-window, mobile and final landscape screenshots. Final landscape chapter controls end above the footer.

Preview: http://127.0.0.1:3112/#parent-hub-showcase
