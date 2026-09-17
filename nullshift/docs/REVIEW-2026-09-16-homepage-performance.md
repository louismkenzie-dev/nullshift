# Homepage performance: adversarial review

Implementation update: the approved fixes and merged branding section are now documented in [the 17 September handoff](./HANDOFF-2026-09-17-homepage-polish-performance.md). The review below is the historical pre-fix baseline.

## Outcome and scope

The page has two distinct problems: delayed response deliberately introduced by smoothing, and intermittent first-pass stutter in the Suffolk Studio Display sequence. They should be fixed independently. This review did not change the scroll/video implementation or deploy anything.

The separately requested billboard has been added after Design talent, before Capabilities. It is a static, responsive, deferred image, not another animated section.

## What was measured

- Read the actual homepage import tree, marketing layout, scroll controllers, CSS and shipped media; independent scroll and media source reviews.
- Started a separate local **production** server on port 3114 using the existing successful production build; compared the editing preview on 3112. No production deployment.
- Chromium desktop 1440×900, normal and 4× CPU slowdown; portrait 390×844 at 2× density with 4× CPU slowdown. Portrait profiling still used wheel input on desktop hardware: it is **not** a physical iPhone/touch/GPU benchmark.
- Repeated scripted wheel movements through hero, monitor, parent and capabilities; measured animation-frame intervals, long animation frames, seek completion, video-frame callbacks, network requests, and style mutations.
- Separate repeated wheel-response comparison with only the global Lenis smoothing bypassed in the test browser.
- Browser-only diagnostic comparisons freezing video seeks and removing blur. These overrides were discarded; no source modifications.
- Full-motion desktop/mobile/WebKit checks of billboard placement, responsive source choice, lazy loading, dimensions, no horizontal overflow and preserved demo CTA.

Production baseline predates the billboard. The development comparison includes the new billboard; it is deferred and does not change the measured sections' internal choreography. Media benchmarking was sequential, without simultaneous builds. Shared-computer load and headless rendering still introduce variability. These are lab observations, not real-user Core Web Vitals or a promise of device FPS.

### Frame timing

95th-percentile animation-frame intervals in milliseconds; lower is better. A 60 Hz display has a 16.7 ms frame interval. The test host often scheduled at approximately 120 Hz. These percentiles are **not average FPS**.

| Section                     | Production desktop | Production desktop, 4× CPU | Portrait layout, 4× CPU |
| --------------------------- | -----------------: | -------------------------: | ----------------------: |
| Hero                        |               16.6 |                       16.9 |                     9.2 |
| Suffolk monitor             |           **66.7** |                   **59.3** |                    17.5 |
| Parent Hub                  |                8.7 |                        9.2 |                     9.2 |
| Capabilities, main sequence |               16.7 |                       24.2 |                     9.2 |

The first production monitor pass had 35 frame intervals above 50 ms and 49 long-animation-frame entries, but no >50 ms JavaScript long tasks. That argues against declaring a long React render the sole cause. An additional first-pass monitor run reached 91.4 ms p95; its subsequent warmed repeat reached 16.7 ms. Freezing seeks improved an intervening run, but the later unmodified run improved even further, so that A/B is confounded by warm-up. **First-pass stutter is reproduced; an exact decoder-versus-compositor attribution is not yet proven.**

