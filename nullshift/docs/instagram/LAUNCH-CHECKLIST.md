# @nullshift.dev — Launch checklist

Two halves: what Louis does once (about 60 minutes, needs the phone and a laptop), then what
the scheduler does every week from CALENDAR-30-DAYS.json. Day 1 of the calendar is
2026-10-13; everything in Part A must be done by 2026-10-12.

## Part A — Louis (one-off, in this order)

### A1. Create the Facebook Page (laptop, ~10 min)
Instagram Business accounts must be linked to a Facebook Page before Meta Business Suite
can schedule posts.
1. facebook.com/pages/create → Page name **Nullshift** → category **Software company** →
   add second category **Web designer** → Create.
2. Bio/About: paste the short About from PROFILE.md. Website `https://nullshift.co.uk`.
   Email `louis@nullshift.co.uk`. Location: United Kingdom only, untick "Show address".
   Hours Mon–Fri 09:00–18:00. Leave phone and price range blank.
3. Profile photo: 1080×1080 export from `apps/web/public/og-image.png` (see PROFILE.md).
   Cover: `apps/web/public/media/brand/nullshift-billboard-2400.webp` → JPG, 1640×856.
4. Action button → "Send email" → louis@nullshift.co.uk.
5. Settings → Messaging → turn on instant reply: "Thanks — the team replies within 24 hours
   on weekdays. Fastest route: nullshift.co.uk/start".
6. Settings → Page access → confirm Louis is the only full-control admin. Add the scheduler
   later as "Content" task access only, not full control.
7. Paste the long About text into "Additional information" (PROFILE.md).

### A2. Switch @nullshift.dev to a Business account (phone, ~5 min)
1. Instagram app → Profile → menu → Settings and privacy → Account type and tools → Switch to
   professional account → **Business** → category **Software company** → show category on
   profile: on.
2. Contact options: email `louis@nullshift.co.uk` on; phone off; address off.
3. When prompted "Connect to Facebook", choose the **Nullshift** Page created in A1. If it
   is skipped, do it now: Settings → Accounts Centre → Accounts → Add accounts → Facebook →
   log in → pick the Nullshift Page.

### A3. Set the profile (phone, ~10 min)
1. Edit profile → Name: `Nullshift · Software Studio`.
2. Bio: Option A from PROFILE.md (131 chars).
3. Links: add `https://nullshift.co.uk/start?utm_source=instagram&utm_medium=bio` titled
   "Get a free plan"; add `https://nullshift.co.uk/book?utm_source=instagram&utm_medium=bio`
   titled "Talk to the team". Put /start first.
4. Profile photo: the same og-image square export.
5. Settings → Sharing to other apps → Facebook: on (so posts cross-post to the Page).

### A4. Confirm the link in Meta Business Suite (laptop, ~5 min)
1. business.facebook.com → Settings → Business assets → Pages → Nullshift → confirm
   Instagram account @nullshift.dev shows as connected.
2. If no Business Portfolio exists yet, create one: "Nullshift Development Ltd", business
   email louis@nullshift.co.uk. Add the Page and the Instagram account to it.
3. Planner → create a test draft (do not publish) to confirm both channels appear.

### A5. Upload Highlights (phone, ~15 min)
1. Make the 5 covers (1080×1920, dark, emerald icon, white mono label) — Work, Clients, How
   it works, Plans, Partners — per PROFILE.md.
2. Post each cover as a story to Close Friends only (so it does not show publicly), then
   Profile → New highlight → select it → name it → set the cover. Delete the story after.
3. Highlights fill in from calendar stories automatically as they are added (the calendar
   says which highlight each story goes to).

### A6. Source media the scheduler cannot make (laptop, ~15 min)
1. Mux → Assets → the NewFuture testimonial (playback id
   `hevvtK01oksR8HWcs5fJAjbICgIoPCHlW3zY89ZywMRA`) → download the MP4 and the captions VTT.
   Send to the scheduler. Message Laura for OK on the cut before day 11.
