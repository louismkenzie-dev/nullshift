# Immersive homepage — local implementation, 14 September 2026

Preview branch: `claude/direct-debits-portal-handoff-g3bg7p`. No main merge,
production deployment, database migration, client-record edits or billing changes.
`PRICING_PUBLIC` remains false. `SystemWalkthrough.tsx` remains in place.

## What changed

The homepage now has a full-bleed, object-led hero: oversized Nullshift wordmark,
editorial copy at the edges, graphite materials, cream typography and emerald
accents. An original AI-generated sculpture replaces the schematic hero lattice.
Desktop scroll gently enlarges the artwork as the copy recedes; pointer movement
adds a very small drift. This is a 2D rendered asset, **not a fully orbitable 3D
scene**. The existing scroll-built system and five worked-example screens remain.
The partner badge remains. Hero text is no longer split or delayed by animation.

The `/demo` playground is a complete, isolated demonstration for a fictional adult
movement studio. Booking creates a paid demo ticket; scanning admits it and updates
attendance; duplicate, unknown and unpaid tickets are rejected. Staff can mark paid
attendees manually. Reset restores the fixtures. Everything is React state in one
tab: no database, local storage, login, email, camera or payment integration. Leaving
the route or refreshing resets it. It is deliberately noindex. This is not a TDE or
Suffolk sandbox, and its recordings are never described as real client workflows.

The homepage reel switches between three seven-second, silent H.264 recordings of
that playground. Playback starts only on screen; pauses offscreen and when the tab
is hidden; reduced-motion visitors see a poster until they choose Play. A visible
pause button remains available. Videos are muted, looping and playsInline.

## Reference observations

Captured through fresh, unauthenticated Chromium sessions at 1440×900. Reference
screenshots are documentation only, never imported into the public website.

