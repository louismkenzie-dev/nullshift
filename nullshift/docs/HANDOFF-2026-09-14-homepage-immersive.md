# Handoff — immersive homepage, and what a local session can add

**Written:** 14 Sep 2026
**Branch:** `claude/direct-debits-portal-handoff-g3bg7p` (preview only — `main` is
deliberately behind, production still shows the old homepage until Louis says merge)
**Preview:** https://nullshift-git-claude-direct-deb-702acd-louis-mckenzies-projects.vercel.app

You are picking this up in a session that has **network access this cloud session did
not**. That is the whole point of the handoff: everything below is blocked by the
sandbox's egress proxy here, and every one of these tasks makes the page materially
better.

---

## 1. What the homepage now is

Rebuilt 13–14 Sep. The old page sold the work in the language of the people who build
it — "agentic AI", "process orchestration", "autonomous agents that decide and act" —
across thirteen sections, without once saying what a customer actually gets. The
audience is non-technical owner-operators: a dance school, a county sports body, a
counselling practice.

The thesis is now **"we build anything your business needs"**, with bookings and
registers demoted to a single worked example that is labelled as an example.

Section order (`apps/web/app/(marketing)/page.tsx`):

| #     | Section                                                    | Component                                                |
| ----- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 01    | Hero — a system drawing itself into existence              | `marketing/immersive/HeroStage.tsx`                      |
| 02    | Scroll-scrubbed assembly — the build happens as you scroll | `marketing/immersive/SystemAssembly.tsx`                 |
| 03    | "One example, end to end" statement                        | inline                                                   |
| 01–05 | Five full-viewport step reveals                            | `marketing/StepReveal.tsx` + `marketing/stepScreens.tsx` |
| 04    | Live systems — the three clients, running                  | `marketing/immersive/LiveSystems.tsx`                    |
| 05    | Before / after                                             | `marketing/BeforeAfter.tsx`                              |
| 06    | What you own                                               | inline                                                   |
| 07    | How it works                                               | inline                                                   |
| 08    | CTA                                                        | `kyma/CTABand`                                           |

### Motion rules — please do not break these

`apps/web/lib/motion.ts` holds the foundations. Three things matter:

1. **Every anime.js timeline runs inside a `createScope` that reverts on unmount.**
   Anime writes inline styles onto real DOM nodes and React knows nothing about them.
   Without the scope, a client-side route change leaves half-finished transforms behind
   and split text stays shattered.

2. **`useAnimeScope` reads `prefers-reduced-motion` synchronously inside the effect**,
   not from React state. This is load-bearing and there is a comment in the file saying
   so. The state version has to start `false` to match the server render, which meant
   the scope _started_, `createDrawable` set the hero paths to a zero-length dash array,
   and the `revert()` a tick later did not restore them — so the hero lattice vanished
   for exactly the visitors who should have got the static version. If you refactor
   this, re-test with `reducedMotion: 'reduce'` in Playwright.

3. **Scroll scrubbing only above 900px** (`HEAVY_MOTION_MIN_WIDTH`). Phones get
   entrances and a static, finished build. A phone should not run five synchronised
   timelines to sell a website.

### Libraries available

- **anime.js 4.5.0** — `animate`, `createTimeline`, `stagger`, `onScroll` (scroll
  scrubbing), `splitText`, `svg.createDrawable` / `createMotionPath` / `morphTo`,
  `createScope`, `utils.*`. **v4 API, not v3** — `anime({ targets })` does not exist.
- **@react-spring/web 10.1.2** — `useSpring`, `useTrail`, `useTransition`, `animated`.
  Used for anything that should feel like it has weight (settling counters, the scan
  confirmation). Springs retarget mid-flight without stuttering; timelines do not.
