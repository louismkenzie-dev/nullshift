/* ============================================================
   Nullshift — canonical legal identity + authorised sub-processors.

   SINGLE SOURCE OF TRUTH. The /legal pages (Privacy, Cookie, Terms,
   DPA) and every client Data Processing Agreement read from here, so
   filling these in updates everywhere at once.

   ⚠ Supply these before sending a DPA for signature — until then they
   render as amber "to confirm" chips. They are NOT fabricated.
   ============================================================ */

export const LEGAL_ENTITY = {
  name: "Nullshift Development Ltd",
  /** Companies House number. */
  companyNumber: "17284213" as string | null,
  /** Registered office address (single line). */
  registeredOffice: "66 Paul Street, London, England, United Kingdom, EC2A 4NA" as
    | string
    | null,
  /** ICO registration number (data protection register). */
  ico: null as string | null,
  email: "louis@nullshift.co.uk",
  domain: "nullshift.co.uk",
} as const;

/** The authorised sub-processors included in every DPA, in all cases. */
export type SubProcessor = { name: string; service: string; location: string };

export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: "Supabase, Inc.",
    service: "Managed database, authentication, and storage hosting",
    location: "UK / EU region",
  },
  {
    name: "Amazon Web Services (Supabase's infrastructure provider)",
    service: "Underlying cloud infrastructure",
    location: "EU / UK region",
  },
  {
    name: "Stripe Payments UK, Ltd.",
    service: "Payment processing (where applicable)",
    location: "UK / EU / US (under appropriate safeguards)",
  },
  {
    name: "Vercel Inc.",
    service: "Application / front-end hosting",
    location: "EU / US (under appropriate safeguards)",
  },
  {
    name: "Resend (Plus Five Five, Inc.)",
    service: "Transactional email",
    location: "US (under appropriate safeguards)",
  },
];
