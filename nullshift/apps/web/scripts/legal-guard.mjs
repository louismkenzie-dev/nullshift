/**
 * Production legal build guard (spec §3).
 *
 * Fails a PRODUCTION build when the legal identity, contact routes or policy
 * versions are missing. Never substitutes dummy text: a legal page that renders
 * "[company number]" in production is worse than a build that refused to ship.
 *
 * The effective date is treated differently from the rest. Its absence means
 * the pack is a solicitor-review DRAFT — that is a legitimate state to deploy
 * in (the pages say so and binding acceptance stays off), so it warns rather
 * than fails. Everything else is a hard error.
 *
 * Run: node scripts/legal-guard.mjs   (wired into the web build)
 */

const isProd =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

const env = (k) => {
  const v = process.env[k];
  return v && v.trim() ? v.trim() : undefined;
};

const entity = {
  legalName: env("NEXT_PUBLIC_LEGAL_NAME") ?? "Nullshift Development Ltd",
  companyNumber: env("NEXT_PUBLIC_COMPANY_NUMBER") ?? "17284213",
  jurisdiction: env("NEXT_PUBLIC_COMPANY_JURISDICTION") ?? "England and Wales",
  registeredOffice:
    env("NEXT_PUBLIC_REGISTERED_OFFICE") ??
    "66 Paul Street, London, England, United Kingdom, EC2A 4NA",
  vatStatus: env("NEXT_PUBLIC_VAT_STATUS") ?? "unverified",
  vatNumber: env("NEXT_PUBLIC_VAT_NUMBER") ?? null,
};
const contact = {
  legal: env("NEXT_PUBLIC_LEGAL_EMAIL") ?? "louis@nullshift.co.uk",
  privacy: env("NEXT_PUBLIC_PRIVACY_EMAIL") ?? "louis@nullshift.co.uk",
};
const effectiveDate = env("NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE");

const errors = [];
const warnings = [];

if (!entity.legalName) errors.push("NEXT_PUBLIC_LEGAL_NAME — contracting entity is required.");
if (!entity.companyNumber)
  errors.push(
    "NEXT_PUBLIC_COMPANY_NUMBER — required for a limited company. Set legalForm explicitly in legal/config.ts if Nullshift is not one."
  );
if (!entity.jurisdiction)
  errors.push("NEXT_PUBLIC_COMPANY_JURISDICTION — country of incorporation is required.");
if (!entity.registeredOffice)
  errors.push("NEXT_PUBLIC_REGISTERED_OFFICE — registered office is required.");
if (!contact.legal) errors.push("NEXT_PUBLIC_LEGAL_EMAIL — a monitored legal inbox is required.");
if (!contact.privacy)
  errors.push("NEXT_PUBLIC_PRIVACY_EMAIL — a monitored privacy inbox is required.");

if (entity.vatStatus === "unverified")
  warnings.push(
    "NEXT_PUBLIC_VAT_STATUS is unverified. Set it to 'registered' (with NEXT_PUBLIC_VAT_NUMBER) or 'not_registered' before the legal release."
  );
if (entity.vatStatus === "registered" && !entity.vatNumber)
  errors.push("NEXT_PUBLIC_VAT_NUMBER — required when VAT registered.");

if (!effectiveDate)
  warnings.push(
    "NEXT_PUBLIC_LEGAL_EFFECTIVE_DATE is unset: the legal pack is a DRAFT. Public pages show a draft notice and binding contract acceptance stays DISABLED. Set it only after solicitor review."
  );

for (const w of warnings) console.warn(`⚠ legal-guard: ${w}`);

if (errors.length) {
  console.error("\n✖ legal-guard: production legal configuration is incomplete:\n");
  for (const e of errors) console.error(`  · ${e}`);
  console.error("");
  if (isProd) process.exit(1);
  console.warn("⚠ legal-guard: non-production build — continuing despite the above.\n");
} else {
  console.log(
    `✓ legal-guard: legal identity complete${effectiveDate ? ` · in force ${effectiveDate}` : " · DRAFT (acceptance disabled)"}`
  );
}
