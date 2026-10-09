# @nullshift.dev — Content pillars, hooks, hashtags, cadence

Companion to PROFILE.md and CALENDAR-30-DAYS.json. Rules that override everything else
are in `docs/partners/PROGRAMME-BRIEF-2026-10-09.md`.

## What Instagram is for (so we post the right things)

Instagram will not close a £3k build on its own. Its job is three-fold:

1. **Make Nullshift look like the studio it is** when a prospect, partner agency or client's
   accountant looks us up after a `/start` plan, an email or a referral. (Metric: profile
   visits → link taps.)
2. **Feed `/start`** with warm traffic that already understands "bespoke, owned, run for
   you". (Metric: link taps → plans started, tracked in the CRM with `utm_source=instagram`.)
3. **Warm the partner-programme list** — the 60–75 agencies a week we email should find a
   grid that proves we deliver. (Metric: agencies replying "saw your Instagram".)

Everything below serves those three. If a post does none of them, it does not go up.

## Owned media inventory (exact paths)

Films and clips — all under `apps/web/public/`:

| Asset | Path | Use |
|---|---|---|
| Logo opener | `nullshift-logo-opener.mp4` | Reel intros, story bumpers |
| Hero film, portrait | `media/hero/nullshift-system-opens-portrait.mp4` (+ `-portrait-poster.jpg`) | Brand reels (9:16 native) |
| Hero film, landscape / scroll | `media/hero/nullshift-system-opens-desktop.mp4`, `media/hero/nullshift-system-opens-scroll.mp4`, poster `media/hero/nullshift-system-opens-poster.jpg` | Feed posts (crop to 4:5) |
| Brand study film | `media/hero/nullshift-brand-study.mp4` (still: `media/hero/nullshift-brand-study.jpg`) | Mood / studio reels |
| Capabilities film, portrait | `media/capabilities/nullshift-capabilities-portrait.mp4` (+ `-portrait-poster.jpg`) | "What we build" reels |
| Capabilities film, scroll | `media/capabilities/nullshift-capabilities-scroll.mp4` (poster `nullshift-capabilities-poster.jpg`) | Feed cutdowns |
| Vault film | `media/vault/nullshift-vault-scroll.mp4`, `media/vault/nullshift-vault-scroll-720.mp4`, posters `nullshift-vault-poster-1080.webp` / `-720.webp` | Payments / security posts |
| Brand billboard stills | `media/brand/nullshift-billboard-800.webp`, `-1600.webp`, `-2400.webp` | Feed text-cards background, FB cover |
| Founder portrait | `louis-mckenzie.jpg` (3071×4095) | Founder cameo covers, Behind the build |
| Open Graph image | `og-image.png` | Profile photo source |

Suffolk Tennis product media — `apps/web/public/media/client-stories/suffolk-tennis/`:

| Asset | Files | Shows |
|---|---|---|
| Parent home | `parent-home.mp4`, `parent-home-inline.mp4`, `parent-home-inline-retina.mp4`; stills `parent-home.webp`, `-w390/-w780/-w936.webp` | The parent hub on a phone |
| Parent report | `parent-report.mp4`, `parent-report-inline.mp4`, `parent-report-inline-retina.mp4`; stills `parent-report.webp`, `-w390/-w780/-w936.webp` | Player report a parent sees |
| Parent bookings | stills only: `parent-bookings.webp`, `-w390/-w780/-w936.webp` | Booking a session |
| Programme | `programme.mp4`, `programme-inline-desktop.mp4`, `programme-inline-mobile.mp4`; stills `programme.webp`, `-w640/-w1280/-w1600.webp` | Programme / schedule screen |
| Progress | `progress.mp4`, `progress-inline-desktop.mp4`, `progress-inline-mobile.mp4`; stills `progress.webp`, `-w640/-w1280/-w1600.webp` | Player goals and progress |
| Ledger | `ledger.mp4`, `ledger-inline-desktop.mp4`, `ledger-inline-mobile.mp4`; stills `ledger.webp`, `-w640/-w1280/-w1600.webp` | Payments ledger (Stripe to the LTA) |
| Device shots | `portrait-iphone.jpg` (+ `-w960/-w1600/-w2400.webp`), `studio-display.jpg` (+ `-w960/-w1600/-w2400.webp`) | Hero-grade stills for carousels |
| Logo | `suffolk-logo.webp` | End cards |