2. Record the three founder cameos (REELS-SCRIPTS.md 07, 08, 09) in one sitting — 20 minutes
   with the phone on a tripod. Send the raw files to the scheduler.
3. Approve or reject anything the scheduler flags "NEEDS LOUIS APPROVAL (generated media)".
   None of the 30-day calendar requires generated media.

### A7. Tracking (laptop, ~5 min)
1. Confirm the CRM captures `utm_source=instagram` on `/start` and `/book` submissions (lead
   enrichment already stores referrer; check the funnel migration captures UTM).
2. Add a saved view in the admin CRM: leads where source contains "instagram".

Done when: the Page exists and is linked, the account says "Business", the bio has two
links, 5 empty highlights are visible, the scheduler has Business Suite access, the Mux file
and the three cameo recordings are in the shared folder.

## Part B — The scheduler (weekly, from CALENDAR-30-DAYS.json)

### B1. Week-ahead prep (Fridays, ~2 hours)
1. Read the next 7 days of entries (`day` n..n+6). Build every `media_brief` exactly as
   written — exact file paths are under `apps/web/public/`. Never substitute client work
   with stock or generated images.
2. For reels, follow the matching script in REELS-SCRIPTS.md. Use the fictional test
   business for any `/start` recording.
3. Put the caption in verbatim. Hashtags stay on the last line of the caption, not in the
   first comment. Paste `first_comment` as a comment immediately after publishing (Business
   Suite can schedule a first comment on Instagram posts — use it).
4. Schedule each `feed`, `carousel` and `reel` entry at its `scheduled_at` in Meta Business
   Suite → Planner. Times are Europe/London local; the offset in the JSON switches from
   +01:00 to +00:00 on 25 October — check the Planner shows the intended local time.
5. Cross-post feed and carousel entries to the Facebook Page (tick Facebook in the composer).
   Reels: Instagram only, unless Facebook Reels is also wanted.
6. Stories (`kind: "story"`) cannot be scheduled with stickers via Business Suite — prepare
   the frames and post them manually from the phone at the stated time, with the link,
   poll, quiz or question sticker described. Add each to the highlight named in the brief.

### B2. Day-of (10 minutes, morning and evening)
1. Confirm the post went out; add the `first_comment`.
2. Reply to every comment and DM within the day in the studio voice ("we"). Anything that
   smells like a lead → "Easiest next step is nullshift.co.uk/start — or email
   louis@nullshift.co.uk" and forward to Louis.
3. Partner-type enquiries (agencies, consultants) → forward to Louis the same day with the
   handle and message.
4. Story replies to polls/questions: answer the ones worth answering; collect questions for
   the day-18 story.

### B3. Do-not list
- No price other than Core £149 / Pro £249 / Max £399 per month; build fees are "quoted via
  the estimator at /start".
- No "no monthly ransom", no digs at agencies' retainers, no "AI agency".
- No numbers about clients beyond those in the captions (which come from `/client-stories`).
- No screenshots of the admin, CRM or any client's live data. Demos on `/client-stories`
  run on sample data and are fine.
- No posting to `/systems-lab` — it redirects to `/start`.
- Nothing generated by AI goes live without Louis's written OK, and never for client work.

### B4. Monthly review (day 30, 20 minutes)
1. Pull Insights: profile visits, link taps, reach, top 3 posts by saves, top 3 reels by
   average watch time.
2. Pull the CRM: `/start` plans and `/book` enquiries with `utm_source=instagram`.
3. Fill the day-29 story recap from this.
4. Write 5 lines to Louis: what worked, what to drop, the next 30-day calendar proposal
   (same 4 feed + 3 reels pattern), and which highlight needs new content.
5. Re-pin: keep the "We build it" reel and the Plans carousel pinned; replace the Suffolk
   carousel with the newest build reveal.