- Also present: framer-motion, lenis (smooth scroll — it drives native scroll, so
  anime's `ScrollObserver` tracks correctly).

---

## 2. The jobs, in priority order

### JOB 1 — Real product screenshots (highest value by a distance)

**Every visual on the page is currently drawn by me.** They are schematic on purpose and
captioned as illustrations, so nothing is dishonest — but real screens would move this
from "beautifully illustrated" to "that is the actual product".

Capture three desktop screenshots and commit them to
`apps/web/public/clients/`:

```bash
npx playwright screenshot --browser chromium \
  --viewport-size=1440,900 --wait-for-timeout=5000 \
  https://app.thedanceexclusive.co.uk \
  apps/web/public/clients/the-dance-exclusive-site.png

npx playwright screenshot --browser chromium \
  --viewport-size=1440,900 --wait-for-timeout=5000 \
  https://suffolktennis.online \
  apps/web/public/clients/suffolk-tennis-site.png

npx playwright screenshot --browser chromium \
  --viewport-size=1440,900 --wait-for-timeout=5000 \
  https://www.newfuturetherapy.co.uk/ \
  apps/web/public/clients/newfuture-therapy-site.png
```

Notes that will save you time:

- If a page shows a login wall, **use the public marketing page instead** and note in
  the commit which URL you actually used. Do not log in and screenshot real customer
  data — these are live systems with children's records and counselling enquiries in
  them. Nothing behind a login goes on a public marketing site, ever.
- Keep each PNG under ~400 KB. Drop to `--viewport-size=1280,800` if needed.
- Dismiss any cookie banner first, or the screenshot is mostly banner.

Then wire them in. `apps/web/components/marketing/DeviceFrame.tsx` already exists and
takes `{ url, caption, tint, children }` — it renders browser chrome with the address in
the bar, and the whole frame becomes a link when `url` is set. The live URLs and display
URLs are already in `packages/content/src/clientStories.ts` as `liveUrl` / `displayUrl`.

Best placement: inside `LiveSystems.tsx`, either replacing each `Stage` or sitting under
it. Keep the animated stages if you can — the animation is what makes the section feel
alive; the screenshot is what makes it feel real. A device frame holding a real screen,
with the animated stage beside or below it, is stronger than either alone.

### JOB 2 — Short screen recordings

Better than stills, if you have time. Record 6–10 second silent loops of real flows:

- A booking going through on The Dance Exclusive
- A ticket being scanned on Suffolk Tennis (the coach scanner)
- A register being marked

Muted, looping, `playsInline`, no controls. Either commit as small mp4/webm under
`apps/web/public/clients/` or push to Mux — `packages/content/src/clientStories.ts`
already carries a `video.muxPlaybackId` field and Laura's video is there as a worked
example of the pattern. **Same rule as above: no real customer names or children's data
on screen.** Use a demo/sandbox account, or blur.

### JOB 3 — The design references Louis is working from

He has asked for two looks this session and the proxy blocked both, so I have been
working from his written description rather than the sites:

- **https://www.usehalo.com/** — he asked to "copy the animations". I never saw it.
- **ORYZO** (the darkroom-editorial reference) — he pasted a full token spec, which I
  applied as a _system_ in Nullshift's own colours rather than swapping the palette.

If you can reach them: capture the hero and a couple of scroll states of each, commit
them to `docs/references/`, and note in a follow-up what the actual motion is — a
page-load sequence, cursor reactivity, scroll pinning, whatever it turns out to be. That
unblocks a much closer match than I could reach by inference.

### JOB 4 — Real-device performance

I can only test in headless Chromium in a container. Please check on actual hardware:

- **A real phone**, mid-range Android if you have one. The scroll-scrubbed section is
  gated off below 900px, but confirm the entrances are smooth and nothing janks.
- **Safari on macOS and iOS.** Safari is where transform-heavy pages fall over, and
  Louis uses Arc/Safari. The session that preceded this one fixed a bug where the whole
  site hung on his Mac.
- **Lighthouse** on the preview URL. Watch LCP especially — the hero headline is split
  into per-character spans by `splitText`, which is exactly the kind of thing that can
  hurt it.

If something needs to give, the scroll scrubbing in `SystemAssembly` is the most
expensive thing on the page and the easiest to raise the threshold on.

### JOB 5 — Small, known, unfinished

- **`apps/web/components/marketing/SystemWalkthrough.tsx` is dead code.** Nothing has
  imported it since the five-column strip became five full-viewport reveals. I asked
  Louis whether to delete it and did not get an answer. Delete it if he confirms.
- **NewFuture Therapy has no logo asset.** It renders as a text wordmark plus an inline
  leaf SVG. If you can pull a real mark from their repo, it belongs at
  `apps/web/public/clients/newfuture-therapy-logo.png` and then
  `logo: { kind: "image", ... }` in `clientStories.ts`.
- **Dance Exclusive venue count.** Sources disagree (the ops DB says 17 venues, the
  client summary says ~10). The copy says "nine Essex towns", which is verifiable from
  the named list. If you can settle the real number, use it.

---

## 3. Things that are settled — please do not re-litigate

- **The "Official Claude Partner" badge is legitimate.** Nullshift is in the Anthropic
  Partner Network. Louis confirmed this on 14 Sep. It stays.
- **Kyma is the current brand.** The `nullshift-design` skill describes an older "Halo"
  system that Louis has said is legacy and should be removed. Use
  `apps/web/components/kyma/` and the `--k-*` CSS variables in `globals.css`.
- **Pricing is deliberately withheld.** `PRICING_PUBLIC` in
  `packages/content/src/pricing.ts` is `false` while the rates are reworked. Do not
  publish figures, and do not "fix" the pricing page by putting numbers back.
- **`main` is intentionally behind.** The homepage redesign is preview-only until Louis
  approves it. Push to the branch, not to `main`, unless he has said merge.

---

## 4. Verifying before you push

```bash
pnpm typecheck                               # whole monorepo
cd apps/web && pnpm exec vitest run          # 425 tests at time of writing
pnpm --filter @nullshift/web build           # must be clean
```

Then actually look at it. Start the built server and drive it with Playwright — **note
that Lenis hijacks `scrollIntoView`, so scroll with `mouse.wheel` instead**, and kill any
stale `next-server` process first or you will screenshot the previous build (this caught
me twice):

```bash
kill -9 $(ps aux | grep "[n]ext-server" | awk '{print $2}')
pnpm --filter @nullshift/web start
```

Check all three of: 1440px, 390px, and `reducedMotion: 'reduce'`. Assert zero
`pageerror` events and zero horizontal overflow
(`document.documentElement.scrollWidth - clientWidth === 0`).

Use **pnpm**, never npm or yarn — this is a pnpm/turbo workspace and a second lockfile
would give it two dependency trees.
