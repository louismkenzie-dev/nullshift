# Monochrome client logo strip

## Implemented

- The homepage Trusted by strip now renders monochrome marks. Original shared client assets and case-study branding are unchanged.
- LTA: existing SVG rendered black through scoped CSS.
- The Dance Exclusive: exact no-splat vector wordmark from the inline logo on [the official website](https://www.thedanceexclusive.co.uk/), saved as `public/clients/the-dance-exclusive-wordmark.svg`. Original paths preserved.
- NewFuture Therapy: leaf-only geometry from the owner's `Downloads/NewFutureTherapy_leaf_sage.svg`, saved as `public/clients/newfuture-therapy-leaf.svg`. Unused external font import omitted; leaf veins and proportions preserved.
- WeHost: owner's supplied screenshot saved unchanged as `public/clients/wehost-wordmark.png`. CSS centres the lettering, clips blank margins and blends its white paper into the cream strip. This preserves the supplied Shegisha artwork without installing or substituting a font.
- Next.js image guidance informed explicit dimensions, lazy loading and small image requests. No new animation dependency or runtime font request.
- Existing pause/resume, offscreen pause, reduced-motion and no-JavaScript behavior remain intact.

## Still needed

The exact School's Out Activities splat asset. Public main/booking sites and the available local assets contain the older wordmark, not a clean standalone splat. The current wordmark is temporarily monochrome, not claimed as the requested replacement. Asked the owner to upload the splat.

## Changed this turn

- `apps/web/components/marketing/TrustedBy.tsx`
- `apps/web/components/marketing/TrustedBy.module.css`
- Three new brand assets listed above
- This note

## Verification

- 477 tests / 41 files passed.
- Scoped ESLint and production build passed.
- Browser verification: desktop, mobile, 320 px, WebKit, reduced motion, no JavaScript; image loading, seamless repetition, movement, pause/resume, offscreen pause and overflow checked.
- Desktop and reduced-motion screenshots inspected; blending applied at the marquee viewport to avoid a white rectangle behind WeHost while the track is transformed.
- Browser checks use the existing bundled Playwright fallback because agent-browser is unavailable.

No deployment, billing, client data or database changes.

Preview: http://127.0.0.1:3112/#trusted-by
