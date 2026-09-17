# Capabilities scroll film

Added directly after DesignTalent (the centred exceptional branding section), before PlatformFeatures. Original hero and existing case-study interactions untouched.

## Media and choreography

- Source: `/Users/louismckenzie/Documents/Codex/2026-09-16/wha/outputs/capabilities/nullshift-capabilities-scroll.mp4`.
- Copied without transcoding to `apps/web/public/media/capabilities/`, alongside the supplied poster.
- 1280 × 720, 24 fps, 16 seconds, 384 independently seekable H.264 frames, approximately 11.4 MB, no audio. Source and website copy SHA-256: `6c8716b8e044abdcde7536615efa39ac8536602f1f26e340206084d6a2ec8bce`.
- Native sticky scroll, same 0.18 catch-up and coalesced seeking as ScrollFilmHero. No autoplay, new animation dependency or scroll locking.
- Headline order: Bookings → Payments → Finances → Instruments → Management → Staffing.
- Headline times match supplied `scroll-cues.json`. Instruments spans both telemetry and market-instrument shots; Management is separate, as confirmed by the user.
- All headlines are centred in the scene, over a heavily feathered radial shadow that appears with the text. Blur is 12px and vertical movement 40px, matching the hero treatment.
- Final scene blurs to 18px while fading fully to black; a short black hold precedes centred emerald ANYTHING. Final word is separate from the laptop-anchored text and uses the whole scene centre.
- Film loads only when the section approaches the viewport. Reduced motion avoids loading it and shows a compact static list. Failed video loading also produces the static list.
- All layouts use full-bleed cover. Portrait/tall layouts follow the handset's horizontal movement with a responsive, scroll-dependent crop and a modest 1.08 scale; the laptop is deliberately cropped in favour of a mobile-app-led composition. No letterboxing. A 4K or purpose-rendered portrait master would improve detail; the source video remains unchanged.

## Changed files

- `apps/web/app/(marketing)/page.tsx`: inserts the new section.
- `apps/web/components/marketing/immersive/CapabilitiesFilm.tsx`: isolated client-side scroll/seek and loading controller.
- `apps/web/components/marketing/immersive/CapabilitiesFilm.module.css`: full-bleed stage, centred headlines with feathered shadow, handset-focused mobile framing, centred finale and static fallbacks.
- `apps/web/lib/capabilitiesFilm.ts`: media config, Blender cue timing, pure frame/framing helpers.
- `apps/web/tests/capabilitiesFilm.test.ts`: ordered cues, midpoint readability, blackout-before-finale, bounds, reversing, unloaded metadata and responsive handset-crop assertions.
- `apps/web/public/media/capabilities/nullshift-capabilities-scroll.mp4` and `nullshift-capabilities-poster.jpg`: supplied assets.

## Verification

- 460 tests across 38 files passed.
- TypeScript, focused ESLint, production build and legal guard passed.
- Chromium at 1440, 390, 320 and 600px widths; WebKit at 390px: lazy loading, each cue, forward/reverse seeking, paused playback, full-cover video, centred text, feathered shadow, text boundaries, no horizontal overflow, final green colour and exact scene-centred finale.
- Reduced motion and deliberately failed video request: compact static fallback, all labels visible, no page errors.
- Screenshots and report: task workspace `work/capabilities-checks/`; verification script: `work/verify-capabilities.cjs`.

Next.js guidance kept this as an isolated client boundary; React guidance kept transient scroll state out of React re-renders; browser checks covered both the animated and fallback paths.

Local preview only. No deployment, billing, database or client-data changes.
