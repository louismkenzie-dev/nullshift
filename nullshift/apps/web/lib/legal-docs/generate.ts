import type { LegalDoc, LegalSection } from "@nullshift/content/legal/text";
import { JURISDICTION_LABEL, LEGAL_FORM_LABEL, type LegalFacts } from "./facts";

/**
 * Template generator. Produces clause-numbered, plain-English documents for a
 * UK small business from its answers. Written against UK GDPR, the Data
 * Protection Act 2018 and PECR (cookies / marketing). Deliberately
 * conservative: where a fact is unknown the text says so rather than guessing.
 *
 * This is a TEMPLATE, not advice — the hosted page carries that notice and the
 * console repeats it. Regulated sectors and special-category data get a
 * flagged placeholder, never silent boilerplate.
 */

export type DocKey = "privacy" | "cookies" | "terms";
export const DOC_KEYS: DocKey[] = ["privacy", "cookies", "terms"];
export const DOC_TITLE: Record<DocKey, string> = {
  privacy: "Privacy Notice",
  cookies: "Cookie Policy",
  terms: "Website Terms of Use",
};

/** Bump when clause wording changes materially; shown on every hosted page. */
export const TEMPLATE_VERSION = "LEGAL_TEMPLATES_2026_10_v1";

const ANALYTICS_LABEL: Record<LegalFacts["analytics"], string | null> = {
  none: null,
  ga4: "Google Analytics (Google Ireland Ltd)",
  plausible: "Plausible Analytics (privacy-friendly, no cookies)",
  fathom: "Fathom Analytics (privacy-friendly, no cookies)",
  matomo: "Matomo",
  other: "a web analytics service",
};
const PAYMENT_LABEL: Record<LegalFacts["onlinePayments"], string | null> = {
  none: null,
  stripe: "Stripe Payments Europe Ltd",
  paypal: "PayPal (Europe) S.à r.l. et Cie, S.C.A.",
  square: "Squareup Europe Ltd",
  gocardless: "GoCardless Ltd",
  other: "a payment processor",
};

function who(f: LegalFacts): string {
  const name =
    f.tradingName && f.tradingName !== f.legalName
      ? `${f.legalName}, trading as ${f.tradingName}`
      : f.legalName;
  const form = LEGAL_FORM_LABEL[f.legalForm];
  const num = f.companyNumber ? ` (company number ${f.companyNumber})` : "";
  return `${name}, ${form}${num}, of ${f.registeredAddress}`;
}

function brand(f: LegalFacts): string {
  return f.tradingName || f.legalName || "we";
}

function processors(f: LegalFacts): string[] {
  const list: string[] = [];
  if (f.hosting) list.push(`${f.hosting} — hosts this website`);
  if (f.contactForms)
    list.push(
      "Our email provider — receives the messages you send us through the website"
    );
  if (f.newsletter)
    list.push(
      `${f.newsletterTool || "Our email marketing platform"} — sends our newsletter and records opens and unsubscribes`
    );
  if (f.onlineBookings)
    list.push(
      `${f.bookingTool || "Our booking system"} — manages appointments and sends reminders`
    );
  const pay = PAYMENT_LABEL[f.onlinePayments];
  if (pay) list.push(`${pay} — processes payments; we never see your full card number`);
  const an = ANALYTICS_LABEL[f.analytics];
  if (an) list.push(`${an} — measures how the website is used`);
  if (f.marketingCookies)
    list.push(
      `${f.marketingTools || "Advertising platforms"} — measure our advertising and may show you relevant adverts elsewhere`
    );
  if (f.liveChat)
    list.push(
      `${f.liveChatTool || "Our live chat provider"} — runs the chat window on this website`
    );
  if (f.embeddedMedia)
    list.push(
      "Video and map providers (for example YouTube, Vimeo or Google Maps) — load content you choose to play or view"
    );
  if (f.otherProcessors)
    f.otherProcessors
      .split(/\n|;|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => list.push(s));
  return list;
}

