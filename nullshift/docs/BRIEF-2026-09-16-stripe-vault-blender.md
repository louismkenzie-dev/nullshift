# Nullshift — financial services vault

## Creative brief for the Blender session

Create a premium, photorealistic vault for the financial services section of
Nullshift’s website. This follows the Suffolk Tennis case study, not the hero.
The message is established payment infrastructure with bespoke software around it.
This is a decorative metaphor, not a claim that Nullshift is a bank, custodian
or that security risk is eliminated.

### Art direction

- A precision-engineered compact vault: square graphite housing, substantial
  circular brushed-metal door, intricate machined wheel, hinges and locking bolts.
- Near-black backdrop: exact sRGB #0a0a0a. Warm cream #f4f4e8 reflections,
  restrained emerald #10b981 indicator or seam. No olive, mint, purple, neon,
  sci-fi HUDs, padlocks floating around it, text or fake security certifications.
- Subtle anisotropic metal, realistic bevels, controlled reflections. Premium
  product photography rather than a cartoon safe. The object must read clearly
  on a dark screen without clipping highlights.
- Orthographic or long-lens perspective; fixed camera, elevated about 12 degrees.
  Keep the whole object within the central 70% of a square frame, with room for
  all rotations. No baked-in vignette, UI frame or floor horizon.
- Do not include the Stripe logo in the render. The website displays the original
  Stripe logo separately, stationary, with its own clear space.
- No client data, account balances, card details or fabricated security metrics.

### Motion

- 8-second, 30 fps, linear 360-degree turntable of the entire closed vault.
  Start and end on a strong three-quarter view, about 22 degrees from front.
- Clockwise rotation with no camera travel and no abrupt lighting changes.
  Keep angular speed constant so the site can map frames to scroll position.
- Optionally rotate the central wheel slowly as a secondary motion. Keep the
  vault closed: this is about considered protection, not exposing the contents.
- Deliver a separate optional 8-second seamless looping export if requested,
  but scroll control is the current website interaction; do not force autoplay.

### Deliverables

1. The editable .blend file with packed assets, documented materials and lighting.
2. 1440 × 1440 lossless PNG sequence, 240 frames. No motion blur for crisp scrubbing.
3. Web-ready H.264 MP4, 1080 × 1080, yuv420p, no audio, fast-start, every frame a
   keyframe for reliable seeking. Aim below 15 MB; provide a 720px variant too.
4. A 1440 × 1440 static poster of the opening three-quarter frame.
5. A contact sheet showing front, side, back and three-quarter angles.

Use a world/background that renders to #0a0a0a in the delivered sRGB files.
Check the actual exported background pixels after colour management; simply
setting a Blender world colour is not sufficient. If a perfect match is not
possible, also provide transparent PNG masters for compositing.

Suggested handoff filenames:

- nullshift-vault-scroll.mp4
- nullshift-vault-scroll-720.mp4
- nullshift-vault-poster.jpg
- nullshift-vault.blend

Do not overwrite the existing homepage hero video.

## Website integration

Current motion study:
`apps/web/components/marketing/VaultVisual.tsx`.
Current section and styles:
`apps/web/components/marketing/FinancialServices.tsx`,
`apps/web/components/marketing/FinancialServices.module.css`.

The render will replace only the temporary CSS object. Keep the typography,
Stripe logo, text and responsive layout outside the video. On mobile, stack the
text above the visual. Respect reduced motion with a static poster, lazy-load
below-the-fold media, and keep a poster fallback if playback/seeking fails.
Remove the visible “motion study” caption only after the final asset is approved.

## Copy and mark boundaries

The owner confirms that Stripe Connect displays “Nullshift Development Ltd
partners with Stripe for secure financial services.” The section uses this
descriptive relationship wording; it does not claim certified membership of
the Stripe Partner Ecosystem or show a partner badge.

Stripe payment processing/payment authentication and Nullshift platform
sign-in/permissions are described separately. No “completely safe”, blanket
compliance certification, guarantee of fraud prevention or custody claims.

Official Stripe wordmark source (unaltered slate SVG on a light background):
https://images.stripeassets.com/fzn2n1nzq965/6XFEUA9FzMBMphYdcUab19/37a1e07201366a351f7956560ccac09d/Stripe_wordmark_-_slate.svg?q=80&w=1082

Source pages reviewed:

- https://stripe.com/legal/marks
- https://docs.stripe.com/security/guide

The Stripe mark retains Stripe’s original colour; it is not recoloured emerald.
