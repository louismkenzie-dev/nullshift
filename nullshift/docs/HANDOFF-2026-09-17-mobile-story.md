# Mobile Parent Hub and capabilities refinement

## Implemented locally

- Up to 900px wide, the Parent Hub is now a purpose-built, normal-flow mobile section. The robotic-hand photograph, nested phone frame, long sticky zoom and overlay controls are replaced by readable copy, 48px Players / Bookings / Progress tabs, and a full-width actual UI capture using fictional data.
- Tabs support touch, keyboard arrows, Home/End and standard tab/tabpanel semantics. The interface images keep their original aspect ratio. No nested scrolling, automatic slide changes or mobile Parent Hub videos.
- The desktop Parent Hub retains its original scroll choreography and imagery. The responsive branch uses a hydration-safe external-store subscription, and the desktop media setup refuses to load at mobile widths.
- Mobile capabilities use a pure black backdrop with the same headline sequence and blur movement, ending on green Anything. No video source or poster is acquired at mobile widths; resizing from desktop removes the source. Desktop video is retained.
- Mobile text starts on Bookings without waiting through the desktop film's opening lead-in. Reduced motion retains the static feature list.
- Footer restored to the existing cream Kyma CTABand: “See what’s possible. For your business.” and “Book a demo”. This links to the existing enquiry flow; the form/backend are unchanged.
- Earlier 30% School's Out logo enlargement remains in this local checkout.

## Changed files

- `apps/web/components/Footer.tsx`
- `apps/web/components/marketing/showcase/ParentHubShowcase.tsx`
- `apps/web/components/marketing/showcase/MobileParentHubShowcase.tsx` (new)
- `apps/web/components/marketing/showcase/MobileParentHubShowcase.module.css` (new)
- `apps/web/components/marketing/immersive/CapabilitiesFilm.tsx`
- `apps/web/components/marketing/immersive/CapabilitiesFilm.module.css`
- `apps/web/lib/capabilitiesFilm.ts`
- `apps/web/tests/capabilitiesFilm.test.ts`

## Verification

- 523 local unit tests, targeted ESLint, TypeScript and production build passed.
- Browser checks: 390px phone, 320px narrow phone, WebKit iPhone-sized viewport, WebKit landscape, reduced motion and desktop.
- Verified tab selection/keyboard navigation, 44px+ touch targets, no horizontal overflow, no mobile Parent Hub video/hardware requests, no mobile capabilities video/poster requests, black background, final Anything, restored CTA link and unchanged desktop video.
- Verified desktop → mobile → desktop resizing removes/reloads video sources correctly.
- Screenshots and script: task workspace `work/mobile-redesign-checks/` and `work/verify-mobile-redesign.cjs`.
- React/Next.js skill guidance informed conditional media acquisition, stable hydration and responsive image sizing. Browser skill guidance informed actual viewport verification.

No deployment in this turn. Production remains the 17 September release documented in `DEPLOY-2026-09-17-production.md`. A future release must continue to retain the newer main-branch care-plan preview change; the local website branch does not contain that commit.
