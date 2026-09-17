# Homepage close: features → demo CTA → footer

- Removed all old homepage content below PlatformFeatures: example intro, DemoReel, five StepReveal panels, LiveSystems, before/after, ownership, process and previous CTA. Their reusable components and standalone pages remain available.
- Homepage ends with the existing footer plus a homepage-only cream CTA: “See what’s possible. For your business.” Primary action: “Book a demo” → `/book`.
- The homepage footer hides its competing “Get my free plan” action. Other pages keep the existing footer behaviour.
- Nav and footer “What we build” links now target `/#platform-features` instead of the removed `#capabilities` section.
- Preserved every section above and including the features grid, plus footer legal, cookie settings and login links.

Changed code: `apps/web/app/(marketing)/page.tsx`, `apps/web/components/Footer.tsx`, `apps/web/components/Nav.tsx`.

Recovery snapshot of the complete pre-edit homepage: task workspace `work/home-before-footer-2026-09-16.tsx`. No reusable component or media files deleted.

Verification: 460 tests passed. Focused ESLint completed with zero errors and three pre-existing Nav effect warnings (unchanged hook code). Production build, TypeScript and legal guard passed. Chromium at 1440, 390 and 320px: exactly one footer after features, five feature cards preserved, old sections absent, no horizontal overflow, CTA navigates to /book without submitting a booking, and other pages retain the standard footer.

Next.js/React guidance kept the CTA server-rendered using the existing Kyma components; browser guidance informed responsive and link checks.

Local preview only. No deployment, booking submission, live billing or database changes.