/* ═══════════════════════════ PRIVACY NOTICE ═══════════════════════════ */

export function privacyNotice(f: LegalFacts, hostedUrl: string): LegalDoc {
  const B = brand(f);
  const collects: string[] = [
    "Your name and contact details when you get in touch with us",
  ];
  if (f.contactForms) collects.push("Anything you type into a contact or enquiry form");
  if (f.newsletter)
    collects.push(
      "Your email address and preferences when you subscribe to our newsletter"
    );
  if (f.userAccounts)
    collects.push(
      "Account details such as your username, password (stored encrypted) and settings"
    );
  if (f.onlineBookings)
    collects.push(
      "Appointment details: dates, times, the service booked and any notes you add"
    );
  if (f.onlinePayments !== "none" || f.sellsGoods)
    collects.push(
      "Order and payment records (the payment itself is handled by our payment processor; we see the last four digits of a card at most)"
    );
  if (f.sellsGoods) collects.push("Delivery address and order history");
  if (f.liveChat) collects.push("Messages you send through live chat");
  if (ANALYTICS_LABEL[f.analytics])
    collects.push(
      "Technical information about your visit: pages viewed, device and browser type, approximate location from your IP address"
    );
  if (f.cctv) collects.push("CCTV images if you visit our premises");
  if (f.healthData)
    collects.push(
      "Information about your health where you choose to share it with us for the service you have asked for"
    );

  const purposes: string[] = [
    "To reply to your enquiries and provide the services you ask for (performance of a contract, or steps before one)",
    "To run and secure the website, prevent fraud and keep records we are legally required to keep (legitimate interests and legal obligation)",
  ];
  if (f.newsletter)
    purposes.push(
      "To send our newsletter where you have signed up (consent — unsubscribe at any time using the link in every email)"
    );
  if (f.onlineBookings)
    purposes.push(
      "To manage appointments and send booking confirmations and reminders (performance of a contract)"
    );
  if (f.onlinePayments !== "none" || f.sellsGoods)
    purposes.push(
      "To take payment, deliver what you ordered and handle returns and refunds (performance of a contract and legal obligation for tax records)"
    );
  if (ANALYTICS_LABEL[f.analytics])
    purposes.push(
      f.analytics === "plausible" || f.analytics === "fathom"
        ? "To understand how the website is used, with aggregate, cookie-free analytics (legitimate interests)"
        : "To understand how the website is used (consent — only after you accept analytics cookies)"
    );
  if (f.marketingCookies)
    purposes.push(
      "To measure our advertising and show relevant adverts (consent — only after you accept marketing cookies)"
    );
  if (f.healthData)
    purposes.push(
      "To provide the service you have asked for where that involves health information (explicit consent, and Article 9(2)(h) UK GDPR where we provide care under professional responsibility)"
    );

  const sections: LegalSection[] = [
    {
      n: "1",
      heading: "Who we are",
      blocks: [
        {
          kind: "p",
          text: `This notice explains how ${who(f)} ("${B}", "we", "us") collects and uses personal data when you use ${f.websiteUrl} and when you deal with us. We are the data controller for that data.`,
        },
        ...(f.icoRegistration
          ? [
              {
                kind: "p" as const,
                text: `We are registered with the Information Commissioner's Office (ICO) under registration number ${f.icoRegistration}.`,
              },
            ]
          : []),
        {
          kind: "p",
          text: `Questions about this notice or your data: email ${f.contactEmail}${f.contactPhone ? ` or call ${f.contactPhone}` : ""}.`,
        },
      ],
    },
    {
      n: "2",
      heading: "The information we collect",
      blocks: [
        {
          kind: "p",
          text: "We collect only what we need to deal with you. Depending on how you use the website, this may include:",
        },
        { kind: "bullets", items: collects },
        ...(f.under18s
          ? [
              {
                kind: "p" as const,
                text: "Some of our services are used by people under 18. Where we collect information about a child we rely on consent from a parent or guardian for anyone under 13 and take extra care with that data. We never knowingly market to children.",
              },
            ]
          : [
              {
                kind: "p" as const,
                text: "This website is not aimed at children and we do not knowingly collect data from anyone under 13.",
              },
            ]),
      ],
    },
    {
      n: "3",
      heading: "Why we use it and our lawful basis",
      blocks: [
        {
          kind: "p",
          text: "UK data protection law requires a lawful basis for each use. Ours are in brackets:",
        },
        { kind: "bullets", items: purposes },
        {
          kind: "p",
          text: "Where we rely on legitimate interests we have considered the impact on you and concluded it is minimal and what you would reasonably expect. You can object at any time (section 8).",
        },
      ],
    },
    {
      n: "4",
      heading: "Who we share it with",
      blocks: [
        {
          kind: "p",
          text: "We do not sell your data. We share it only with the service providers below, who process it on our instructions under contracts that require them to protect it, and with professional advisers, insurers and authorities where the law requires.",
        },
        {
          kind: "bullets",
          items: processors(f).length
            ? processors(f)
            : [
                "Our IT and email providers, who store and transmit the messages you send us",
              ],
        },
      ],
    },
    {
      n: "5",
      heading: "International transfers",
      blocks: [
        {
          kind: "p",
          text:
            f.internationalTransfers ||
            f.analytics === "ga4" ||
            f.marketingCookies ||
            f.liveChat
              ? "Some of the providers above are based outside the UK, mainly in the United States. Where data leaves the UK we rely on the UK's adequacy regulations, the UK International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses, together with the provider's own safeguards."
              : "We keep your data in the UK or the European Economic Area. If that changes we will update this notice and put appropriate safeguards in place first.",
        },
      ],
    },
    {
      n: "6",
      heading: "How long we keep it",
      blocks: [
        {
          kind: "p",
          text: `We keep enquiry and customer records for ${f.retentionMonths} months after our last contact with you, unless a longer period is required by law (for example, six years for tax and accounting records) or needed to deal with a complaint or claim.`,
        },
        ...(f.newsletter
          ? [
              {
                kind: "p" as const,
                text: "Newsletter details are kept until you unsubscribe, and a suppression record of your address is kept afterwards so we do not email you again by mistake.",
              },
            ]
          : []),
        ...(f.cctv
          ? [
              {
                kind: "p" as const,
                text: "CCTV recordings are overwritten after 30 days unless retained for an incident.",
              },
            ]
          : []),
      ],
    },
    {
      n: "7",
      heading: "How we protect it",
      blocks: [
        {
          kind: "p",
          text: "The website is served over HTTPS. Access to personal data is limited to the people who need it, protected by passwords and, where available, two-factor authentication. Our providers are chosen for their security certifications. No system is perfectly secure, so if we ever suffer a breach that is likely to affect your rights we will tell you and the ICO as the law requires.",
        },
      ],
    },
    {
      n: "8",
      heading: "Your rights",
      blocks: [
        {
          kind: "p",
          text: "You have the right to: access a copy of your data; have inaccurate data corrected; have data erased where there is no good reason to keep it; restrict or object to processing, including any direct marketing; receive your data in a portable format; and withdraw consent at any time where consent is our basis.",
        },
        {
          kind: "p",
          text: `To exercise any right, email ${f.contactEmail}. We will respond within one month. We may ask you to confirm your identity first. There is normally no charge.`,
        },
        {
          kind: "p",
          text: "If you are unhappy with how we handle your data you can complain to the Information Commissioner's Office at ico.org.uk or on 0303 123 1113. We would appreciate the chance to resolve it first.",
        },
      ],
    },
    {
      n: "9",
      heading: "Cookies",
      blocks: [
        {
          kind: "p",
          text: f.includeCookies
            ? `We use cookies and similar technologies. Our Cookie Policy at ${hostedUrl}/cookies explains which ones and how to control them.`
            : "We use only the cookies strictly necessary for the website to work. We do not use analytics or advertising cookies.",
        },
      ],
    },
    {
      n: "10",
      heading: "Changes to this notice",
      blocks: [
        {
          kind: "p",
          text: "We will update this notice when our practices or the law change. The version and date at the top of the page tell you when it was last changed. Significant changes will be flagged on the website or by email where we hold your address.",
        },
      ],
    },
  ];
  if (f.healthData) {
    sections.splice(3, 0, {
      n: "3A",
      heading: "Health information — to be confirmed",
      blocks: [
        {
          kind: "note",
          text: "PLACEHOLDER: this business handles health information, which is special-category data. The lawful basis, retention period and safeguards in this section must be confirmed by a solicitor or data-protection adviser before publication.",
        },
      ],
    });
  }
  return {
    slug: "privacy",
    title: DOC_TITLE.privacy,
    summary: `How ${B} collects, uses and protects personal data, and the rights you have over it.`,
    sections,
  };
}

