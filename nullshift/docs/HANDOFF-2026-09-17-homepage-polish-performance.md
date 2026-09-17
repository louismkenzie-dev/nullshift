# Homepage polish and performance implementation

Implemented locally on 17 September 2026. No deployment, live billing change, database migration, client-data change, or git commit. Existing unrelated work was preserved.

This implements the approved recommendations in [the adversarial review](./REVIEW-2026-09-16-homepage-performance.md). That review remains a historical baseline, not a description of the current controllers.

## Visible changes

- The homepage header keeps its full opening treatment, then becomes a small floating control. Downward scrolling hides it; upward scrolling, moving the pointer to the top edge, or keyboard focus reveals it. The menu remains accessible, traps focus while open, closes with Escape and restores focus. Other pages retain their original header treatment.
- Design talent and the billboard now form one section, directly before Capabilities. Fixed on-brand typography reads “Exceptional / by design.” Copy reveals once with a short opacity/position transition, respecting reduced motion. The font-switching component is no longer rendered. Both existing section anchors remain usable.
- Homepage scrolling is native. The initial splash and outgoing navigation hold are skipped on the homepage; going from Home to Book a demo does not replay the splash. Non-home entry behavior is preserved.

## Performance changes

- Removed stacked page/section easing on the homepage. Story progress follows native scroll position directly.
- Story controllers stop scheduling visual updates while offscreen or when the document is hidden, synchronize on re-entry and avoid unchanged writes. Showcase dimensions are cached and invalidated on resize/layout changes.
- Shared video scrubber quantizes targets to encoded frames, allows one outstanding seek and retains only the latest pending target. Hero/capabilities use 24 fps; case-study recordings use 30 fps.
- The monitor and Parent Hub prepare only the current/adjacent chapter, hide inactive layers and detach distant sources. Layer promotion is restricted to active sections.
- Responsive inline recordings and prebuilt responsive stills reduce decode/raster and transfer costs. Full-resolution originals remain available only in explicitly opened screen viewers, which unmount on close.
- Portrait hero and capabilities derivatives avoid decoding the unused sides of the landscape film. Capabilities follows the handset framing. These are crops of the existing 720p source, not newly rendered Blender footage or added detail.
- Reduced-motion mode acquires no automatic story videos. Explicit screen viewers remain available. Brand reveal uses no continuing animation loop.

## Measured comparison

Same local production benchmark, sequential runs on this computer. Animation-frame interval p95, in milliseconds; lower is better. The host often scheduled near 120 Hz. These are not average FPS, field Core Web Vitals, or a physical-phone test.

| Scene           | Desktop before → after | Desktop 4× CPU before → after | Portrait 4× CPU before → after |
| --------------- | ---------------------: | ----------------------------: | -----------------------------: |
| Hero            |             16.6 → 8.8 |                    16.9 → 9.2 |                      9.2 → 9.2 |
| Suffolk monitor |            66.7 → 33.3 |                   59.3 → 33.6 |                    17.5 → 17.4 |
| Parent Hub      |              8.7 → 9.2 |                     9.2 → 9.2 |                      9.2 → 9.2 |
| Capabilities    |             16.7 → 8.7 |                    24.2 → 9.3 |                      9.2 → 9.3 |

- All inactive story subtrees recorded zero style/progress mutations during another section's measured scroll. Previously, each offscreen subtree recorded 482 mutations during the hero test.
- The desktop monitor run recorded zero frame intervals above 50 ms, versus 35 before. It is still the heaviest sequence and does not meet a universal 16.7 ms p95 target.
- A repeated single-wheel check now reaches 95% displacement in about 12–13 ms and hero visual progress in about 20–21 ms; the original measured approximately 499 ms and 558 ms respectively. The revised harness captures the pre-input position explicitly and asserts real travel, avoiding a native-scroll sampling race. Input timestamp conventions changed slightly, so these values are approximate comparative latency, not sub-millisecond precision claims.
- The desktop editing server remains slower than the optimized build (monitor p95 41.6 ms). Review the production results separately from development overhead.
- Portrait hero + capabilities file sizes total 5.56 MB rather than 17.91 MB of landscape sources. This is the pair's asset budget, not a claim that both download on initial load. Full-size source files are untouched.
- Suffolk inline video budget: 21.49 MB originals → 13.16 MB desktop, 10.96 MB standard portrait or 13.52 MB high-density portrait. High-resolution viewer downloads are separate and user-initiated.

