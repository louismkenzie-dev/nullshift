# Project enquiry CTA and compact trust strip

## Result

Homepage hero and closing CTA now use **Discuss your project**. The closing section explains the first conversation and keeps one primary action. `/book` collects project details, then optional preferred day/time, then an explicit receipt. No account, password, newsletter enrollment, generated specification or AI call is triggered.

No scheduling URL was supplied. Preferred times are requests in Europe/London, not reservations. A valid optional `NEXT_PUBLIC_CAL_LINK` enables a lazy Cal.com event embed after the enquiry is saved. Cal handles its own booking confirmation; this change does not introduce calendar webhooks or automatically mark CRM calls as booked.

The trust strip is now 145px high in its animated desktop layout (previously approximately 250px). Logos are smaller, monochrome and lighter. The exact supplied `Downloads/images:splat.jpeg` is copied unchanged as the School's Out source, replacing the incorrect wordmark. This JPEG includes a solid background; it is displayed monochromatically as a compact badge. A transparent/vector version would blend better without changing the original artwork.

## Capture and existing records

The server validates and bounds input, limits body size, rejects cross-origin submissions and honeypot fills, and uses the existing durable rate limiter (five attempts/hour per hashed IP and email, fail closed). Lead persistence must succeed before any success response. The public Host header is used for origin comparison because Next can expose an internal hostname in its request URL; a browser test caught this and a regression test covers it.

Data is stored in the existing lead payload under `quiz_answers.projectEnquiry`. Existing plans, funnel answers and status progression use the existing `recordLead` merge policy. No client, subscription or account is created automatically. Pipeline cards and Ops Hub summaries read the new payload alongside legacy data. The existing staff-only conversion action can use the supplied company and project brief.

Emails are transactional only. Provider errors do not discard a successfully saved lead. The receipt page claims an acknowledgement was sent only after provider success. Daily content-based idempotency keys reduce duplicate emails on retries. Client form details remain in memory after an error and are not written to browser storage or URL parameters.

## Configuration / release follow-up

- No database migration is introduced. The existing leads schema, tenant configuration and `rate_limit_hit` RPC must already be installed.
- Normal server Supabase configuration is required for live capture: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus existing lead/tenant settings.
- Transactional delivery requires `RESEND_API_KEY`, a verified `ENQUIRY_FROM_EMAIL` (or `RESEND_FROM_EMAIL`), and `ENQUIRY_NOTIFY_EMAIL` for team notifications. Check real addresses before release; example configuration is not proof of delivery setup.
- `NEXT_PUBLIC_CAL_LINK` is optional and limited to a Cal.com event path or equivalent Cal.com URL. Leave blank to retain manual time confirmation.
- In this local checkout, Supabase is unconfigured. The form explicitly says **Local preview only** and sends no email, saves no record, and books no call. Production cannot use this preview bypass; an unconfigured production endpoint fails visibly.
- Real persistence, email delivery and calendar confirmation have not been exercised against live services. Do an approved staging end-to-end check before release.
- No production deployment, live billing changes or live data writes performed.

## Files changed for this task

- `apps/web/components/marketing/TrustedBy.module.css`: slimmer row, lighter grayscale presentation, splat badge.
- `apps/web/components/marketing/TrustedBy.tsx`: supplied splat and smaller image size hints.
- `apps/web/public/clients/schools-out-splat.jpeg`: unchanged user-supplied source.
- `apps/web/components/marketing/ProjectCta.tsx` and `ProjectCta.module.css`: closing CTA and responsive styling.
- `apps/web/components/Footer.tsx`: uses ProjectCta when homepage CTA is requested.
- `apps/web/components/marketing/immersive/ScrollFilmHero.tsx`: CTA label; existing-client action and story timing preserved.
- `apps/web/app/(marketing)/book/page.tsx`: server-rendered enquiry page/configuration.
- `apps/web/app/(marketing)/book/ProjectEnquiryForm.tsx` and `project.module.css`: accessible step flow, optional scheduling, recovery and receipt states.
- `apps/web/components/IntroSplash.tsx` and `PageTransition.tsx`: no splash or navigation wipe on `/book`; unrelated routes preserved.
- `apps/web/app/api/project-enquiry/route.ts`: validated, rate-limited capture and optional transactional emails.
- `apps/web/lib/projectEnquiry.ts`: validation, configuration allowlist and compatible CRM mapping.
- `apps/web/lib/projectEnquiryEmail.ts`: escaped notification and acknowledgement content.
- `apps/web/app/admin/(dashboard)/pipeline/page.tsx`: new enquiry details and unconfirmed preferences.
- `apps/web/app/admin/(dashboard)/pipeline/actions.ts`: existing staff conversion reads new brief.
- `apps/web/lib/hub/load.ts`: new company/preferred-date summary support.
- `apps/web/tests/project-enquiry.test.ts` and `project-enquiry-route.test.ts`: validation, compatibility, failure and abuse-path coverage.
- This handoff. Other dirty changes belong to earlier work and remain untouched.

## Verification

- 522 unit tests passed across 43 files, including mocked persistence/email failures; no real submissions sent.
- Typecheck, targeted ESLint and production build passed.
- Browser flow checked at desktop 1440px, phone 390px, narrow 320px, WebKit phone and reduced motion: validation, back/edit retention, simulated service error, retry, real local-preview response, no horizontal overflow.
- Trust strip checked on desktop/mobile/WebKit, reduced motion and JavaScript-disabled: correct assets, grayscale, pause/resume, off-screen pause, no overflow.
- Browser screenshots and scripts are in the task workspace `work/project-enquiry-checks`, `work/trusted-by-checks`, `work/verify-project-enquiry.cjs`, and `work/verify-trusted-by.cjs`.

Next.js/React guidance informed server/client boundaries and loading the calendar only after capture. Supabase guidance informed compatible persistence and durable rate limiting. Email best-practice guidance informed transactional-only delivery, escaping and provider-error handling.
