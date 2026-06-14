# Session Handoff — Nullshift homepage 3D graphics + brand guidelines

_Last updated: 2026-06-14. Branch: `scroll-animations`. App root: `nullshift/` (Next.js 16, Turbopack, React 18 StrictMode dev). Deployed on Vercel, aliased to **nullshift.co.uk**._

---

## TL;DR of what this session did

1. Replaced the homepage scroll **video** with two **Three.js graphics** (armillary **Gyroscope** + **Neural Sphere**) that live in **one shared WebGL context** and animate/crossfade on scroll.
2. Layered an **Apple-style immersive scroll** experience over the whole homepage.
3. Made the gyroscope → neural-sphere transition a **sequential blur hand-off** (one blurs fully out before the next blurs in — no overlap).
4. Neural Sphere now **stays visible** at the end (no exit dissolve).
5. **Mobile**: section text sits **above + below** the graphic instead of over it.
6. **Brand guidelines page** (`/brand`) updated with the **real logos** + a new **Signature Graphics** section; colour **swatches made uniform**.
7. Smoothed the **harsh edges** around the homepage graphics into a seamless vignette.

---

## ⚠️ Critical gotchas (read before touching the graphics)

### 1. ONE WebGL context only
This environment (preview browser) effectively allows **one usable WebGL context** — creating a second `WebGLRenderer` silently **evicts/blanks the first** (its canvas renders 0 pixels). That's why both graphics live in a **single** `components/ScrollGraphicScene.tsx` as two `THREE.Group`s that crossfade via **material opacity**, NOT two `<canvas>` elements. Do not add more renderers/canvases to the homepage. (Also recorded in agent memory: `nullshift-webgl-single-context`.)

### 2. Dev preview gets corrupted by HMR — verify via DOM, not screenshots
A huge amount of time was lost to this. In dev:
- HMR + StrictMode accumulate **zombie `requestAnimationFrame` loops** and duplicate component instances that fight over the DOM → symptoms look like "frozen scroll progress" or everything stuck at initial values.
- The **preview screenshot tool returns solid black** for the WebGL + `position:sticky` + `filter:blur` composited section — and late in the session it returned black for *all* pages. **Screenshots are unreliable here.**

**How to verify reliably instead:**
- Hard-reset when things look frozen: `lsof -ti:3000 | xargs kill -9; pkill -f "next dev"; rm -rf .next`, then `preview_start`, then **hard reload** the browser (`window.location.reload()`), and **do not edit files after** (edits re-trigger HMR zombies).
- Read state with `preview_eval` DOM measurement, e.g. progress = `-section.getBoundingClientRect().top / (section.offsetHeight - innerHeight)`.
- The graphic wrapper (`graphicWrapRef`) is the **canvas's grandparent**: `canvas.parentElement.parentElement` (parent is `.relight-shell`). Don't use `querySelector('div[style*="blur"]')` — the page has ~31 blur divs.
- To prove the canvas is actually drawing, the renderer needs `preserveDrawingBuffer: true` (currently OFF) before `drawImage`/`getImageData` will read non-blank pixels.

### 3. Lenis smooth scroll
`components/SmoothScroll.tsx` runs Lenis globally. `window.scrollTo` works but allow **~2–3s to settle** before measuring.

---

## Scroll choreography (homepage graphic section)

Section is `420vh` tall with a `position:sticky` inner; `progress` = 0→1 across it. Logic split across two files:

**`components/ScrollVideoSection.tsx`** (the RAF that owns scroll):
- Computes `progress`, writes it to `progressRef` (the scene reads this each frame).
- Wrapper `materialise` on section enter: `ENTER_END = 0.14` (opacity/scale/blur in). **No exit fade** — the neural sphere stays.
- **Hand-off blur** on the wrapper, peaks at the seam: `HO_START 0.53 · HO_PEAK 0.63 · HO_END 0.73 · HO_MAX 24px` (smoothstep up then down).
- Panel text crossfade via `BREAKS` (desktop slides X; mobile fades the head/body blocks).

**`components/ScrollGraphicScene.tsx`** (the single WebGL scene):
- **Sequential** in-canvas opacity (must stay in sync with the blur window above):
  - `GYRO_OUT_START 0.53 → GYRO_OUT_END 0.63` (gyroscope fades + scales down/out)
  - `NEURAL_IN_START 0.63 → NEURAL_IN_END 0.73` (neural sphere fades + scales up/in)