A browser-only screen-layer/video-layer promotion experiment did not show a repeatable gain, so neither speculative change was added. Remaining monitor stutter needs a real-device paint/decode trace before further complexity. Real iPhone Safari and mid-range Android testing on a cold network remains recommended; desktop WebKit and CPU slowdown do not emulate their GPU/decoder hardware.

## Verification

- All 472 unit tests in 40 files passed.
- Production build, including TypeScript, and legal guard passed.
- Scoped ESLint: no errors; three existing Nav effect warnings remain. `git diff --check` passed.
- Desktop 1440 px, portrait 390 px, narrow 320 px, WebKit portrait, and reduced-motion navigation/layout checks passed: merged section placement, fixed heading, quiet header hide/reveal, focus, Escape, body-scroll restoration, no horizontal overflow and Book a demo routing.
- Capabilities checks passed for chapter text, full-bleed responsive framing, feathered shadow, black/Anything finale and reverse scrolling.
- Monitor/Parent checks passed for forward/reverse chapter transitions, expected responsive sources, original screen viewers, viewer cleanup, public Client Stories and the private prototype route.
- Reduced-motion scroll through all stories requested zero MP4s unless a viewer was explicitly opened.
- Desktop and phone screenshots of the merged design section were visually inspected. No client data or production services were used.

## Changed source files in this implementation

Paths below are relative to `apps/web/` and distinguish this turn's work from the many existing uncommitted changes:

- `app/(marketing)/page.tsx`: removed the standalone billboard; it now belongs to DesignTalent.
- `components/Nav.tsx`, new `components/Nav.module.css`, new `lib/navVisibility.ts`, new `tests/navVisibility.test.ts`: compact directional navigation and accessibility checks.
- `components/SmoothScroll.tsx`: native homepage scrolling and dynamically loaded, reduced-motion-aware smoothing elsewhere.
- `components/IntroSplash.tsx`, `components/PageTransition.tsx`: homepage delay removal, splash lifecycle protection and navigation timeout cleanup.
- `components/marketing/DesignTalent.tsx`, `DesignStatement.module.css`, `BrandBillboard.module.css`, new `DesignTextReveal.tsx`: unified branding composition and one-time reveal.
- `components/marketing/immersive/ScrollFilmHero.tsx`, `CapabilitiesFilm.tsx`: direct active-only progress, deferred responsive media and frame-aligned seeks.
- `lib/scrollFilmHero.ts`, `lib/capabilitiesFilm.ts`, new `lib/filmScrubber.ts`, new `tests/filmScrubber.test.ts`: source selection and tested scrubber lifecycle.
- `components/marketing/showcase/ShowcasePrototype.tsx`, `ParentHubShowcase.tsx`, `ShowcasePrototype.module.css`: active-only stories, prepared chapters, responsive media, reduced-motion gating and viewer lifecycle.
- `lib/showcasePrototype.ts`, `tests/showcasePrototype.test.ts`: variant selection and chapter preparation tests.
- This handoff and the historical review's implementation-status link.

Added media under `public/media/` (original assets preserved):

- `hero/nullshift-system-opens-desktop.mp4`, `nullshift-system-opens-portrait.mp4`, `nullshift-system-opens-portrait-poster.jpg`.
- `capabilities/nullshift-capabilities-portrait.mp4`, `nullshift-capabilities-portrait-poster.jpg`.
- `client-stories/suffolk-tennis/`: `programme`, `ledger`, `progress` each with `-inline-desktop.mp4` and `-inline-mobile.mp4`; `parent-home` and `parent-report` each with `-inline.mp4` and `-inline-retina.mp4`.
- In the same folder: `studio-display` and `portrait-iphone` at `-w960.webp`, `-w1600.webp`, `-w2400.webp`; `programme`, `ledger`, `progress` at `-w640.webp`, `-w1280.webp`, `-w1600.webp`; `parent-home`, `parent-bookings`, `parent-report` at `-w390.webp`, `-w780.webp`, `-w936.webp`.

The previously supplied billboard derivatives are reused. The original PNG and old unused typography component were not deleted.

## Reproduction artifacts

Outside the repository, in this task's `work/` directory:

- `audit-scroll-performance.cjs`; baseline `scroll-performance-audit/`, new `scroll-performance-after/`.
- `audit-wheel-response.cjs`, `audit-studio-layers.cjs`; new result JSONs in `scroll-performance-after/`.
- `verify-home-refinement.cjs` and `home-refinement-checks/`.
- `verify-capabilities.cjs` and `capabilities-checks/`.
- `verify-showcase-performance-update.cjs` and `showcase-performance-checks/`.

Local editing preview remains `http://127.0.0.1:3112/`. Deployment requires separate approval. No migration or billing follow-up is required.
