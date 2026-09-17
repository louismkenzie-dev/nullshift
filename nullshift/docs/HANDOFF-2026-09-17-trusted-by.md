# Trusted by logo strip

Added on the homepage immediately after the scroll-film hero, before the Suffolk Tennis introduction. No deployment, data or billing changes.

## Appearance and behavior

- “Trusted by” heading; LTA, The Dance Exclusive, New Future Therapy, School’s Out Activities and WeHost in the requested order.
- Original full-colour marks on the existing Kyma cream background. No fabricated testimonials or additional relationship claims; the client list was supplied by the owner.
- Gentle 42-second seamless CSS translation, with repeated visual copies hidden from assistive technology.
- Visible 44 px pause/resume control; hover pauses the strip on pointer devices. Keyboard operation works.
- IntersectionObserver and document-visibility events pause the animation offscreen/in a hidden tab. No JavaScript animation loop or additional animation dependency.
- Reduced-motion and no-JavaScript visitors get a static wrapping layout showing all five names once; no unusable pause control.
- Server-rendered logo content, lazy images, small client boundary for visibility/pause state, following the Next.js/React performance guidance.

## Remaining asset

WeHost is deliberately a plain text label, not an invented logo or a different company's mark. The exact WeHost website or approved logo is still needed; an optional question was sent during implementation.

## Asset sources

- LTA: unchanged blue SVG from [the LTA website](https://www.lta.org.uk/), specifically https://www.lta.org.uk/17143x/static/images/lta-logo-lta-blue.svg.
- School’s Out Activities: the light-background header mark from [its official website](https://www.schoolsoutactivities.co.uk/), https://www.schoolsoutactivities.co.uk/wp-content/uploads/2019/04/SOA-logo-250.png. The 500 px variant was inspected but has white subtitle lettering unsuitable for the cream band; it is not rendered.
- The Dance Exclusive and NewFuture Therapy: existing approved project files under `public/clients/`, unchanged.

## Changed files

- `apps/web/app/(marketing)/page.tsx`: placement of the new section.
- `apps/web/components/marketing/TrustedBy.tsx`: ordered logo list and accessible content.
- `apps/web/components/marketing/LogoMarquee.tsx`: visibility and pause controls.
- `apps/web/components/marketing/TrustedBy.module.css`: responsive marquee/static layout and on-brand styling.
- `apps/web/public/clients/lta-logo.svg`.
- `apps/web/public/clients/schools-out-activities-logo-light.png`; inspected, unused `schools-out-activities-logo.png` retained.
- This handoff.

## Verification

- 475 existing tests passed; production build including TypeScript and legal guard passed.
- Scoped ESLint and whitespace checks passed.
- Browser checks: desktop 1440 px, mobile 390 px, narrow 320 px, WebKit mobile, reduced motion and no JavaScript.
- Checked image loading, original brand order, no horizontal overflow, equal repeat-group widths, movement, pause/resume via mouse/keyboard, offscreen pause, dynamic reduced-motion changes and static fallback.
- Desktop/mobile/reduced-motion screenshots inspected.
- Evidence in the task workspace: `work/verify-trusted-by.cjs` and `work/trusted-by-checks/`.

Preview: http://127.0.0.1:3112/#trusted-by
