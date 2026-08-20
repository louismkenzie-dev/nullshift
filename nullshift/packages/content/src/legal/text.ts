import { legalConfig } from "./config";

/**
 * Public legal text — Website Terms, Privacy Notice, Cookie Policy.
 *
 * Structured rather than free-form HTML so that: clause numbering is preserved
 * exactly as drafted; one renderer styles every policy identically; and the
 * canonical source can be hashed for the version registry (spec §4, §22).
 *
 * Identity, contact and dates interpolate from legalConfig — never hard-coded,
 * so a change to the registered office cannot leave a stale copy behind.
 *
 * DO NOT rewrite clause wording for brevity. Short summaries belong beside the
 * controlling text, not instead of it (§22).
 */

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "note"; text: string };

export type LegalSection = { n: string; heading: string; blocks: LegalBlock[] };

export type LegalDoc = {
  slug: string;
  title: string;
  /** One line, plain English — displayed above the controlling text. */
  summary: string;
  sections: LegalSection[];
};

const E = legalConfig.entity;
const C = legalConfig.contact;
const R = legalConfig.routes;

const identity = `${E.legalName}, trading as ${E.tradingName}, company number ${
  E.companyNumber ?? "[company number]"
}, whose registered office is ${E.registeredOffice ?? "[registered office]"}`;

/* ══════════════════ WEBSITE TERMS OF USE ══════════════════ */

export const WEBSITE_TERMS: LegalDoc = {
  slug: "website-terms",
  title: "Website Terms of Use",
  summary:
    "The rules for using this website and any public demo. They do not govern paid services — your Order Form and the Master Services Agreement do that.",
  sections: [
    {
      n: "1",
      heading: "About these terms",
      blocks: [
        {
          kind: "p",
          text: `These terms govern use of ${E.tradingName}'s public website and public demos. They do not replace a signed Client Services Agreement. If you buy services from ${E.tradingName}, the applicable Order Form, Master Services Agreement and Schedules govern those services.`,
        },
      ],
    },
    {
      n: "2",
      heading: "Business information and enquiries",
      blocks: [
        {
          kind: "p",
          text: `Public descriptions, portfolio items, case studies, indicative timelines and “from” prices are general information only. A binding scope, price or delivery commitment exists only when ${E.tradingName} accepts an Order Form or other written contract.`,
        },
      ],
    },
    {
      n: "3",
      heading: "Website availability",
      blocks: [
        {
          kind: "p",
          text: `${E.tradingName} may change, suspend or withdraw public website content without notice. We do not promise that the public website will always be available or error-free.`,
        },
      ],
    },
    {
      n: "4",
      heading: "Intellectual property",
      blocks: [
        {
          kind: "p",
          text: `Unless stated otherwise, ${E.tradingName} or its licensors own the intellectual-property rights in this website, its branding, design, code, text and original media. You may view and use the website for legitimate business-enquiry purposes but may not copy, scrape, republish, reverse engineer or commercially exploit protected material except as permitted by law or written permission.`,
        },
        {
          kind: "p",
          text: "Client logos, trade marks and project materials remain the property of their respective owners and are displayed for portfolio/reference purposes where authorised.",
        },
      ],
    },
    {
      n: "5",
      heading: "Acceptable use",
      blocks: [
        {
          kind: "p",
          text: "You must not use the website to introduce malicious code, interfere with security, scrape at a rate that materially harms the service, attempt unauthorised access, submit unlawful content, impersonate another person or use forms/demos for spam or abuse.",
        },
      ],
    },
    {
      n: "6",
      heading: "AI demonstrations",
      blocks: [
        {
          kind: "p",
          text: "Any public AI demonstration is experimental and may produce inaccurate or inappropriate content. Do not submit confidential, sensitive, special-category, payment-card or secret credential information into a public demo. A demo is not legal, financial, medical or other professional advice.",
        },
        {
          kind: "p",
          text: "Where you interact directly with an AI assistant, the interface should clearly identify that it is AI.",
        },
      ],
    },
    {
      n: "7",
      heading: "External links and services",
      blocks: [
        {
          kind: "p",
          text: `Links to third-party websites or services are provided for convenience. ${E.tradingName} does not control and does not endorse every third-party page linked from the website.`,
        },
      ],
    },
    {
      n: "8",
      heading: "Liability",
      blocks: [
        {
          kind: "p",
          text: `Nothing in these terms excludes liability that cannot lawfully be excluded. Subject to that, to the maximum extent permitted by law, ${E.tradingName} is not responsible for business decisions made solely in reliance on general public-site content, for third-party websites, or for indirect/consequential losses arising from ordinary use of the public website.`,
        },
      ],
    },
    {
      n: "9",
      heading: "Governing law",
      blocks: [
        {
          kind: "p",
          text: `These Website Terms are governed by the law of ${legalConfig.legal.governingLaw} and the courts of ${legalConfig.legal.governingLaw} have jurisdiction, subject to any mandatory rights that cannot lawfully be excluded.`,
        },
      ],
    },
    {
      n: "10",
      heading: "Contact",
      blocks: [{ kind: "p", text: `Questions about these terms: ${C.legal}.` }],
    },
  ],
};

