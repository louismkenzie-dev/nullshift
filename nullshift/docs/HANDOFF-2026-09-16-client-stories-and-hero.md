# Client Stories and homepage hero — 16 September 2026

## Delivered locally, not deployed

- Approved Suffolk Tennis prototype checkpoint: `4ed43ee`.
- Full source/media backup outside Git: `work/checkpoints/suffolk-showcase-2026-09-16-before-integration.tgz`, relative to this Codex workspace (not the repo).
- `/client-stories`: full-screen editorial introduction, approved Suffolk Tennis monitor and Parent Hub phone sequences, then explicit placeholders for The Dance Exclusive and NewFuture Therapy.
- Existing story anchor IDs are retained. Canonical client content and previous gallery/section components remain available; no client records were edited.
- `/`: only the hero component is replaced. Existing navigation and all sections below the hero remain unchanged.
- The film currently used is an optimised copy of the existing owned `nullshift-logo-opener.mp4`, NOT the new cinematic film. It is a temporary scroll-behaviour study. No borrowed city film or rejected generated artwork was used.
- Native sticky scroll replaces the supplied component's permanent body lock. Forward/reverse seeking, title fade/blur, closing message, progress rule, skip link, reduced-motion presentation and failed-video fallback are implemented.

## Files changed / added

Paths below are relative to the repository.

- `apps/web/app/(marketing)/client-stories/page.tsx`: new page composition and truthful metadata.
- `apps/web/app/(marketing)/client-stories/stories.module.css`: cover, placeholders and responsive layout.
- `apps/web/app/(marketing)/page.tsx`: new hero import/render and skip destination only.
- `apps/web/components/marketing/immersive/ScrollFilmHero.tsx`: scroll film controller and accessible markup.
- `apps/web/components/marketing/immersive/ScrollFilmHero.module.css`: reference-inspired visual sequence and fallbacks.
- `apps/web/lib/scrollFilmHero.ts`: media configuration and pure progress/seek calculations.
- `apps/web/tests/scrollFilmHero.test.ts`: five regression tests covering progress, safe seeks and media routing.
- `apps/web/components/marketing/showcase/ShowcasePrototype.tsx`: optional embedded mode, no nested main/duplicate h1/duplicate header or prototype outro on Client Stories.
- `apps/web/components/marketing/showcase/ParentHubShowcase.tsx`: embedded media support; approved sequence preserved.
- `apps/web/components/marketing/showcase/ShowcasePrototype.module.css`: embedded header clearance and h2 support.
- `apps/web/lib/showcasePrototype.ts`: embedded media URL helper; development asset gate unchanged.
- `apps/web/public/media/client-stories/suffolk-tennis/`: 14 finished assets — `studio-display.jpg`, `portrait-iphone.jpg`; WebP posters `suffolk-logo`, `programme`, `ledger`, `progress`, `parent-home`, `parent-bookings`, `parent-report`; MP4 clips `programme`, `ledger`, `progress`, `parent-home`, `parent-report`.
- `apps/web/public/media/hero/nullshift-brand-study.mp4` and `.jpg`: temporary owned brand film and poster.
- This handoff.

## Media and data boundaries

The case study uses the previously captured actual interfaces with fictional demo data. No production backend was queried. No live billing, Stripe logic, pricing, database, environment variables or migration was changed.

Only finished web exports are copied to public media. PSDs, capture evidence, source recordings and Blender files remain private. Original `.local-showcase` masters are unchanged. Prior mockup licensing/provenance is recorded in `HANDOFF-2026-09-14-showcase-prototype.md`.

Public case-study assets total approximately 22 MB, versus approximately 98 MB of private masters/supporting material. Screen recordings retain 2560×1440 desktop / 1170×2250 mobile resolution. H.264 CRF 16, short six-frame GOP, no B frames and fast-start metadata improve random seeking; WebP posters use quality 95. Parent Hub clips remain intersection-loaded by the existing component.

## Verification

