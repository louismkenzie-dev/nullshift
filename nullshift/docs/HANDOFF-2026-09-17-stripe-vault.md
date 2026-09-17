# Stripe section: delivered Blender vault

Implemented locally. No deployment, billing, authentication, database or client-data changes.

## Result

- Replaced the temporary CSS vault and “motion study” caption with the supplied Blender turntable.
- Kept the established copy, section order and mobile copy-above-visual layout.
- One clockwise 360-degree turn follows normal page scrolling, reverses with upward scrolling and holds when scrolling stops. The opening view is held until the scene reaches 72% of viewport height; the turn finishes while the scene is still visible.
- The 240-frame, 30 fps delivery maps to exact frame indices from 0 to 239, with the shared single-outstanding/latest-target seek controller. No autoplay, WebGL library, scroll lock or continuous render loop.
- Video attaches only within 600 px of the viewport. Animation scheduling is gated to section and document visibility. Reduced motion unloads the video and uses a static poster. Errors restore the poster.
- Replaced the slate wordmark on a white plate with Stripe’s purple glyph icon. The link remains accessible and points to Stripe Payments. No white CSS backplate, recoloring or logo animation.

## Assets and provenance

User-supplied archive, preserved unchanged:

`/Users/louismckenzie/Documents/Codex/2026-09-16/wha/outputs/vault/nullshift-vault-delivery.zip`

Only the two finished videos and poster derivatives are shipped; the 480 master frames, Blender source, archive and review HTML are not placed in the public website.

- Desktop: 1080×1080, H.264, 30 fps, 8 seconds, 5,932,263 bytes.
- Layouts up to 760 px: 720×720, same timing, 3,078,676 bytes.
- Responsive WebP posters: 720 px / 22,968 bytes and 1080 px / 39,024 bytes, derived from the delivered opening-frame JPEG.
- Background remains #0a0a0a; square contain framing preserves the complete object and original margins.
- The icon is an unchanged SVG used by [Stripe’s own website](https://stripe.com/): [purple glyph asset](https://images.stripeassets.com/fzn2n1nzq965/1hgcBNd12BfT9VLgbId7By/01d91920114b124fb4cf6d448f9f06eb/favicon.svg). Stripe’s general [brand-asset and marks guidance](https://stripe.com/newsroom/information) applies. It is the current slanted-stripe glyph, not a fabricated S symbol.

This is a rendered 3D object controlled by scroll, not a live interactive 3D mesh. The Blender original remains editable in the supplied archive.

## Changed files

Relative to `apps/web/`:

- `components/marketing/VaultVisual.tsx`: rendered vault, loading, seeking, visibility, reduced-motion and error lifecycle.
- `components/marketing/FinancialServices.tsx`: purple glyph source and dimensions.
- `components/marketing/FinancialServices.module.css`: square scene/media layout; removed obsolete CSS model geometry, caption and white logo backplate.
- `lib/vaultFilm.ts`: media configuration and pure progress/frame mapping.
- `tests/vaultFilm.test.ts`: opening/end holds, reverse travel and exact frame boundaries.
- `public/media/vault/nullshift-vault-scroll.mp4`
- `public/media/vault/nullshift-vault-scroll-720.mp4`
- `public/media/vault/nullshift-vault-poster-1080.webp`
- `public/media/vault/nullshift-vault-poster-720.webp`
- `public/logos/stripe-glyph-purple.svg`

Also added this handoff. Existing unrelated edits and original wordmark were preserved.

## Verification

- 475 tests across 41 files passed.
- Production build with TypeScript and legal guard passed.
- Scoped ESLint and diff whitespace checks passed.
- Browser checks: 1440 px desktop, 390 px phone layout, 320 px narrow layout, WebKit phone layout, reduced motion and failed-video fallback.
- Tested first/last frames, intermediate angles, reverse travel, stationary hold, no initial-page vault MP4 request, zero offscreen vault mutations, responsive source switching, runtime reduced-motion changes, no horizontal overflow, transparent logo-link background and caption removal.
- Local server serves video byte ranges correctly (206 Partial Content).
- Desktop and phone screenshots inspected. These are browser-engine tests, not physical-phone hardware benchmarks.

Task-workspace evidence: `work/verify-vault.cjs` and `work/vault-checks/`.

Preview: http://127.0.0.1:3112/#financial-services