/* ══════════════════ PRIVACY NOTICE ══════════════════ */

export const PRIVACY_NOTICE: LegalDoc = {
  slug: "privacy",
  title: "Privacy Notice",
  summary:
    "What personal information we handle as a business, why, and the rights you have. Data inside a client's own system is governed by that client's notice and our DPA with them.",
  sections: [
    {
      n: "1",
      heading: "Who we are",
      blocks: [
        {
          kind: "p",
          text: `The controller for the personal information described in this notice is ${identity}. Privacy contact: ${C.privacy}.${
            E.icoRegistration
              ? ` ICO registration currently published by ${E.tradingName}: ${E.icoRegistration}.`
              : ""
          }`,
        },
      ],
    },
    {
      n: "2",
      heading: "Information we collect",
      blocks: [
        {
          kind: "p",
          text: `Depending on how you interact with ${E.tradingName}, we may process:`,
        },
        {
          kind: "bullets",
          items: [
            "identity and business-contact information such as name, job title, company, email and telephone number;",
            "enquiry, proposal, project and contract communications;",
            "account/client-portal information and authentication records;",
            "billing, transaction and invoice information (but not full payment-card details where payment is handled by a payment processor);",
            "support tickets, meeting notes and technical communications;",
            "website/device information such as IP address, browser/device details, security logs and consent preferences;",
            "marketing preferences and records of communications;",
            "information you provide when exercising data rights or making a complaint; and",
            "limited information from public business sources or referrals where relevant to a legitimate business relationship.",
          ],
        },
        {
          kind: "p",
          text: `Client end-user data processed inside a Client System is normally processed by ${E.tradingName} as a processor for that Client and is governed by the Client's privacy notice and ${E.tradingName}'s Data Processing Agreement with that Client.`,
        },
      ],
    },
    {
      n: "3",
      heading: "Why we use information and lawful bases",
      blocks: [
        {
          kind: "table",
          head: ["Purpose", "Typical lawful basis"],
          rows: [
            [
              "Respond to enquiries and take pre-contract steps",
              "Legitimate interests and/or steps requested before contract",
            ],
            [
              "Deliver and administer client services",
              "Contract; legitimate interests for business-contact data",
            ],
            ["Billing, accounting and tax records", "Contract and legal obligation"],
            [
              "Protect systems, prevent abuse and investigate security events",
              "Legitimate interests; legal obligation where applicable",
            ],
            [
              "Manage suppliers and professional advisers",
              "Legitimate interests / contract",
            ],
            [
              "Improve services and business operations",
              "Legitimate interests, subject to privacy impact",
            ],
            [
              "Send B2B service/relationship communications",
              "Legitimate interests where permitted",
            ],
            [
              "Send marketing requiring consent",
              "Consent or another lawful basis only where the electronic-marketing rules permit it",
            ],
            [
              "Establish, exercise or defend legal claims",
              "Legitimate interests / legal obligation",
            ],
            [
              "Handle data-protection complaints and rights requests",
              "Legal obligation and legitimate interests",
            ],
          ],
        },
        {
          kind: "p",
          text: "Where we rely on legitimate interests, our interests are generally running and securing a technology-services business, responding to business enquiries, managing client relationships and improving our services. We consider the impact on individuals and do not use legitimate interests where those interests are overridden by rights and freedoms.",
        },
      ],
    },
    {
      n: "4",
      heading: "Marketing",
      blocks: [
        {
          kind: "p",
          text: "We do not treat a transactional/service email as permission for unrelated marketing. Where the law requires consent for electronic marketing, we will request it separately or rely only on a valid applicable exception. Marketing messages must contain an easy unsubscribe/opt-out mechanism.",
        },
      ],
    },
    {
      n: "5",
      heading: "Cookies and similar technologies",
      blocks: [
        {
          kind: "p",
          text: `Our use of cookies and similar technologies is described in the Cookie Policy. Non-essential storage/access technologies must not be activated before the required consent unless ${E.tradingName} has deliberately configured that technology to meet a current statutory exception.`,
        },
      ],
    },
    {
      n: "6",
      heading: "Sharing information",
      blocks: [
        { kind: "p", text: "We may share personal information with:" },
        {
          kind: "bullets",
          items: [
            "hosting, infrastructure, database, communications, support and security providers;",
            "payment processors for billing;",
            "professional advisers such as accountants, lawyers and insurers;",
            "authorities where disclosure is legally required;",
            "a purchaser/investor in connection with a genuine corporate transaction, subject to appropriate confidentiality; and",
            `other suppliers necessary to operate ${E.tradingName}.`,
          ],
        },
        {
          kind: "p",
          text: `The current material subprocessor and supplier list is maintained at ${R.subprocessors}.`,
        },
      ],
    },
    {
      n: "7",
      heading: "International transfers",
      blocks: [
        {
          kind: "p",
          text: "Some suppliers may process information outside the UK. Where the UK international-transfer rules require safeguards, we use a recognised mechanism such as adequacy regulations, the UK International Data Transfer Agreement, the UK Addendum to EU Standard Contractual Clauses or another lawful safeguard, and conduct transfer-risk assessment where required.",
        },
      ],
    },
    {
      n: "8",
      heading: "Retention",
      blocks: [
        { kind: "p", text: "Our baseline retention schedule is:" },
        {
          kind: "table",
          head: ["Record", "Retention"],
          rows: [
            [
              "Unsuccessful ordinary sales enquiries",
              "24 months after last meaningful contact",
            ],
            [
              "Client contracts, SOWs, Change Orders and material project records",
              "7 years after the relationship/project ends, unless longer is reasonably needed for a dispute",
            ],
            [
              "Accounting/tax records",
              "At least the statutory period applicable to the record",
            ],
            [
              "Support/security logs",
              "Risk-based period, commonly 6–24 months depending on system and purpose",
            ],
            [
              "Marketing suppression record",
              "As long as reasonably necessary to honour the opt-out",
            ],
            [
              "Data-rights/complaint file",
              "Normally 3 years after closure, longer if a dispute/regulatory matter continues",
            ],
          ],
        },
        {
          kind: "note",
          text: "Exact periods are confirmed with our accountant and against our actual systems before publication.",
        },
      ],
    },
    {
      n: "9",
      heading: "Automated processing and internal pricing",
      blocks: [
        {
          kind: "p",
          text: `${E.tradingName} may use internal software to calculate or recommend business-service pricing using factors such as platform usage, technical load, organisation reach and service complexity. The pricing model is intended to price a business service, not evaluate an individual's personal characteristics. Where information relating to a sole trader or individual business contact is used, the final quote can be manually reviewed. ${E.tradingName} does not use this pricing tool to make solely automated decisions producing legal or similarly significant effects about individuals.`,
        },
      ],
    },
    {
      n: "10",
      heading: "Your rights",
      blocks: [
        {
          kind: "p",
          text: "Subject to legal conditions and exemptions, individuals may have rights to access, correct, erase or restrict personal information, object to processing, receive portable information in some circumstances, withdraw consent, and obtain safeguards concerning qualifying automated decision-making.",
        },
        {
          kind: "p",
          text: `Requests should be sent to ${C.privacy}. We may need proportionate information to verify identity/authority.`,
        },
      ],
    },
    {
      n: "11",
      heading: "Data-protection complaints",
      blocks: [
        {
          kind: "p",
          text: `You can make a data-protection complaint to ${C.privacy} or through ${R.dataComplaint}.`,
        },
        { kind: "p", text: `${E.tradingName} will:` },
        {
          kind: "bullets",
          items: [
            "provide a clear electronic route for complaints;",
            "acknowledge a data-protection complaint within 30 days of receipt;",
            "take appropriate steps to investigate and respond without undue delay; and",
            "tell the complainant the outcome.",
          ],
        },
        {
          kind: "p",
          text: "You also have the right to complain to the UK Information Commissioner's Office, whose current contact details are published at ico.org.uk.",
        },
      ],
    },
    {
      n: "12",
      heading: "Security",
      blocks: [
        {
          kind: "p",
          text: "We use proportionate technical and organisational measures designed to protect personal information. No internet service can be guaranteed completely secure.",
        },
      ],
    },
    {
      n: "13",
      heading: "Changes",
      blocks: [
        {
          kind: "p",
          text: "We may update this notice to reflect changes in law, suppliers or business practices. This page shows the current effective date, and prior versions are retained internally where material.",
        },
      ],
    },
  ],
};