/* ═══════════════════════════ COOKIE POLICY ═══════════════════════════ */

export function cookiePolicy(f: LegalFacts): LegalDoc {
  const B = brand(f);
  const necessary = [
    "Session and security cookies that keep the website working and protect forms from abuse",
    "A cookie that remembers your cookie choices so we do not ask again",
  ];
  if (f.userAccounts)
    necessary.push("A login cookie that keeps you signed in to your account");
  if (f.onlinePayments !== "none")
    necessary.push(
      "Fraud-prevention cookies set by our payment processor during checkout"
    );
  if (f.onlineBookings)
    necessary.push("Cookies set by our booking system while you book");
  const an = ANALYTICS_LABEL[f.analytics];
  const analyticsCookieless = f.analytics === "plausible" || f.analytics === "fathom";
  const rows: string[][] = [
    [
      "Strictly necessary",
      "Make the site work",
      "No consent needed",
      "Session to 12 months",
    ],
  ];
  if (an && !analyticsCookieless)
    rows.push([
      "Analytics",
      `${an}: pages visited, device, approximate location`,
      "Only with your consent",
      "Up to 26 months",
    ]);
  if (f.marketingCookies)
    rows.push([
      "Marketing",
      `${f.marketingTools || "Advertising platforms"}: measure adverts and personalise them`,
      "Only with your consent",
      "Up to 13 months",
    ]);
  if (f.embeddedMedia)
    rows.push([
      "Embedded content",
      "Set by YouTube, Vimeo, Google Maps etc. when you load their content",
      "Only with your consent",
      "Varies by provider",
    ]);
  if (f.liveChat)
    rows.push([
      "Live chat",
      `${f.liveChatTool || "Chat provider"}: keeps your conversation open between pages`,
      "Only when you open the chat",
      "Up to 12 months",
    ]);

  return {
    slug: "cookies",
    title: DOC_TITLE.cookies,
    summary: `Which cookies ${f.websiteUrl} uses, why, and how to control them.`,
    sections: [
      {
        n: "1",
        heading: "What cookies are",
        blocks: [
          {
            kind: "p",
            text: "Cookies are small text files a website stores on your device. Similar technologies (local storage, pixels) do the same job and this policy covers them too. Under the Privacy and Electronic Communications Regulations we need your consent before setting any cookie that is not strictly necessary for the site to work.",
          },
        ],
      },
      {
        n: "2",
        heading: "Cookies we use",
        blocks: [
          { kind: "table", head: ["Type", "What it does", "Consent", "How long"], rows },
          { kind: "p", text: "Strictly necessary cookies include:" },
          { kind: "bullets", items: necessary },
          ...(an && analyticsCookieless
            ? [
                {
                  kind: "p" as const,
                  text: `We measure visits with ${an}, which does not use cookies or store personal data, so no consent banner is needed for it.`,
                },
              ]
            : []),
          ...(!an && !f.marketingCookies && !f.embeddedMedia && !f.liveChat
            ? [
                {
                  kind: "p" as const,
                  text: `${B} uses only strictly necessary cookies. We do not use analytics or advertising cookies.`,
                },
              ]
            : []),
        ],
      },
      {
        n: "3",
        heading: "How to control cookies",
        blocks: [
          {
            kind: "p",
            text:
              rows.length > 1
                ? "When you first visit we ask which optional cookies you accept. Nothing optional is set until you say yes. You can change your mind at any time using the cookie settings link in the website footer."
                : "Because we only use strictly necessary cookies there is nothing to opt into or out of here.",
          },
          {
            kind: "p",
            text: "You can also block or delete cookies in your browser settings. Blocking strictly necessary cookies may stop parts of the website working.",
          },
        ],
      },
      {
        n: "4",
        heading: "Contact",
        blocks: [
          {
            kind: "p",
            text: `Questions about cookies: ${f.contactEmail}. Our Privacy Notice explains how we handle personal data more generally.`,
          },
        ],
      },
    ],
  };
}