For measurement semantics, [Chrome's Long Animation Frames guidance](https://developer.chrome.com/docs/web-platform/long-animation-frames) distinguishes rendering work from individual long tasks. [Video-frame callbacks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) report frames submitted for composition; they are more informative than relying on currentTime alone, but do not guarantee exact display synchronization.

## Ranked findings and recommendations

### P1 — Remove stacked smoothing before tuning visual fidelity

Evidence:

- [SmoothScroll.tsx:8](../apps/web/components/SmoothScroll.tsx) creates Lenis with a 1.15-second easing configuration on every marketing page.
- [ScrollFilmHero.tsx:35](../apps/web/components/marketing/immersive/ScrollFilmHero.tsx) and [CapabilitiesFilm.tsx:43](../apps/web/components/marketing/immersive/CapabilitiesFilm.tsx) then apply another fixed 0.18 interpolation on every frame.
- [showcasePrototype.ts:112](../apps/web/lib/showcasePrototype.ts) adds a separate 95 ms damping time constant to the monitor/parent sequences.
- Two original single-wheel tests both took **499 ms** to reach 95% of their eventual scroll displacement, and about **558 ms** for hero visual progress to reach 95%. Browser-only native-wheel bypass: **16 ms** for scroll, **158 ms** for the still-smoothed hero.
- Original scrolling took approximately 933 ms to settle within one pixel after that input.

Recommendation: choose one smoothing owner. A/B native page scrolling with bounded, time-based visual catch-up against a substantially shorter Lenis configuration. Do not keep both long global easing and per-section trailing. Preserve native touch behavior and honor reduced motion globally. Fixed 0.18 damping reaches 95% in about 15 frames: roughly 250 ms at 60 Hz, 500 ms at 30 Hz, 125 ms at 120 Hz. Those latter values are calculations, not device measurements.

### P1 — Optimize the monitor's first display of each recording

Evidence:

- [ShowcasePrototype.tsx:271](../apps/web/components/marketing/showcase/ShowcasePrototype.tsx) places three 2560×1440 recordings plus matching stills into a projectively transformed 1600×900 screen.
- [ShowcasePrototype.module.css:148](../apps/web/components/marketing/showcase/ShowcasePrototype.module.css) transforms the entire photo/screen composition; the layer requests permanent promotion.
- First-pass stutter remains in production. Repeated warm playback is much better.

Recommendation: measure the first entry into each chapter, not only a replay after the browser has warmed up. Prepare the imminent chapter early enough for its first frame, render only the current and transitioning screen layers, test appropriately sized inline video variants, and retain the original high-detail recording for explicit full-screen inspection. Compare crispness at real device pixel densities before choosing dimensions. Do not reduce everything to a blurry thumbnail or claim compression alone fixes rendering.

Follow-up isolation: compare identical fresh-browser runs with lower-resolution inline sources, a single visible screen layer, and a flattened screen composition separately. This identifies decode/upload/compositing costs without rewriting the story.

### P1 — Give phones their own media budget and composition

Measured active video assets, cumulative whole-experience budget:

| Video         |   MiB | Resolution | Frames/sec |
| ------------- | ----: | ---------- | ---------: |
| Hero          |  6.21 | 1280×720   |         24 |
| Capabilities  | 10.87 | 1280×720   |         24 |
| Programme     |  4.15 | 2560×1440  |         30 |
| Ledger        |  4.14 | 2560×1440  |         30 |
| Progress      |  2.49 | 2560×1440  |         30 |
| Parent home   |  5.04 | 1170×2250  |         30 |
| Parent report |  4.68 | 1170×2250  |         30 |

Total: **39,387,141 bytes / 39.39 MB / 37.56 MiB**. This is **not** all downloaded on initial load. Initial desktop production transfer was about 7.96 MB in this local run, including the 6.51 MB hero and about 0.92 MB of images. All seven video posters were requested at the top, even for far-offscreen stories.

The same sources are used on phones. [Capabilities framing](../apps/web/lib/capabilitiesFilm.ts) plus cover/1.08 scale shows only about 24% of the landscape source width at 390×844 while decoding the whole source. It also magnifies a 720p film.

Recommendation: a portrait Blender render centered on the handset, responsive inline case-study recordings and responsive photos/posters. Keep sharp originals for larger screens or explicit inspection. Load current plus next chapter, rather than attaching all three desktop sources together at [ShowcasePrototype.tsx:140](../apps/web/components/marketing/showcase/ShowcasePrototype.tsx). Parent sources are also attached together at [ParentHubShowcase.tsx:109](../apps/web/components/marketing/showcase/ParentHubShowcase.tsx). Their preload hints differ, so attaching both is not proof both fully download immediately.

Do not swap everything to 4K. Initial working budgets to test visually, not commitments: 3 MB mobile hero, 4 MB portrait capabilities, 1–2 MB per inline recording. Asset quality and real network measurements decide the final limits.

### P2 — Stop doing unchanged offscreen work

All four story controllers receive global scroll events. Their observers mostly defer media loading, not layout reads/style updates:

- [Hero:53](../apps/web/components/marketing/immersive/ScrollFilmHero.tsx)
- [Monitor:64](../apps/web/components/marketing/showcase/ShowcasePrototype.tsx)
- [Parent:52](../apps/web/components/marketing/showcase/ParentHubShowcase.tsx)
- [Capabilities:65](../apps/web/components/marketing/immersive/CapabilitiesFilm.tsx)

During the initial desktop hero test, each of the three offscreen story subtrees still generated **482 style/progress attribute mutations**. This proves unnecessary work, not that all those mutations caused full paints or expensive layout.

Recommendation: only schedule nearby/active stories; synchronize once on re-entry. Skip unchanged progress/frame values; cache sizes on resize; batch reads before writes. One shared scheduler is optional, not a reason to replace the animation stack. Do not blindly add content-visibility to tall sticky containers because their dimensions define scroll choreography.

### P2 — Seek actual source frames, not fractional duplicates

[Hero:27](../apps/web/components/marketing/immersive/ScrollFilmHero.tsx) and [Capabilities:35](../apps/web/components/marketing/immersive/CapabilitiesFilm.tsx) request seeks for changes over 1/60 second despite 24 fps sources. The first capabilities pass completed 358 seeks and recorded 345 video-frame callbacks, representing only 304 distinct 24 fps source-frame indices. Repeated presentation of the same encoded frame is observable; the exact savings from quantizing requests still require an implementation comparison.

Recommendation: snap targets to verified source-frame indices and skip repeated indices. Keep the existing single-outstanding-seek/latest-target queue—it is already a good design. Track presented mediaTime versus requested frame and chapter text. The overlays currently advance before a pending seek completes; visible drift under load is plausible but was not quantified in this review.

### P2 — Reduced motion should also save resources

[SmoothScroll.tsx:7](../apps/web/components/SmoothScroll.tsx) does not respect reduced motion. Showcase observers still attach/load video sources even when CSS hides the videos for reduced motion. Recommendation: no global interpolation and no automatic video acquisition in that mode; load originals only after an explicit viewer action.

### P3 — Keep effects under review, but do not remove the brand treatment on speculation

[CapabilitiesFilm.module.css:22](../apps/web/components/marketing/immersive/CapabilitiesFilm.module.css) applies full-frame blur during the finale; its central feathered shadow adds another large blurred layer. These may be expensive on some GPUs, but disabling blur did **not** produce a reliable improvement in the tested desktop finale.

Keep the appearance. If physical-device traces show a raster bottleneck, use a feathered radial gradient/pre-rasterized shadow and an exported blurred end frame or baked video blur. Scope will-change to nearby sections. This is lower priority than the measured issues above.

### Separate perceived speed issue: intentional entry/navigation delays

[IntroSplash.tsx:20](../apps/web/components/IntroSplash.tsx) holds for 1.4 seconds and exits over 0.55 seconds. [PageTransition.tsx:22](../apps/web/components/PageTransition.tsx) delays internal routing by 380 ms. These are design choices, not server latency. Consider showing the splash only on a first visit, or removing the hold, and starting navigation immediately while the transition plays.

## What is already right

- All seven videos have faststart MP4 layout, H.264/YUV420p, no B-frames and short keyframe spacing. Hero/capabilities are all-intra; recordings use six-frame GOPs. Long GOPs are not the culprit.
- Per-frame hero/capabilities values use refs and DOM properties, not React state renders. Showcase React state changes at chapter boundaries.
- The vault checks visibility; the exceptional typography timer pauses offscreen/when the document is hidden.
- Old Spline/brand-study components and media that are not imported by this homepage were excluded from the budget.
- Features and the newly added billboard need no extra animation runtime.

## Suggested implementation order and acceptance checks

1. Make scrolling respond promptly: one smoothing layer, time-based visual timing, proper reduced motion.
2. Gate inactive scenes and deduplicate source-frame seeks.
3. Tune first-pass case-study media preparation/layers; introduce responsive inline sources and a real portrait capabilities asset.
4. Profile physical iPhone Safari and a mid-range Android on a cold connection. Only then simplify expensive raster effects if needed.

Keep the black hero opening, reverse scrubbing, centered readable captions, Anything finale, mobile framing, chapter controls, and Book a demo navigation unchanged.

Compare identical cold and warm runs at 60/120 Hz; target no repeated >50 ms frame stalls, approximately 16.7 ms-or-better 95th-percentile frame intervals on the agreed 60 Hz target device, visual response near 100 ms, no hidden-section work and no hidden-video downloads in reduced motion. These are acceptance targets, not measured post-fix results.

## Billboard implementation

- Updated homepage composition: apps/web/app/(marketing)/page.tsx.
- Added components/marketing/BrandBillboard.tsx and BrandBillboard.module.css.
- Added public/media/brand/nullshift-billboard-800.webp (23,038 bytes), -1600.webp (90,518), -2400.webp (201,180).
- Preserved the supplied 11,579,906-byte PNG unchanged outside the repository.
- Full-bleed 16:9 desktop crop, complete 4:3 mobile composition, responsive source selection, lazy loading, async decode and reserved dimensions. No client animation code.
- Browser verification passed at 1440, 390 and 320 CSS px and WebKit 390 px. The billboard was not requested during initial hero load. The footer remains directly after Features; Book a demo still points to /book.
- Scoped ESLint, all 460 tests across 38 files, legal guard and production build (including TypeScript) passed. These verify implementation correctness, not smoothness.

## Reproduction artifacts

Diagnostic scripts and raw reports are in the task workspace, outside the repository:

- work/audit-scroll-performance.cjs and work/scroll-performance-audit/report.json
- work/audit-scroll-isolation.cjs and work/scroll-performance-audit/isolation.json
- work/audit-wheel-response.cjs and work/scroll-performance-audit/wheel-response.json
- work/verify-brand-billboard.cjs and work/billboard-checks/

Only the requested billboard and this review were added. Performance fixes remain recommendations pending approval. Existing user changes were preserved; no billing, data or deployment changes.