/* ══════════════════ COOKIE POLICY ══════════════════ */

export const COOKIE_POLICY: LegalDoc = {
  slug: "cookies",
  title: "Cookie and Storage Technologies Policy",
  summary:
    "What we store on your device and when. Everything optional is off until you say otherwise, and you can change your mind from any page.",
  sections: [
    {
      n: "1",
      heading: "What this policy covers",
      blocks: [
        {
          kind: "p",
          text: "This policy covers cookies, local storage, SDK/device identifiers, pixels and similar technologies that store information on, or access information from, a user's device.",
        },
      ],
    },
    {
      n: "2",
      heading: "Consent model",
      blocks: [
        { kind: "p", text: `${E.tradingName}'s implementation is privacy-first:` },
        {
          kind: "bullets",
          items: [
            "strictly necessary technologies may operate without consent where legally permitted;",
            `all other categories are disabled by default until valid consent, unless ${E.tradingName} has specifically documented that the technology satisfies a current statutory exception;`,
            "Reject All is as easy to access as Accept All at the first layer where consent is required;",
            "optional categories are off by default;",
            "withdrawal or change of preference is available from every page through “Cookie Settings”; and",
            "consent records store the policy version, categories selected and timestamp, without storing unnecessary personal data.",
          ],
        },
      ],
    },
    {
      n: "3",
      heading: "Categories",
      blocks: [
        {
          kind: "p",
          text: "Strictly necessary — needed for security, authentication, load balancing, fraud prevention, user-requested session functionality, consent memory or other functionality genuinely necessary to provide a requested service.",
        },
        {
          kind: "p",
          text: "Functional — optional preferences or functionality not strictly necessary. Used without consent only where the implementation has been reviewed against a current legal exception; otherwise consent is required.",
        },
        {
          kind: "p",
          text: "Analytics — measurement and service-improvement technologies. We do not assume a third-party analytics suite automatically qualifies for a consent exception; the actual configuration, purpose and data sharing are assessed, and we default to consent where uncertain.",
        },
        {
          kind: "p",
          text: "Marketing — advertising, retargeting, cross-site tracking or marketing attribution technologies. These require consent before activation.",
        },
      ],
    },
    {
      n: "4",
      heading: "Live cookie inventory",
      blocks: [
        {
          kind: "note",
          text: "The table on this page is generated from our maintained inventory, not written by hand.",
        },
      ],
    },
    {
      n: "5",
      heading: "Changes",
      blocks: [
        {
          kind: "p",
          text: "Where a newly deployed tool adds a non-essential storage or access technology, our release checks fail until the cookie inventory and consent categorisation have been updated.",
        },
      ],
    },
  ],
};

