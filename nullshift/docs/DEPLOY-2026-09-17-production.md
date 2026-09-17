# Production release — 17 September 2026

## Deploy result

- URL: https://nullshift.co.uk
- Immutable deployment: https://nullshift-14sj9ckfq-nullshift.vercel.app
- Target: production
- Status: READY; promoted successfully and `vercel inspect nullshift.co.uk` resolves to the new deployment.
- Deployment ID: `dpl_7BGhSGE6opCdmHJDZqjACzvatRyh`
- Project: `prj_6LbXDCPUzTK8aIc3nSptHnKIxj9Z` / Nullshift Development Ltd.
- Framework: Next.js 16.2.7, Node 24 on Vercel.
- Build/upload duration: approximately two minutes.
- Commit: no single commit represents this release. It is the current local website work based on `97ca671`, with the production-only changes from `284b459` retained.

## Release preservation

Deployment was made from an isolated snapshot at:

`/Users/louismckenzie/Documents/Codex/2026-09-13/referenced-chatgpt-conversation-this-is-an/work/production-release.eLvp3T`

Its `nullshift/` directory contains the checked source. No Git branch was merged, committed or pushed. Before a later Git-triggered production deploy, reconcile this website work with main, otherwise that deploy could replace these changes.

Current production previously used `284b45939abfe2c3d143cfbd19a2cfe980290465`. Its four care-plan preview files were copied into the isolated release from origin/main, preserving the live admin change without altering unrelated work in the user's checkout:

- `apps/web/app/admin/(dashboard)/clients/[id]/care-plan/page.tsx`
- `apps/web/app/admin/(dashboard)/clients/[id]/preview/route.ts`
- `apps/web/lib/previewTarget.ts`
- `apps/web/tests/preview-target.test.ts`

The only source correction during deployment checks was `packages/config/eslint.base.mjs`: scope React rule overrides to Next's supported source files, and allow intentional CommonJS require calls in `.cjs` verification scripts. This fixes the lint runner without changing application behaviour.

The upload excludes environment files, local mockup masters, dependencies and local build caches. No database migrations, client repricing, live billing changes, account creation or test enquiry submissions were performed.

## Checks

- Frozen-lockfile installation in the isolated release passed.
- 531 tests across 44 files passed, including the retained production preview-target tests.
- TypeScript and local production build passed.
- Full ESLint has no errors after the configuration correction; 86 existing advisory warnings remain.
- Vercel production build passed, including TypeScript and legal guard.
- Desktop, 390px and 320px mobile, WebKit and reduced-motion checks passed for navigation, homepage story, layout and enquiry error recovery.
- Trust-strip checks also passed without JavaScript; transparent splat and monochrome assets verified.
- Vault forward/reverse scrub and failed-media fallback checks passed.
- The isolated production server returned 200 for home, book, client stories, portal login, admin login and the transparent splat. The local-only showcase route returned 404.
- The database cross-tenant RLS integration suite was skipped because no database connection string was supplied. Unit tests are not a replacement for that integration suite.

## Live configuration and limitations

Production Supabase and Resend variables are configured. Their server keys are marked **sensitive** and intentionally unavailable to local environment downloads; they were not exposed or replaced. The enquiry notification recipient and sender are configured. No calendar link is configured, so preferred call times remain requests awaiting manual confirmation.

No fake live lead or email was sent. Real end-to-end enquiry delivery and authenticated client actions remain untested against production. The Vercel deployment skill instructed against fetching the deployed URL for verification: production status/domain assignment were checked through the deployment control plane, while actual page/browser checks used the isolated local production build.

## Post-deploy observability

- Error scan: no error logs returned for this deployment in the immediate 10-minute query. This is an early observation, not proof of error-free real traffic.
- External drains: none configured.
- Monitoring: existing Speed Insights integration retained; no new monitor or drain created.

## Rollback point

Previous READY deployment: `dpl_HQpyEmZj3TV3LbapBWL2HVby1HYp`

https://nullshift-1l4g4hhqp-louis-mckenzies-projects.vercel.app

Rollback was not executed. The prior deployment remains available.

Vercel deployment guidance informed the staged production build followed by promotion, configuration checks, rollback preservation and control-plane verification.
