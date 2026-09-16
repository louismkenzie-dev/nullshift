# Suffolk Tennis case-study prototype

Local-only study at `http://127.0.0.1:3112/showcase-prototype`.
Nothing deployed, pushed, billed or migrated. The existing homepage is unchanged.

## Latest revision — sharper desktop + portrait Parent Hub

The user requested a clearer, smoother client-story treatment and a separate mobile
Parent Hub section beneath the monitor. Both are implemented in the local prototype;
the public `/client-stories` route has not been replaced or linked to this study.

- The opening now identifies Suffolk Tennis as a client story. Each monitor chapter
  names its concrete features, explains the benefit, and includes three feature labels.
- Monitor recordings are now native 2560 × 1440, not the old 1280 × 720 video masters.
  The real app runs at 1280 × 720 with deviceScaleFactor 2. PNG device-pixel frames
  are encoded into a deterministic 30 fps H.264 master (CRF 12, every frame a keyframe).
  This avoids the recorder's logical-pixel downscaling. No upscaling or AI reconstruction.
- Scroll positions have a short frame-rate-independent damping step. Opening/closing
  states hold for readability, reverse scrolling remains deterministic, and the RAF
  loop stops once it settles. Short desktop captions no longer overlap the monitor.
- A second sticky scene shows the actual Parent Hub mobile layout: child profile,
  upcoming bookings and an individual coaching report. Mobile masters are 1170 × 2250
  (390 × 750 logical viewport, deviceScaleFactor 3), matching the photo's app area
  below the existing iOS status bar. Text is not stretched or rebuilt as a fake UI.
- The supplied **Avelina Studio robot-hand iPhone** replaces the provisional handset.
  It starts zoomed out and grows to a near-full-height portrait view. Mobile copy fades
  during the zoom; persistent chapter controls and a separate enlarged viewer remain.
  It is a photographic composite with scroll motion, not an orbitable 3D iPhone.
- The second section loads its main video sources near the viewport; still fallbacks
  and reduced-motion chapter selection remain available. No video autoplays.

### New asset provenance

User-supplied archive: `/Users/louismckenzie/Downloads/Free iPhone Mockup.zip`.
Extracted into `work/portrait-mockup.tu4bvc` outside the Git checkout. Original PSD:
`free-iphone-mockup-robot-hand-tech-presentation-avelina-studio.psd` (4500 × 3000).
Its supplied `License.pdf` permits personal and commercial work and modification,
but prohibits redistribution of the source product. Source PSD/PDFs are not served.
The original PSD is unmodified; its composite was converted to a 3000 × 2000 JPEG.
The website maps separate live-looking demo footage onto that photograph and preserves
the small foreground finger overlap with a matching clipped foreground image.

New private, Git-ignored media: `portrait-iphone.jpg`, `parent-home.mp4/.png`,
`parent-report.mp4/.png`, `parent-bookings.png`. The monitor masters/posters were updated.
The supplied iPad and landscape iPhone are not used in this case study.
An unused original Blender handset study remains private (`portrait-handset.blend/.png`)
and is deliberately not on the serving allowlist.

Repeatable capture script: `work/capture-suffolk-retina.mjs`; `--mobile-only` recaptures
the final 390 × 750 mobile layout. Native source components remain unmodified.
Capture evidence: `.local-showcase/retina-capture-evidence.json` (desktop masters and
first mobile take), `.local-showcase/portrait-capture-evidence.json` (final mobile take).
Each reports zero page errors and zero unexpected destinations. All app data is from
the existing in-memory fictional fixtures, with a reserved `.invalid` backend host.

### Files touched in this revision

- `ShowcasePrototype.tsx`: case-study framing, benefit/feature copy, damped seeking,
  readable hold points and the new second section.
- `ParentHubShowcase.tsx` (new): independently scoped portrait story, media loading,
  manual chapter navigation, scroll zoom and accessible enlarged viewer.