- Crossfade multiplies each material's **stored base opacity** by the visibility factor (so additive glows / glass alphas are preserved). `gyroGroup` and `neuralWrap` get `.scale.setScalar(0.72 + 0.28*vis)` for depth.
- Scroll-jog rotation on the `master` group; gyroscope ring spins + neural pulse run only while their group is visible.

If you retime the hand-off, change **both** files together.

---

## Key files

| File | What |
|------|------|
| `components/ScrollGraphicScene.tsx` | Single WebGL scene: gyroscope + neural sphere groups, env map, lighting, crossfade, scroll-jog. Ported from the "Glass & Metal Relight" design bundle. |
| `components/ScrollVideoSection.tsx` | Scroll section: progress RAF, wrapper materialise + hand-off blur, desktop panels, mobile above/below layout, progress rail, **seamless radial vignette** (replaced 4 rectangular edge-fades). |
| `components/Reveal.tsx` | Apple-grade reveal (rise + scale + blur-in, easeOutExpo). Used site-wide. |
| `components/ScrollDissolve.tsx` | Hero headline recedes into depth on scroll (framer-motion useScroll). |
| `components/ScrollProgress.tsx` | Spring-smoothed top progress bar. |
| `components/HeroText.tsx` | Hero; headline block wrapped in `ScrollDissolve`. |
| `components/Logo.tsx` | Real logo: `LogoMark` (two staggered pills, left grey / right emerald) + `Logo` lockup. |
| `app/page.tsx` | Homepage: stacked-card depth RAF (`[data-stack-card]`), grain `.noise-layer`, `ScrollProgress`. |
| `app/brand/page.tsx` | Brand guidelines (on-page **and** hidden printable used for PDF export). Updated logos + Signature Graphics + uniform swatches. |
| `app/globals.css` | `.relight-shell` size, `.svs-*` mobile layout, `.noise-layer`, sticky-stack, hero-glow. |
| `lib/tokens.ts` | Design tokens (`T.*`). Emerald primary `#10b981`. |
| `lib/brandPdf.ts` | `COLORS`/`TYPE`/`PRINCIPLES` data + `generateBrandPdf` (html2canvas → jsPDF). |

Removed this session: `components/GyroscopeScene.tsx`, `components/NeuralSphereScene.tsx` (superseded by the unified scene).

---

## This session's later fixes (brand + polish)

- **Swatches uniform**: `Swatch` button was auto-width → boxes 161–319px wide. Added `w-full block` + box `w-full`. Now all 12 identical (~356×93). Logo tiles 315×127, graphic tiles 502×193 — all uniform.
- **Brand logos**: replaced placeholder dot with real `Logo` / `LogoMark` / `AppIcon` (favicon rounded-square). New `// 04 — Signature Graphics` section with static SVG marks for the Gyroscope + Neural Sphere. Mirrored into the printable PDF block. Sections renumbered (Principles → 05, UI System → 06).
- **Harsh lines**: removed the four rectangular `linear-gradient(bg→transparent)` edge-fade divs (banding + corner seams). Replaced with ONE multi-stop **radial vignette**; softened the ambient glow and the shell mask feather (`38% → 100%`). Grain layer dithers residual banding.

---

## ✅ Verified / ❌ not verified

- ✅ `npx tsc --noEmit` passes. ✅ `npm run build` passed earlier this session.
- ✅ Crossfade math, swatch/logo/graphic tile uniformity, logo+graphic SVG presence — all confirmed via DOM measurement.
- ❌ Could **not** screenshot-verify the smoothed gradients / final visuals (screenshot tool returning black). Worth an eyeball on a clean load or after deploy.

---

## 🚩 PENDING — not deployed

Production (**nullshift.co.uk**) is **behind**. The following are on the dev branch only and were **not** deployed:
- Sequential gyro→neural blur hand-off
- Neural sphere "stays visible" change
- Mobile above/below text layout
- Brand guidelines update (logos + signature graphics + uniform swatches)
- Smoothed seamless graphic edges

The last deploy was the **earlier overlapping-crossfade** version. The user was asked whether to deploy and **had not answered** when the session ended.

**To deploy:** `cd nullshift && npm run build` (verify) then `vercel --prod --yes` (project is linked; auto-aliases to nullshift.co.uk). End-of-build log shows `Aliased: https://nullshift.co.uk`.

Working tree has many **uncommitted** changes; nothing has been committed this session (only deploys, which upload the working dir).

---

## Suggested next steps
1. Get a clean visual confirmation of the smoothed graphic edges + sequential hand-off (fresh load; screenshots may need a different tool/real browser).
2. Confirm with the user, then deploy all pending changes.
3. Consider committing the work to `scroll-animations` with a clear message.