/** Canonical text of a document, for hashing (spec §4). */
export function canonicalText(doc: LegalDoc): string {
  const parts: string[] = [doc.title];
  for (const s of doc.sections) {
    parts.push(`${s.n}. ${s.heading}`);
    for (const b of s.blocks) {
      if (b.kind === "p" || b.kind === "note") parts.push(b.text);
      else if (b.kind === "bullets") parts.push(...b.items);
      else if (b.kind === "table")
        parts.push(b.head.join(" | "), ...b.rows.map((r) => r.join(" | ")));
    }
  }
  return parts.join("\n");
}

export const PUBLIC_DOCS = [WEBSITE_TERMS, PRIVACY_NOTICE, COOKIE_POLICY];

/* ══════════════════ AI disclosure copy (spec §13) ══════════════════ */

export const AI_DISCLOSURE = {
  shortLabel: "AI assistant",
  firstInteraction:
    "You're interacting with an AI assistant. It can make mistakes. Don't submit passwords, full payment-card details or highly sensitive information. Important decisions should be checked by a person.",
  actionCapable:
    "This AI assistant can perform the actions shown in this interface. You'll be asked to confirm high-impact actions unless the workflow has been specifically configured otherwise.",
};

/* ══════════════════ Public pricing legal copy (spec §16) ══════════════════ */