/* ═══════════════════════════ WEBSITE TERMS ═══════════════════════════ */

export function websiteTerms(f: LegalFacts): LegalDoc {
  const B = brand(f);
  const law = JURISDICTION_LABEL[f.jurisdiction];
  const sections: LegalSection[] = [
    {
      n: "1",
      heading: "These terms",
      blocks: [
        {
          kind: "p",
          text: `These terms govern your use of ${f.websiteUrl} (the "website"), operated by ${who(f)} ("${B}", "we", "us"). By using the website you agree to them. If you buy goods or services from us, separate terms of sale or a written agreement apply to that purchase and take priority where they differ.`,
        },
      ],
    },
    {
      n: "2",
      heading: "Using the website",
      blocks: [
        {
          kind: "p",
          text: "You may use the website for lawful purposes only. You must not: try to gain unauthorised access to it or any system connected to it; introduce malware; copy, scrape or republish its content other than for your own personal, non-commercial use; or use it to send unsolicited communications.",
        },
        ...(f.userAccounts
          ? [
              {
                kind: "p" as const,
                text: "If you create an account you are responsible for keeping your password confidential and for everything done under your account. Tell us straight away if you think it has been compromised. We may suspend or close accounts that break these terms.",
              },
            ]
          : []),
      ],
    },
    {
      n: "3",
      heading: "Information on the website",
      blocks: [
        {
          kind: "p",
          text: `We take care to keep the website accurate and up to date, but it is provided for general information. ${f.describeBusiness ? `${f.describeBusiness.replace(/\.$/, "")}. ` : ""}Nothing on the website is professional advice tailored to your circumstances; please contact us before relying on it. Prices, availability and descriptions may change without notice.`,
        },
        ...(f.onlineBookings
          ? [
              {
                kind: "p" as const,
                text: "Online bookings are requests until confirmed by us. The confirmation email forms the contract for that appointment, together with any cancellation terms set out in it.",
              },
            ]
          : []),
        ...(f.sellsGoods
          ? [
              {
                kind: "p" as const,
                text: "Where you buy goods through the website, our terms of sale and your statutory rights under the Consumer Rights Act 2015 and the Consumer Contracts Regulations 2013 apply, including your 14-day right to cancel most online purchases.",
              },
            ]
          : []),
      ],
    },
    {
      n: "4",
      heading: "Intellectual property",
      blocks: [
        {
          kind: "p",
          text: `The website and its content — text, images, logos, design and code — belong to ${B} or our licensors and are protected by copyright and trade mark law. You may view, print and download extracts for personal use. Any other use needs our written permission.`,
        },
      ],
    },
    {
      n: "5",
      heading: "Links and third-party content",
      blocks: [
        {
          kind: "p",
          text: "The website may link to or embed content from other websites. We do not control them and are not responsible for their content or how they handle your data. A link is not an endorsement.",
        },
      ],
    },
    {
      n: "6",
      heading: "Our liability",
      blocks: [
        {
          kind: "p",
          text: "Nothing in these terms limits our liability for death or personal injury caused by negligence, for fraud, or for anything else the law does not allow us to limit. Otherwise, to the extent permitted by law, we are not liable for any loss or damage arising from your use of, or inability to use, the website or your reliance on its content. We do not guarantee that the website will always be available or free of errors or viruses.",
        },
        {
          kind: "p",
          text: "If you are a consumer, these terms do not affect your statutory rights.",
        },
      ],
    },
    {
      n: "7",
      heading: "Privacy",
      blocks: [
        {
          kind: "p",
          text: "Our Privacy Notice and Cookie Policy explain how we handle personal data and cookies. They form part of these terms.",
        },
      ],
    },
    {
      n: "8",
      heading: "Changes",
      blocks: [
        {
          kind: "p",
          text: "We may change these terms at any time by updating this page. The version date at the top tells you when. Continuing to use the website after a change means you accept the new terms.",
        },
      ],
    },
    {
      n: "9",
      heading: "Governing law",
      blocks: [
        {
          kind: "p",
          text: `These terms are governed by the law of ${law}. Disputes will be dealt with by the courts of ${law}, except that if you are a consumer living elsewhere in the UK you may bring a claim in your local courts.`,
        },
      ],
    },
    {
      n: "10",
      heading: "Contact",
      blocks: [
        {
          kind: "p",
          text: `${who(f)}. Email ${f.contactEmail}${f.contactPhone ? `, phone ${f.contactPhone}` : ""}.${f.vatNumber ? ` VAT number ${f.vatNumber}.` : ""}`,
        },
      ],
    },
  ];
  return {
    slug: "terms",
    title: DOC_TITLE.terms,
    summary: `The rules for using ${f.websiteUrl}.`,
    sections,
  };
}