- `ShowcasePrototype.module.css`: feature labels, responsive typography, photo/phone
  composition, zoom framing and reduced-motion layouts.
- `lib/showcasePrototype.ts`: new allowlisted assets, Parent Hub timeline, damping and
  readable clip-time helpers. The production gate is unchanged.
- `tests/showcasePrototype.test.ts`: 20 focused tests, including new timeline/damping checks.
- This handoff document.

### Latest verification and follow-up

- 448 unit tests pass in 36 files; targeted ESLint, TypeScript and production build pass.
- A missing local shared-config resolution was repaired with a Git-ignored symlink:
  `node_modules/@nullshift/config -> ../../packages/config`. No package manifest or
  lockfile changed. Before that setup repair, 12 suites could not load their tsconfig.
- Updated `work/verify-showcase.cjs` checks Chromium desktop, short desktop, mobile,
  reduced motion and desktop/mobile WebKit, including reverse seeking, native video
  dimensions, aspect ratio, phone growth, viewport bounds, both modal viewers,
  request isolation and range handling. Final output: `work/showcase-browser-report.json`.
- Production-mode smoke test with `LOCAL_SHOWCASE=1`: homepage 200, prototype 404,
  new phone photo 404. No deployment was performed.
- No migrations, credentials, legal terms, billing or existing client data changed.
- Before publishing: obtain final story/client approval and make production delivery
  assets with an appropriate bandwidth budget. The current all-keyframe high-quality
  masters favour crisp local seeking; they are not a finished public delivery encode.
  Move the approved experience into Client Stories deliberately, retaining the original
  local-only gate rather than silently opening it. Do not add invented testimonials.

## Experience

- Photographic Studio Display scene with a perspective-matched replacement screen.
- Scroll-controlled logo reveal and three silent recordings: programme management,
  booking/payment ledger, and player performance in the Parent Hub.
- Scroll backwards to reverse the recordings. No independent autoplay timeline.
- Responsive framing, chapter navigation, reduced-motion still previews, and an
  expanded screen viewer with independent playback controls.
- No invented testimonials. Every person and payment shown in the app footage is
  fictional. The visible UI is from the actual Suffolk application, not a recreation.

## Run

From `apps/web`:

```sh
LOCAL_SHOWCASE=1 pnpm exec next dev --hostname 127.0.0.1 --port 3112
```

The route requires both `NODE_ENV=development` and `LOCAL_SHOWCASE=1`.
Production returns 404 for both page and media, regardless of the flag. The
prototype is not linked from the homepage or sitemap and has noindex metadata.

## Files changed in Nullshift

| File                                                                  | Purpose                                                                          |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `.gitignore`                                                          | Excludes `.local-showcase/` exports and recordings.                              |
| `apps/web/app/showcase-prototype/page.tsx`                            | Opt-in local page and noindex metadata.                                          |
| `apps/web/app/showcase-prototype/assets/[name]/route.ts`              | Development-only allowlisted media endpoint with byte-range support for seeking. |
| `apps/web/components/marketing/showcase/ShowcasePrototype.tsx`        | Scroll choreography, screen composition, chapters and enlarged viewer.           |
| `apps/web/components/marketing/showcase/ParentHubShowcase.tsx`        | Portrait Parent Hub story underneath the monitor.                                |
| `apps/web/components/marketing/showcase/ShowcasePrototype.module.css` | Visual design, device framing, mobile layout and reduced-motion treatment.       |
| `apps/web/lib/showcasePrototype.ts`                                   | Gate, asset allowlist, timeline, projective screen mapping and range parsing.    |
| `apps/web/tests/showcasePrototype.test.ts`                            | 17 tests covering isolation, ranges, corners and deterministic scrolling.        |
| `docs/HANDOFF-2026-09-14-showcase-prototype.md`                       | This handoff.                                                                    |

## Assets and source provenance