export const PRICING_LEGAL_COPY = {
  main: "Prices shown are from rates for Standard-scale clients and exclude VAT where applicable. Your final recurring price depends on the service plan, platform usage, technical load, organisation reach, commercial criticality and complexity/risk. New features and material changes are quoted separately. Core/Pro/Max are monthly services unless your Order Form states otherwise.",
  max: "Max includes proactive technical partnership, platform reviews, feature discovery/scoping and priority access. It does not include unlimited development or free feature entitlements.",
};

/**
 * Phrases that must never appear in product or marketing copy (spec §16).
 * Enforced by a test so a future copy edit cannot quietly reintroduce them.
 */
export const PROHIBITED_CLAIMS = [
  "unlimited development",
  "unlimited changes",
  "unlimited revisions",
  "developer on demand",
  "100% secure",
  "guaranteed uptime",
];

/* ══════════════════ ACCEPTABLE USE POLICY (Schedule 7) ══════════════════ */

export const ACCEPTABLE_USE: LegalDoc = {
  slug: "acceptable-use",
  title: "Acceptable Use Policy",
  summary:
    "What a client system may not be used for. It binds clients under the Master Services Agreement, and lets us act quickly when a system is being misused.",
  sections: [
    {
      n: "1",
      heading: "Prohibited uses",
      blocks: [
        {
          kind: "p",
          text: "The Client must not use the Services or Client System to:",
        },
        {
          kind: "bullets",
          items: [
            "commit, facilitate or promote unlawful activity;",
            "infringe intellectual property, privacy or confidentiality rights;",
            "distribute malware, ransomware, phishing or credential-harvesting material;",
            "attempt unauthorised access, vulnerability exploitation or denial-of-service attacks;",
            "send spam or unlawful direct marketing;",
            "host content that the Client knows is unlawful and refuses to remove after proper notice;",
            "circumvent usage limits, security controls or supplier restrictions;",
            "process unlawful or unlawfully obtained personal data;",
            "use AI in the prohibited or restricted manner described in the AI Schedule;",
            "use payment functionality for prohibited, unlicensed or unlawful goods or services; or",
            "materially interfere with shared infrastructure or other customers.",
          ],
        },
      ],
    },
    {
      n: "2",
      heading: "Enforcement",
      blocks: [
        {
          kind: "p",
          text: `${E.tradingName} may investigate credible abuse reports and may suspend affected functionality where reasonably necessary to protect users, infrastructure, legal compliance or third-party relationships.`,
        },
      ],
    },
  ],
};

/* ══════════════════ AI SERVICES SCHEDULE (Schedule 5) ══════════════════ */