export function generateDoc(key: DocKey, f: LegalFacts, hostedUrl: string): LegalDoc {
  switch (key) {
    case "privacy":
      return privacyNotice(f, hostedUrl);
    case "cookies":
      return cookiePolicy(f);
    case "terms":
      return websiteTerms(f);
  }
}

export function enabledDocs(f: LegalFacts): DocKey[] {
  return DOC_KEYS.filter((k) =>
    k === "privacy"
      ? f.includePrivacy
      : k === "cookies"
        ? f.includeCookies
        : f.includeTerms
  );
}

/** Deterministic text of every enabled document, for hashing and change detection. */
export function canonicalBundle(f: LegalFacts, hostedUrl: string): string {
  return enabledDocs(f)
    .map((k) => {
      const d = generateDoc(k, f, hostedUrl);
      return [
        `# ${d.title}`,
        ...d.sections.flatMap((s) => [
          `## ${s.n} ${s.heading}`,
          ...s.blocks.map((b) =>
            b.kind === "p" || b.kind === "note"
              ? b.text
              : b.kind === "bullets"
                ? b.items.join("\n")
                : [b.head.join("|"), ...b.rows.map((r) => r.join("|"))].join("\n")
          ),
        ]),
      ].join("\n");
    })
    .join("\n\n");
}

/** Static HTML export of one document, for pasting into another CMS. */
export function docToHtml(
  d: LegalDoc,
  opts: { business: string; version: string; updated: string }
): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = d.sections
    .map(
      (s) =>
        `<h2>${esc(s.n)}. ${esc(s.heading)}</h2>` +
        s.blocks
          .map((b) =>
            b.kind === "p"
              ? `<p>${esc(b.text)}</p>`
              : b.kind === "note"
                ? `<p><em>${esc(b.text)}</em></p>`
                : b.kind === "bullets"
                  ? `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`
                  : `<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
          )
          .join("")
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.title)} — ${esc(opts.business)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.65;color:#222}h1{font-size:1.9rem}h2{font-size:1.15rem;margin-top:1.8em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}small{color:#666}</style></head><body><h1>${esc(d.title)}</h1><p><small>${esc(opts.business)} · Version ${esc(opts.version)} · Last updated ${esc(opts.updated)}</small></p><p>${esc(d.summary)}</p>${body}</body></html>`;
}