Client logos and site screenshots — `apps/web/public/clients/`:
`the-dance-exclusive-site.png`, `the-dance-exclusive-logo.png`, `the-dance-exclusive-logo-dark.png`,
`the-dance-exclusive-wordmark.svg`, `newfuture-therapy-site.png`, `newfuture-therapy-logo.png`,
`newfuture-therapy-logo-dark.png`, `newfuture-therapy-leaf.svg`, `suffolk-tennis-site.png`,
`suffolk-tennis-logo.png`, `lta-logo.svg`. (`demo-booking.mp4`, `demo-register.mp4`,
`demo-scanner.mp4` also exist here — confirm which client they belong to before publishing;
not used in the 30-day calendar.)

Hosted video: the NewFuture Therapy testimonial is on Mux, playback id
`hevvtK01oksR8HWcs5fJAjbICgIoPCHlW3zY89ZywMRA` — download the MP4 rendition from the Mux
dashboard (or record the player on `/client-stories#newfuture-therapy`) and use the
auto-captions track.

Screen-recordable pages: `nullshift.co.uk` (scroll-film hero, "We build it. We run it. We
grow it."), `/client-stories` (three live demos: TDE pricing, NewFuture Reflections, Suffolk
reports), `/pricing`, `/start`, `/about`. Public plan prices come from `packages/content/src/pricing.ts`
(Core £149 / Pro £249 / Max £399 per month) — never the frozen v1 bases in `lib/carePlans.ts`.
Note `/systems-lab` now 301-redirects to `/start`
— do not film or link it.

Not available / not yet: Amie (TDE) and Ollie (Suffolk) video testimonials — owed. Office or
team photography — none in the repo. Anything else is GENERATED and needs Louis's approval.

## The six pillars

Target mix per month: 20% / 20% / 15% / 20% / 15% / 10%.

### 1. Build reveals (20%)
What we shipped, shown not described. Product clips, device shots, before/after of the
owner's old process. Always names the client (only the three we have permission for) and the
one thing it changed for them.
- Hook formulas: "This is what [client type] in [place] runs on now." · "From spreadsheet to
  this in [n] weeks." · "Three portals. One database. Zero chasing."
- CTA: "More in Work (highlight)" / "Want yours? Free plan in bio."
- Media: Suffolk product clips, site screenshots, hero/capabilities films.

### 2. Client stories — demos (20%)
The had → built → runs beats from `packages/content/src/clientStories.ts`, the stats, the
live demos on `/client-stories`, the NewFuture testimonial. The proof pillar.
- Hook formulas: "Before: [had]. After: [runs]." · "[Stat] — and nobody on staff touched it."
  · "Laura on what it's like working with us (31s)."