Original supplied PSD:
`/Users/louismckenzie/Downloads/Studio Display 007-Commercial Use/Studio Display 007.psd`.
Opened in Photoshop and exported through Save for Web to a 3000 × 2000 JPEG.
The original PSD was not saved over; its on-disk modification date remains June 2025.

Prepared assets are private, Git-ignored files in `apps/web/.local-showcase/`:

- `studio-display.jpg`, `suffolk-logo.png`
- `programme.mp4`, `ledger.mp4`, `progress.mp4`
- Matching PNG posters, end-frame inspection PNGs, raw recordings
- `capture-evidence.json`: source revision, fictional fixture origin, visible text,
  clip durations and capture errors/blocked-host observations

Suffolk source: `louismkenzie-dev/suffolktennis`, commit
`19daad328dacf56ee6bb0fd40d9b7c9c370c2ebe`.
Isolated clone is the sibling workspace directory `work/suffolk-showcase-source`.
It reuses `marketing/showcase-video/fixtures.mjs` and `mock.mjs`. Only the mock
module's export list was amended in that clone to expose its existing
`handleSupabase` handler; the actual application components were not changed.

The local Vite process was started with:

```sh
VITE_SUPABASE_URL=https://twtmkvorzpvwnznqzcrw.showcase.invalid \
VITE_SUPABASE_PUBLISHABLE_KEY=fictional-local-showcase \
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort --mode showcase
```

The recording context blocks service workers and WebSockets. Its exact-host
allowlist permits localhost and Google Fonts; requests to the reserved `.invalid`
backend are answered in memory. Other destinations are aborted. Capture reported
zero unexpected destinations and zero page errors for all three recordings.
Fixtures include Nina Hollis, Hannah Barker and Alfie Barker; they are invented.

Capture is 1280 × 720 logical resolution with deviceScaleFactor 2; screen recordings
are cropped out of the recorder's padded canvas and encoded as 1280 × 720 H.264
with frequent keyframes for scroll seeking. Posters retain 2× resolution. It is
a short prototype recording, not the separate 50 fps narrated marketing film.

Supporting scripts outside the Git worktree:

- `work/inspect-suffolk-showcase.mjs`: initial fixture-backed screen inspection.
- `work/capture-suffolk-showcase.mjs`: repeatable three-clip capture and encoding.
- `work/verify-showcase.cjs`: Chromium/WebKit browser assertions and screenshots.
- `work/showcase-browser-report.json`: final browser results, produced on success.

The source Vite server and production-mode test server are stopped after use.
Only the Nullshift local development server is left running for review.

## Initial-prototype verification (before the revision above)

- All 445 existing and new unit tests passed (36 test files).
- New focused suite: 17 tests passed.
- Targeted ESLint, TypeScript and `git diff --check` passed.
- Production build and existing legal guard passed.
- Production-mode smoke test with `LOCAL_SHOWCASE=1`: homepage 200;
  showcase page 404; mockup asset 404.
- Browser script covers desktop, short desktop, mobile, reduced motion, desktop
  WebKit and mobile WebKit. It checks frame seeking and reversal, paused playback,
  screen bounds, chapter controls, modal dismissal, horizontal overflow, page errors,
  external requests, mutation requests, and media range responses.
- Browser findings are recorded in the sibling `work/showcase-browser-report.json`.
  WebKit is automated engine testing, not a claim of physical iPhone/Safari testing.

## Before publication

This is an approval prototype, not a public asset release. Device.Graphics permits
commercial website usage but restricts source/stock redistribution. Keep the PSD
and reusable source assets private and confirm the intended layered animation use
before moving prepared exports into a deployable asset store.
Reference: https://www.device.graphics/info#license

Approve the visual direction before integrating this section into the homepage.
This static photograph cannot provide a true orbit around the display; Blender
assets are still needed for that separate part of the larger scroll story.
No database migrations, billing changes or new production environment variables
are needed for this prototype.