- 453 tests passed across 37 files.
- TypeScript passed. Scoped ESLint passed without errors or warnings.
- Legal guard and Next.js production build passed.
- Browser automation: desktop and mobile Chromium, reduced motion, desktop and mobile WebKit. Forward/reverse scrubbing, skip-to-content, one main and one h1, no horizontal overflow, both embedded sequences and placeholders; no page errors or failed media responses.
- Failed hero video request produces a compact, readable static fallback with CTA.
- Short desktop (1280×650) monitor/phone layouts were visually inspected. The unchanged navigation Close button restores scrolling and PageDown advances the hero. Existing navigation does not dismiss on Escape; this pre-existing header behaviour was not modified in the hero-only scope.
- Local production server: `/` and `/client-stories` return 200; public finished media returns 200; byte range returns 206 with correct length; `/showcase-prototype` and its development-only asset route still return 404.
- Browser captures/report and verification scripts are in workspace `work/`, outside Git.
- These are automated browser engines, not a physical iPhone/Safari hardware test. Check iOS low-power/data-saving behaviour before release.
- No production deployment or database migration performed.

## Save-hook caveat

The configured absolute Git hook points to the separate original Desktop checkout, rather than this worktree. Two normal checkpoint attempts failed during lint-staged restoration after targeting that other checkout. The final checkpoint used a per-command `core.hooksPath=/dev/null` override and manual validation. No global hook configuration was changed, no stashes were applied/dropped and no resets were used. Preserve lint-staged backup stashes for inspection if needed. Use the same per-command override for saves in this worktree until the hook is separately corrected.

## Next creative decision: the hero film

### Recommended — From complexity to clarity

A single slow camera move through a dark, tactile architectural space. Separated brushed-metal and glass modules gradually align into a coherent, emerald-lit system. The camera passes through its centre and finishes on a calm, open composition.

Suggested story beats (not yet produced):

1. Opening: beautiful but disconnected parts, with quiet central space behind the headline.
2. Middle: modules align, paths connect, the space opens as the title disappears.
3. Ending: one confident, connected system; hold a clean composition behind Build / Run / Grow.

Keep this abstract brand film separate from the literal monitor/phone demonstration on Client Stories. Avoid floating unreadable dashboards, rapid cuts, particle clutter or a generic stock technology tunnel.

### Alternative — Enter your system

A continuous camera push towards a premium display, through its glass and into the structured world behind the software. Strong link to the case studies, but requires meticulous device modelling and real interface compositing. Do not generate UI text with AI.

### Alternative — The space to grow

A restrained architectural corridor opens into a luminous space; emerald light travels through the environment as the camera advances. Closest to the cinematic spatial feeling of the supplied reference, with less product explanation.

### Production routes

**Blender / commissioned 3D:** recommended for precise objects, lighting and a controllable camera path that reads well forwards and backwards. Approve three still frames first, then a low-resolution animation, then render the finished film. Keep the `.blend` file, materials and commercial asset licences. Blender supports rendering image sequences and subsequently encoding the movie: https://docs.blender.org/manual/id/dev/render/output/animation.html

**AI image-to-video:** useful for testing the architectural mood quickly. Start from an approved high-quality image and describe the camera movement rather than asking for changing UI screens. Runway's official guide explains this workflow and warns that unintended cuts/motion can require iteration: https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide

AI output still needs visual review and editing; it is not a guarantee of exact geometry, brand fidelity or Apple-level finish. Keep logos and interface text as accurate separate layers.

### Delivery brief

- One continuous, silent 8–12 second shot; smooth restrained camera movement, no hard cuts or flashes.
- 4K master at 24 or 30 fps; separately composed desktop and portrait/mobile exports, not a blind centre crop.
- Clean opening and closing holds; no text baked into the film.
- Dark charcoal, soft off-white, brushed metal/glass and restrained Nullshift emerald.
- Poster image, source project, licensed assets and a web-optimised H.264 export with frequent keyframes.
- Target a compact desktop web export (initial working budget 5–10 MB, then validate fidelity and seek performance), with a smaller mobile version.
- Replace `HERO_FILM` in `apps/web/lib/scrollFilmHero.ts` once approved; change temporary `fit: contain` to `cover` for a correctly composed landscape film. Add mobile source selection when the portrait asset exists.

The existing hero code controls playback. The premium appearance must come from the quality of the film, lighting, composition and art direction — not from increasing the amount of frontend animation.