- [ORYZO](https://oryzo.ai/): full-screen canvas scene, large editorial wordmark,
  small peripheral navigation/copy and a physical cork object on a workbench.
  Scroll moves the object forward, changes orientation/background and introduces
  extremely large text behind it; the wordmark contracts into navigation. Later
  sections use canvas scenes and video. Wheel travel is deliberately smoothed and
  capped. `oryzo-0.png` is the hero; `oryzo-1.png`–`oryzo-3.png` are early transition
  states; `oryzo-deep-15.png` and `oryzo-deep-49.png` are roughly 3,200 and 10,000px
  into the scroll. Some typography is captured mid-transition, intentionally.
- [Halo](https://www.usehalo.com/): bright cyan/white palette, rounded navigation,
  a large dimensional ring, floating interface fragments, followed by a product
  dashboard reveal. Canvas rendering and scroll transitions provide the depth.
  `halo-0.png`–`halo-3.png` show the hero and subsequent scroll states, after rejecting
  optional cookies. Nullshift keeps Kyma, not Halo's palette or brand artwork.

## Public client assets and provenance

All three screenshots are public marketing pages, not authenticated application
screens. No accounts were accessed and no client/children/counselling records were
captured. Consent overlays were dismissed. PNGs are 1440×900, palette-optimised and
each comfortably below 400 KB.

| Files in `apps/web/public/clients/`                                                 | Source / purpose                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `the-dance-exclusive-site.png`                                                      | [TDE public homepage](https://app.thedanceexclusive.co.uk/)                                                                                                                                                                                                                                                                        |
| `suffolk-tennis-site.png`                                                           | [Suffolk public homepage](https://www.suffolktennis.online/); hero only, not the junior-player sections below                                                                                                                                                                                                                      |
| `newfuture-therapy-site.png`                                                        | [NewFuture public homepage](https://www.newfuturetherapy.co.uk/); Essential Only, then Explore the site                                                                                                                                                                                                                            |
| `newfuture-therapy-logo.png`, `newfuture-therapy-logo-dark.png`                     | Transparent 1000×255 primary lockup, exported using the client's original [logo engine](https://github.com/louismkenzie-dev/New-Future-Therapy/blob/main/src/lib/brand/logoEngine.ts), file blob `c92a17fe090517d60f1437c74444bd682954ffeb`; canonical Cormorant Garamond 600 / DM Sans 400 fonts loaded; sage/reversed colourways |
| `demo-booking.mp4`, `demo-scanner.mp4`, `demo-register.mp4`                         | Real browser interaction with the fictional `/demo`, seven seconds each, 1100×680, silent H.264; no client branding or data. Extra page-bottom space and a minimum workspace height keep recordings framed consistently.                                                                                                           |
| `demo-booking-poster.webp`, `demo-scanner-poster.webp`, `demo-register-poster.webp` | Matching stills for no-motion/lazy playback                                                                                                                                                                                                                                                                                        |

The Dance Exclusive's public site currently says **14 venues**, while the earlier
internal snapshot recorded 17. These may count different things. Public copy now
says **across Essex** rather than asserting either count. Existing customer records
and unrelated historical proof figures have not been modified.

## Original generated artwork

Project asset: `apps/web/public/marketing/system-object.webp` (1536×1024, about 72KB).
Generated with the built-in image-generation tool, inspected, then compressed to
WebP at quality 86. Original PNG remains in the generation output; the website uses
only the version committed in this repository. Full generation brief: [hero-prompt.md](hero-prompt.md).

### To take this all the way to ORYZO-style 3D

This implementation captures the composition, material treatment and restrained
scroll movement. A bitmap cannot independently rotate, separate layers or reveal
new surfaces. For that next level, create an original asset rather than taking
ORYZO's models/videos:

1. In Blender, model four bevelled rounded-square frames as separate objects, plus
   thin green glass separators. Use the committed render as the material/composition
   brief. Keep the origin shared, with each layer separately named.
2. Light with a large softbox and a restrained studio environment. [Poly Haven's
   asset library](https://polyhaven.com/license) provides CC0 models, textures and
   HDRIs usable commercially; this does not grant rights to other sites' imagery.
3. Deliver both a compressed GLB with separate layers and a 6–10 second silent
   turntable/exploded-view MP4, plus a poster. The former permits true scroll-driven
   camera/layer movement; the latter is simpler but cannot respond in real 3D.
4. Lazy-load a Three.js scene only above 900px, cap pixel ratio, stop rendering
   offscreen and preserve this image for mobile, reduced motion and WebGL failure.
   The repo already has Three.js. No new 3D runtime was added in this change.

## Verification and repeatability

Passed locally: `pnpm typecheck`, 428 Vitest tests across 35 files, ESLint on every
changed TS/TSX file, and `pnpm --filter @nullshift/web build` (including legal guard).
Vite prints its existing future-config warning about `__dirname`; tests pass.

Production-build browser matrix: Chromium 1440px, Chromium 390px, Chromium reduced
motion, WebKit 1440px, WebKit 390px reduced motion. Checks include visible hero,
loaded artwork, no page errors, no horizontal overflow while scrolling, complete
demo journey, duplicate/unpaid protection, manual attendance, reset and return
navigation. No mutation requests were made by demo interactions. Additional media
checks cover all three clips, explicit pause, offscreen pause and opt-in playback
under reduced motion. These are browser/emulation checks, **not physical Android
or iPhone testing**, and WebKit is not a claim of testing the installed Safari app.

Two hydration issues found during browser verification were fixed: SVG trig values
in the partner badge now have deterministic precision; IntroSplash/Parallax use
SSR-safe motion preference state. Reduced-motion splash is hidden in CSS and does
not lock scrolling. The synchronous preference guard and anime scope reversion in
`lib/motion.ts` are unchanged, as is the existing 900px heavy-motion threshold.

Reusable smoke test: `apps/web/scripts/verify-immersive.cjs`. Run against a fresh
production server (for example `pnpm --filter @nullshift/web exec next start --port
3109`). Provide an installed Playwright module through `PLAYWRIGHT_MODULE` if it is
not resolvable normally, and set `DEMO_BASE` to the target URL. Optional
`DEMO_SCREENSHOTS` chooses the output directory; default is a new temporary folder.
No package or lockfile changes were needed. Preview Lighthouse measurements belong
to the deployment report; do not confuse the local build with deployed performance.

## File change map

Paths below are relative to the monorepo `nullshift/` directory.

- `apps/web/app/(marketing)/page.tsx`: new hero, fictional demo positioning/reel.
- `apps/web/app/demo/page.tsx`: standalone noindex playground route.
- `apps/web/components/marketing/immersive/HeroStage.tsx`, `HeroStage.module.css`:
  object-led layout, responsive/static fallback and scoped scroll animation.
- `apps/web/components/marketing/immersive/DemoReel.tsx`, `DemoReel.module.css`:
  selectable lazy recordings and accessible playback control.
- `apps/web/components/marketing/demos/BusinessDemo.tsx`, `BusinessDemo.module.css`:
  interactive fictional studio, responsive UI and all three views.
- `apps/web/lib/businessDemo.ts`: deterministic fixtures and guarded reducer.
- `apps/web/components/marketing/immersive/LiveSystems.tsx`: real public screenshots
  alongside retained illustrated behaviours; reduced-motion spring handling.
- `apps/web/components/marketing/DeviceFrame.tsx`: shorter address-bar link label.
- `apps/web/components/ClaudePartnerBadge.tsx`: stable SVG coordinate precision.
- `apps/web/components/IntroSplash.tsx`, `Parallax.tsx`: reduced-motion hydration fixes.
- `packages/content/src/clientStories.ts`: screenshot metadata, real NewFuture logo,
  and removal of disputed public venue-count claims.
- `apps/web/tests/business-demo.test.ts`: booking, scan, payment-state and reset tests.
- `apps/web/tests/client-stories.test.ts`: assert the deliberately non-numeric venue stat.
- `apps/web/scripts/verify-immersive.cjs`: repeatable multi-browser flow check.
- `apps/web/public/marketing/system-object.webp`: original AI hero artwork.
- Eleven assets in `apps/web/public/clients/`: each listed in the provenance table above.
- `docs/references/README.md`, `hero-prompt.md`, ten PNG reference captures:
  implementation notes, exact prompt, ORYZO/Halo observations.

No migration or environment configuration is required. Louis still needs to review
the preview, test on his physical phone/Safari, confirm any exact venue-count claim,
and explicitly approve a production merge/deploy if desired.