export const AI_SCHEDULE: LegalDoc = {
  slug: "ai",
  title: "AI Services Schedule",
  summary:
    "How AI features are supplied, what they can and cannot be relied on for, what must never be fed into them, and where a human has to stay in the loop.",
  sections: [
    {
      n: "1",
      heading: "Definitions",
      blocks: [
        {
          kind: "bullets",
          items: [
            "AI Feature means any feature using machine learning, a large language model, generative AI, classification model, automated agent or similar system.",
            "AI Input means prompts, instructions, content, Client Data or other information supplied to an AI Feature.",
            "AI Output means text, images, recommendations, classifications, actions or other material produced by an AI Feature.",
            "Model Provider means the third-party provider of the underlying model or AI API.",
          ],
        },
      ],
    },
    {
      n: "2",
      heading: "Scope",
      blocks: [
        {
          kind: "p",
          text: "2.1 Only AI Features described in the Order Form or SOW are supported. The Client may not repurpose an AI Feature for a materially different high-risk use without written review.",
        },
        {
          kind: "p",
          text: "2.2 Model Providers are Third-Party Services. Their terms, model behaviour, rate limits, pricing and availability may change.",
        },
      ],
    },
    {
      n: "3",
      heading: "Accuracy and human oversight",
      blocks: [
        {
          kind: "p",
          text: "3.1 AI Outputs are probabilistic. They may contain factual errors, fabricated content, bias, unsafe suggestions or inappropriate responses.",
        },
        {
          kind: "p",
          text: "3.2 The Client shall implement human review appropriate to the consequence of the use case. AI Output must not be treated as guaranteed professional advice.",
        },
        {
          kind: "p",
          text: "3.3 Unless a specifically reviewed Enterprise SOW states otherwise, an AI Feature must not be the sole decision-maker for employment, credit, insurance, healthcare, legal rights, essential services, immigration, law enforcement, education admission or assessment, biometric identification, safety-critical operation or another decision having legal or similarly significant effects on an individual.",
        },
      ],
    },
    {
      n: "4",
      heading: "Prohibited and restricted data",
      blocks: [
        {
          kind: "p",
          text: "4.1 The Client must not submit special-category data, criminal-conviction data, secret credentials, full payment-card data or other highly sensitive information to an AI Feature unless the SOW expressly permits the category and the required data-protection and security review has been completed.",
        },
        {
          kind: "p",
          text: "4.2 The Client must not use an AI Feature for unlawful discrimination, deception, impersonation, malware, credential theft, prohibited surveillance or other unlawful purposes.",
        },
      ],
    },
    {
      n: "5",
      heading: "Transparency",
      blocks: [
        {
          kind: "p",
          text: "5.1 Where an AI system directly interacts with a natural person, the Client System should clearly disclose that the person is interacting with AI unless the applicable law plainly does not require it and the context is obvious.",
        },
        {
          kind: "p",
          text: `5.2 If the Client deploys the AI Feature into the EU/EEA or another jurisdiction with AI-specific transparency obligations, the Client must identify that deployment territory. ${E.tradingName} shall implement technical notices or marking features expressly included in the SOW, but the Client remains responsible for deciding the legal disclosures required for its business and content.`,
        },
        {
          kind: "p",
          text: "5.3 AI-generated public-interest content, synthetic media, deepfakes or other regulated generated content requires a separate compliance review before deployment.",
        },
      ],
    },
    {
      n: "6",
      heading: "Automated decision-making and profiling",
      blocks: [
        {
          kind: "p",
          text: "If an AI Feature processes personal data to make or support a significant decision about a person, the parties shall assess the applicable data-protection safeguards, lawful basis, transparency, human intervention and contestability requirements before live use. Special-category data requires heightened review.",
        },
      ],
    },
    {
      n: "7",
      heading: "Model-provider data use",
      blocks: [
        {
          kind: "p",
          text: `7.1 ${E.tradingName} shall configure Model Provider options in accordance with the SOW and available provider controls. ${E.tradingName} will not intentionally use Client Data to train a general-purpose ${E.tradingName} model without express written agreement.`,
        },
        {
          kind: "p",
          text: "7.2 The Model Provider's applicable API or business terms govern its own handling of data. Where it acts as a subprocessor, it is subject to the DPA subprocessor process.",
        },
      ],
    },
    {
      n: "8",
      heading: "Prompt injection, actions and tools",
      blocks: [
        {
          kind: "p",
          text: "8.1 AI agents that can send emails, access databases, make bookings, call APIs or take other actions must be designed with permissions, validation and human confirmation proportionate to the risk.",
        },
        {
          kind: "p",
          text: "8.2 No technical control can eliminate prompt-injection or model-manipulation risk. The Client must not grant an agent broader credentials or financial authority than reasonably necessary.",
        },
        {
          kind: "p",
          text: "8.3 High-impact irreversible actions should require explicit confirmation unless a reviewed SOW defines a safe autonomous workflow.",
        },
      ],
    },
    {
      n: "9",
      heading: "Intellectual property and outputs",
      blocks: [
        {
          kind: "p",
          text: "9.1 Rights in AI Inputs remain with the party that owns them. The Client grants necessary licences for processing.",
        },
        {
          kind: "p",
          text: `9.2 Rights in AI Outputs may depend on applicable law and Model Provider terms. ${E.tradingName} does not warrant that AI Output is unique, non-infringing or capable of exclusive ownership.`,
        },
        {
          kind: "p",
          text: "9.3 The Client must review AI Output before commercial publication where infringement, defamation, accuracy or brand risk is material.",
        },
      ],
    },
    {
      n: "10",
      heading: "Model changes and suspension",
      blocks: [
        {
          kind: "p",
          text: `${E.tradingName} may replace or update a model where reasonably necessary for availability, security, cost, provider deprecation or performance, provided material agreed functionality is not intentionally reduced without notice. ${E.tradingName} may suspend unsafe or unlawful AI use immediately.`,
        },
      ],
    },
    {
      n: "11",
      heading: "Usage and cost",
      blocks: [
        {
          kind: "p",
          text: `AI usage is subject to the Pricing, Scale and Usage Schedule. The Client may request a spend cap or agreed usage limit. Where technically available, ${E.tradingName} implements alerts before material overage.`,
        },
      ],
    },
  ],
};