- CTA: "Full story at nullshift.co.uk/client-stories" (say it; links don't work in captions).
- Media: `/clients/*-site.png`, client logos, Suffolk clips, Mux testimonial, screen-recorded
  demos.

### 3. Behind the build / studio life (15%)
How the studio works: scoping, deploy days, the stack (Next.js, Supabase, Stripe, Vercel),
the acceptance review, the DPA before go-live, Louis at the desk. Humanises without
shrinking to "one guy". Louis cameos live here.
- Hook formulas: "A build, day 1 to live." · "What a Tuesday looks like at Nullshift." · "We
  run Nullshift on the systems we sell."
- CTA: soft — "Follow for the next build" / "Questions? DM us."
- Media: founder portrait, phone-filmed desk clips, brand-study film, screen-records of our
  own tooling (no client data on screen).

### 4. Plain-English explainers (20%)
Ownership (what "you own it" means in practice), what a booking system actually does, what
the monthly plan covers and why it exists, what "bespoke" means versus a template, what a DPA
is. The posts that get saved and shared.
- Hook formulas: "'You own it' — what that actually means:" · "A booking system is not a
  calendar. Here's what it does at 11pm." · "What £149 a month actually buys."
- CTA: "Save this for when you're comparing quotes." / "Free plan in bio."
- Media: carousels on the billboard background, short screen-records.

### 5. Estimator teasers — `/start` (15%)
The Agent Consultation: answer a few questions, get a tailored plan and a live mockup, free.
Show it working. Also the guided estimator inside it (company size + what you want = build
fee and monthly).
- Hook formulas: "We built a tool that plans your system before you talk to us." · "60
  seconds to a plan for your business — free." · "What would yours cost? Find out without a
  sales call."
- CTA: "Link in bio → nullshift.co.uk/start".
- Media: screen-records of `/start` and the resulting `/plan`.

### 6. Partner programme — agencies (10%)
For growth consultants and marketing / SEO / design agencies with no dev team. Two routes:
referral (10% of the build fee, paid within 14 days of the client's build payment clearing)
and white-label (25% off list, your brand, we run everything). Subject to acceptance review.
- Hook formulas: "Agencies: your clients keep asking for the thing you don't build." · "Sell
  software under your brand. We build and run it." · "Refer a build, earn 10%."
- CTA: "Email louis@nullshift.co.uk or book at nullshift.co.uk/book".
- Media: carousels, Louis cameo, capabilities film.

## Caption structure (every feed, carousel and reel)

```
[Hook — one line, ≤12 words, makes sense without the image]

[Context — 2–3 short lines: who, what, the one number or fact]

[Point — the thing we want remembered: ownership / run by us / speed / plan]

[CTA — one, spoken as a URL or "link in bio"]

.
.
[10–15 hashtags on the last line]
```

- Short lines, blank line between blocks (Instagram collapses after ~125 chars; the hook
  must land before "more").
- First comment: a second CTA or the one fact we couldn't fit — never hashtags (keep them in
  the caption so they count on Reels).
- British spelling, no emojis in the studio voice, numbers as digits, "£" not "GBP".
- Say "the team" / "we". Louis's cameo captions can be first person but signed "— Louis,
  founder".

## Hashtag sets (rotate; never the same set two days running)

**Set A — UK business (feed + carousels)**
`#ukbusiness #smallbusinessuk #ukstartups #bespokesoftware #softwarestudio #webdevelopment #bookingsystem #businessautomation #customsoftware #ukagency #smallbusinessowner #digitaltransformation #britishbusiness #websitedesignuk #businessgrowthuk`

**Set B — International build / tech (reels)**
`#softwaredevelopment #webdesign #uxdesign #productdesign #buildinpublic #techstartup #automation #customsoftwaredevelopment #webapp #appdevelopment #devstudio #supabase #nextjs #stripe #startuplife`

**Set C — Sector + partners (client stories, partner posts)**
`#danceschool #tennisclub #therapypractice #agencylife #marketingagency #whitelabel #agencypartner #growthconsultant #clientportal #onlinebooking #smallbusinesstips #entrepreneuruk #businessowner #founder #studiolife`

Pick 10–15 from one set per post; drop any that don't fit the subject (e.g. `#danceschool`
only on The Dance Exclusive posts).

## Cadence

- **Feed: 4 per week** (2 single-image feed posts + 2 carousels).
- **Reels: 3 per week** (Tue, Thu, Sun).
- **Stories: daily**, 1–3 frames. Minimum: repost the day's post with a link sticker;
  Mon = this week's build, Wed = poll or question box, Fri = link to `/start`.
- Weekly rhythm: Mon feed · Tue reel · Wed carousel · Thu reel · Fri feed · Sat carousel ·
  Sun reel.

## Best times (Europe/London)

Audience is UK-first (prospects, partners) with an international second audience (agencies in
the US/EU/AUS, dev-world followers). Two posting windows:

| Window | Days | Who it hits |
|---|---|---|
| **08:00–08:30** | Mon–Fri | UK owners before the day starts; Europe mid-morning |
| **12:30** | Tue, Thu | UK lunch scroll — good for reels |
| **17:30–18:30** | Mon–Fri | UK commute + US East Coast lunch (12:30–13:30 ET) — best for reels aimed at international |
| **10:00** | Sat | UK weekend browse |
| **19:00** | Sun | UK Sunday-evening planning mode; US afternoon |

Stories: 08:00 (UK morning), 13:00, 20:30. Note BST ends Sunday 25 October 2026 — the
scheduler must use local London time, not a fixed UTC offset. The calendar JSON already
switches from `+01:00` to `+00:00` on that date.

Review after 30 days in Instagram Insights → Audience → Most active times, and shift the
evening slot ±1h to whichever hour shows the larger international bump.

## Measurement (monthly, 10 minutes)

| Metric | Where | 30-day target |
|---|---|---|
| Profile visits | Insights | 400 |
| Link taps (bio) | Insights | 60 |
| `/start` plans with `utm_source=instagram` | admin CRM | 8 |
| Reel average watch time | Insights per reel | > 8s on 15–40s reels |
| Saves on explainer carousels | Insights | 15 per carousel |
| Partner replies mentioning Instagram | outreach inbox | 2 |

Add `?utm_source=instagram&utm_medium=bio` to the bio link and `utm_medium=story` to story
link stickers so the CRM can tell them apart.
