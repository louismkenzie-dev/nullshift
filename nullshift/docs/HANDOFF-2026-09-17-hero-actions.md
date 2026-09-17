# Opening hero actions

Local-only update. No deployment, live billing or auth/data changes.

## Changed

- `apps/web/components/marketing/immersive/ScrollFilmHero.tsx`: opening Book a demo (/book) and Existing Clients and Partners (/portal/login) links; no speculative route prefetch. Reuses the existing scroll controller to retire the links from interaction and accessibility navigation as they fade. Keeps them available in reduced-motion and video-error fallbacks. The existing closing link begins inert until its scene appears.
- `apps/web/components/marketing/immersive/ScrollFilmHero.module.css`: restrained primary/outlined action pair below the headline, side by side on desktop and stacked on mobile, with 48px minimum targets. Fade/translation follow the hero timeline with no new animation dependency or scroll listener.
- `apps/web/lib/scrollFilmHero.ts`: actions hold initially, fade between 1.5% and 8% scroll progress, and are gone before playback begins at 12%. Reverse scrolling restores them.
- `apps/web/tests/scrollFilmHero.test.ts`: deterministic fade, reverse and playback separation regression test.
- This handoff note.

## Verification

- 476 tests / 41 files pass; targeted ESLint has no errors or warnings.
- Production build, TypeScript and legal guard pass; diff whitespace check passes.
- Bundled Playwright used because agent-browser is unavailable.
- `work/verify-hero-actions.cjs` (outside repo) passed against the production build on temporary local port 3114: desktop, phone, small phone, WebKit, reduced motion and failed-video fallback.
- Checks cover real hit targets, desktop/mobile layout, keyboard focus, fade/inert behavior, reverse scroll, no horizontal overflow, booking and sign-in destinations.
- Safari's test-only forced navigation away from a still-loading booking page interrupted its deferred chunk loading. Checking each destination in a separate page resolved that cancellation artifact; no application code was changed for it.
- Screenshots and machine-readable report: `work/hero-actions-checks/`.

User preview remains http://127.0.0.1:3112/.
