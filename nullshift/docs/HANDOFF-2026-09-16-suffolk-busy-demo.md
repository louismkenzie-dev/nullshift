# Suffolk showcase: fictional activity and screen padding

Local website change only. No deployment, live client data, payment settings or client application source changes.

## Visible result

- £64,750 paid / 255 paid bookings; £2,100 awaiting payment / 12 bookings.
- £525 refunded / 3 bookings; 8 complimentary places.
- Nine programmes, 278 active ledger entries, plus one unfinished checkout.
- Fictional demo label retained on the showcase. These are invented demonstration figures, not client performance claims.
- Admin capture header increased from 56px to 88px; solid header prevents scrolling content showing through the tabs.
- All monitor footage inset 40px horizontally and 22.5px vertically inside the existing screen projection (16:9 preserved). Intro logo reduced from 590px to 540px.
- Stage uses overflow clipping rather than a hidden scroll container: chapter-button focus can no longer internally scroll the monitor/logo behind the website navigation.
- Programme and ledger recordings remain native 2560 × 1440. Other footage and the Parent Hub are unchanged.

## Website files

- `components/marketing/showcase/ShowcasePrototype.module.css`: screen safe area, light surround and logo size.
- `lib/showcasePrototype.ts`: refreshed admin assets use version 3 URLs in embedded and prototype views.
- `tests/scrollFilmHero.test.ts`: updated URL assertions.
- `public/media/client-stories/suffolk-tennis/{programme,ledger}.{mp4,webp}`: refreshed fictional recordings/posters.
- Private originals refreshed in `apps/web/.local-showcase`, with `busy-admin-capture-evidence.json`.

Paths above are relative to `apps/web`.

## Reproducible capture

Workspace scripts outside the git repo, relative to the task workspace:

- `work/suffolk-busy-fixtures.mjs`: deterministic invented people/bookings/programmes, totals and ID assertions; augments original in-memory fixtures only.
- `work/capture-suffolk-retina.mjs --busy-admin`: captures just programme/ledger into `work/suffolk-busy-capture`. Header spacing and thousands-separator formatting are recording-only overrides. No client source edits.
- `work/publish-suffolk-busy-capture.mjs`: validates evidence, backs up old media, encodes H.264 CRF16/GOP6/faststart and WebP95, then updates local website files. This script does not deploy.
- `work/verify-busy-showcase.cjs`: browser checks for home, Client Stories/mobile/reduced-motion, and standalone prototype.

The isolated Vite capture source is `work/suffolk-showcase-source`, revision `19daad328dacf56ee6bb0fd40d9b7c9c370c2ebe`. Start on 4173 using the reserved fictional Supabase URL and fake key; the capture mocks every data response, blocks WebSockets and unexpected outbound hosts. Captures recorded zero unexpected requests and zero page errors.

Previous media checkpoint: `work/suffolk-before-busy-6mK5W3/{public,private}`.

## Verification

- Totals/booking IDs asserted before capture; rendered ledger totals asserted in-browser.
- Both recordings/posters visually inspected at native resolution.
- Browser: new 2560 × 1440 media loaded, versioned URLs, correct ledger chapter, safe-area inset, no horizontal overflow, expanded viewer opens/closes, no page errors.
- All 455 tests / 37 files passed; TypeScript and focused ESLint passed.
- Production build and legal guard passed. Not deployed.
