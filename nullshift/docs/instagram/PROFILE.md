# @nullshift.dev — Profile setup

Source of truth for the Instagram profile and the linked Facebook Page. Agrees with
`docs/partners/PROGRAMME-BRIEF-2026-10-09.md` (studio-led voice, no "monthly ransom" line,
no retainer attacks, never "AI agency", proof limited to the three client stories).

## Account basics

| Field | Value |
|---|---|
| Handle | `@nullshift.dev` (keep — already exists, matches GitHub/dev-world convention) |
| Account type | Business (switch from Personal/Creator — see LAUNCH-CHECKLIST.md) |
| Name field (searchable, 64 chars max) | `Nullshift · Software Studio` |
| Category | `Software company` |
| Contact buttons | Email `louis@nullshift.co.uk` · no phone · no address (keep "UK" in bio) |
| Link in bio | `https://nullshift.co.uk/start` (primary) — add a second link `https://nullshift.co.uk/book` labelled "Talk to the team" |
| Location shown | United Kingdom (no street address) |

Why `/start` first: it is the free Agent Consultation that drafts a tailored plan and a live
mockup — the strongest zero-commitment next step we have, and every lead lands in the CRM
with enrichment. `/book` is for people who already want a human.

## Bio options (all ≤150 characters — count includes line breaks)

**Option A — plain and complete (recommended)**
```
UK software studio.
Bespoke websites, booking systems & portals — built in weeks, owned by you, run by us.
↓ Get your free plan
```
(131 chars)

**Option B — the hero line**
```
We build it. We run it. We grow it.
Bespoke software for businesses that have outgrown spreadsheets.
Plans from £149/mo ↓
```
(122 chars)

**Option C — partner-aware**
```
Software studio · UK
Bookings, payments, portals & automation — yours to own.
Agencies: partner programme open ↓
```
(118 chars)

Use A at launch. Switch to C for the fortnight the partner-programme posts run (days 13 and 26
in the calendar), then back to A.

## Profile photo

Use **`apps/web/public/og-image.png`** — the two-bar mark on the dark emerald-to-black
gradient. Centre-crop to a 1080×1080 square (the mark sits dead centre at 1200×630, so a
630×630 crop from x=285 keeps it centred). It reads at 110px, works on both the light and
dark Instagram themes, and matches the site's intro splash.

Do not use `apps/web/public/logos/nullshift-mark-dark.png` directly — it is a transparent PNG
intended for dark backgrounds, so Instagram's white circle swallows the dark bar. If you want
a flat version instead of the gradient, place `nullshift-mark-dark.png` on `#0B0F0E` at
1080×1080 with the mark at ~45% height.

Wordmark for story overlays / end cards: `apps/web/public/logos/nullshift-wordmark.svg`
(export to PNG at 2000px wide). Pill lock-ups for watermarks:
`apps/web/public/logos/nullshift-pill-dark.svg` / `nullshift-pill-light.svg`.

## Highlights (5)

Covers: 1080×1920, dark `#0B0F0E` background, single emerald (`#10B981`) line-icon, label
in the mono caption font in white. Make them in one Figma/Canva file so they match.

| # | Highlight name | Cover icon | What goes in it |
|---|---|---|---|
| 1 | **Work** | two bars (the mark) | Build reveals and product clips: Suffolk Tennis parent hub / reports / ledger clips, The Dance Exclusive site, NewFuture Therapy site. Add every new build reveal here first. |
| 2 | **Clients** | speech mark | The three client stories as story cards (had → built → runs), the NewFuture testimonial clip, the stats cards (139 active parents · 1,340 sessions · 9 weeks brief → production). |
| 3 | **How it works** | numbered list | Screen-records of `/start` (free plan + mockup), `/client-stories` live demos, `/pricing`. The 2–4 week build timeline. "What you own" card. |
| 4 | **Plans** | pound sign | Core £149 / Pro £249 / Max £399 explainer cards, what the monthly covers vs what is quoted, cancel-any-month and keep-the-system card. |
| 5 | **Partners** | handshake | The two ways to work with us (referral 10% of build fee / white-label 25% off list), who it suits, how to get in touch (louis@nullshift.co.uk, `/book`). |

Optional 6th once there is footage: **Studio** — behind-the-build, Louis cameos, desk,
deploy days.

## Pinned-post trio (top of grid, left to right)

1. **Reel — "We build it. We run it. We grow it."** (calendar day 2). Logo opener into the
   hero film. The brand in 20 seconds.
2. **Carousel — Suffolk Tennis client story** (calendar day 3). The best visual proof we own:
   five product screenshots and the 1,340-sessions / 9-venues stats.
3. **Carousel — Core / Pro / Max explained** (calendar day 10). Removes the "how much is it"
   friction before anyone DMs.

Re-pin every ~6 weeks: swap slot 2 for the newest build reveal, keep slots 1 and 3.

## Facebook Page (required to link the Business account)

| Field | Value |
|---|---|
| Page name | `Nullshift` |
| Category | `Software company` (add second category `Web designer`) |
| Username | `@nullshiftdev` (if free; otherwise `@nullshift.dev`) |
| Website | `https://nullshift.co.uk` |
| Email | `louis@nullshift.co.uk` |
| Phone | leave blank |
| Location | United Kingdom (country only — do not add a street address; untick "show address") |
| Hours | "Always open" is wrong for a studio — set Mon–Fri 09:00–18:00 |
| Price range | leave blank |
| Profile photo | same square export of `apps/web/public/og-image.png` |
| Cover photo | `apps/web/public/media/brand/nullshift-billboard-2400.webp` converted to JPG, 1640×856 safe area |
| Action button | "Send email" → louis@nullshift.co.uk (or "Learn more" → `/start`) |

**About (short, 255 chars):**
```
Nullshift is a UK software studio. We design and build bespoke websites, booking systems, client portals, CRMs and automation — live in weeks, owned outright by you, and run by us on a monthly plan from £149.
```

**About (long / "Additional information"):**
```
Nullshift Development Ltd is a UK software studio building bespoke business systems: websites, booking and payments, client and parent portals, staff apps, CRMs, dashboards and automation.

Every build is designed around how your business actually works, and you own it outright — the code, the data and every account are in your name. Once it is live, our Managed Platform plans (Core, Pro and Max, from £149 a month) cover hosting, monitoring, maintenance and support, so you use the system and we keep it running.

Recent work includes a multi-venue booking and registers system for The Dance Exclusive (Essex), a county player pathway with parent hub, coach app and QR ticketing for Suffolk Tennis LTA, and a premium practice site with an AI companion for NewFuture Therapy (Wakefield).

Start with a free plan at nullshift.co.uk/start, or talk to the team at nullshift.co.uk/book.

Agencies and consultants: we run a referral and white-label partner programme. Email louis@nullshift.co.uk.
```

Page settings worth doing on day one: turn on Messenger with an instant reply ("Thanks — the
team replies within 24 hours on weekdays. Fastest route: nullshift.co.uk/start"), add
Instagram under Linked accounts, and set the Page as the owner of the Instagram account in
Meta Business Suite so the scheduler can post to both.

## Voice reminders for anyone touching the profile

- "We", "the team", "the studio". Louis appears as founder, never as "I run this alone".
- Ownership is a positive: "yours — code, data, accounts". Never frame the monthly plan as
  something to escape; it is the thing that keeps the system running.
- Numbers only from `/client-stories`. No "we saved X £", no client counts, no revenue.
- Call it a software studio. Not an AI agency, not an automation agency.
