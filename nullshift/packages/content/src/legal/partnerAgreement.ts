import { legalConfig } from "./config";
import type { LegalDoc } from "./text";

/**
 * Partner Programme Agreement — plain-English terms for referral and
 * white-label partners. Source of truth for every figure:
 * docs/partners/PROGRAMME-BRIEF-2026-10-09.md.
 *
 * DRAFT FOR SOLICITOR REVIEW. The page that renders this carries a visible
 * notice and nothing is accepted against it until `PARTNER_AGREEMENT_STATUS`
 * is flipped — see /legal/partner-agreement.
 *
 * Structured like the other legal texts so one renderer styles it and the
 * canonical text can be hashed into the version registry.
 */

const E = legalConfig.entity;
const C = legalConfig.contact;
const R = legalConfig.routes;

export const PARTNER_AGREEMENT_VERSION = "PARTNER_2026_10_v1";
export const PARTNER_AGREEMENT_STATUS: "draft" | "active" = "draft";

export const PARTNER_TERMS = {
  referralFeePercent: 10,
  referralPaymentDays: 14,
  attributionMonths: 12,
  whiteLabelDiscountPercent: 25,
  noticeDays: 30,
} as const;

const identity = `${E.legalName}, trading as ${E.tradingName}, company number ${
  E.companyNumber ?? "[company number]"
}, whose registered office is ${E.registeredOffice ?? "[registered office]"}`;

export const PARTNER_AGREEMENT: LegalDoc = {
  slug: "partner-agreement",
  title: "Partner Programme Agreement",
  summary:
    "The terms for agencies and consultancies that introduce clients to Nullshift (referral) or sell Nullshift builds and plans under their own brand (white-label). Written in plain English; the headings are part of the agreement.",
  sections: [
    {
      n: "1",
      heading: "Who this agreement is between",
      blocks: [
        {
          kind: "p",
          text: `This agreement is between ${identity} ("Nullshift", "we", "us") and the business named in the accepted partner application ("the Partner", "you"). It starts on the date we confirm your application in writing (the "Start Date") and continues until ended under section 11.`,
        },
        {
          kind: "p",
          text:
            'Some words have fixed meanings throughout. "Client" means a business you introduce to us, or a business you sell a Nullshift-built system to under your own brand. "Build Fee" means the one-off fee for designing and building a Client\'s system, quoted through our guided estimator and stated in the Client\'s Order Form, excluding VAT, disbursements and any third-party costs. "Monthly Plan" means the Core, Pro or Max service plan that keeps a system running after it goes live. "List Price" means the Build Fee and Monthly Plan prices we would quote a Client directly at the time of the quote. "Client Terms" means our standard client services framework, published at ' +
            R.clientServices +
            ", together with the Data Processing Agreement it incorporates.",
        },
      ],
    },
    {
      n: "2",
      heading: "The two ways to work with us",
      blocks: [
        {
          kind: "p",
          text: "You can take part in one or both of the following models. Your application states which you want to start with; you can add the other later by asking us in writing.",
        },
        {
          kind: "bullets",
          items: [
            "Referral. You introduce a Client to us. We sell to, contract with, build for and support the Client under the Nullshift name. You receive a referral fee on the Build Fee (section 3).",
            "White-label. You sell the system under your own brand. You buy builds and Monthly Plans from us at a discount to List Price, set your own retail price and keep the difference. We deliver, host, support and maintain the system, and we stay invisible to the Client unless you tell them otherwise (section 4).",
          ],
        },
        {
          kind: "p",
          text: "Everything we offer Clients directly is in scope for both models: bespoke websites, booking systems, client portals, CRMs, dashboards, automation, AI assistants and agents, e-commerce and course or membership platforms.",
        },
      ],
    },
    {
      n: "3",
      heading: "Referral partners: the fee",
      blocks: [
        {
          kind: "bullets",
          items: [
            `Amount. We pay you ${PARTNER_TERMS.referralFeePercent}% of the Build Fee actually paid to us by a Client you introduced. The fee is calculated on the Build Fee only, after any discount or credit we agree with the Client.`,
            `When. Clients pay the Build Fee in three milestones: 50% to start, 25% at design sign-off and 25% before go-live. We pay your fee pro-rata as each milestone clears in our account, within ${PARTNER_TERMS.referralPaymentDays} days of each.`,
            "What is not included. No referral fee is payable on Monthly Plan fees, hosting, support, change orders, later projects for the same Client, or third-party costs we pass through at cost.",
            `Attribution window. A Client counts as introduced by you if we receive their first enquiry or your written introduction (naming the business and a contact) within ${PARTNER_TERMS.attributionMonths} months before they sign an Order Form. After that window the introduction lapses, unless we agree an extension in writing.`,
            "Existing pipeline. No fee is payable for a business that was already in our sales pipeline, under contract or a past Client on the date of your introduction. We will tell you promptly, and in writing, if that is the case.",
            "How we pay. Send us an invoice when we confirm a Client's payment has cleared, or ask us to self-bill. Fees are stated exclusive of VAT; add VAT if you are registered. We pay by bank transfer to a UK or international account in your business name.",
            "If a Build Fee is refunded. If we refund a Client's Build Fee in whole or part, we may set off the related referral fee against future fees or ask you to repay it. We will show you the calculation.",
          ],
        },
      ],
    },
    {
      n: "4",
      heading: "White-label partners: pricing, roles and responsibility",
      blocks: [
        {
          kind: "bullets",
          items: [
            `Partner price. You buy builds and Monthly Plans from us at ${PARTNER_TERMS.whiteLabelDiscountPercent}% off List Price at the date of the quote, rounded up to the nearest pound. The partner price is fixed in the written quote we give you for each Client.`,
            "Your retail price. You decide what you charge your Client. We will not disclose the partner price to the Client, and we will not quote the Client directly for the same work while you are their contracting party.",
            "Who contracts with the Client. You choose one of two routes for each Client, stated in the Order Form. (a) You are the contracting party: your Client contracts with you, you contract with us, and you pay us the partner price. (b) Assignment: you introduce the Client to us and we contract with them directly at List Price, in which case the referral terms in section 3 apply instead of this section.",
            "What we do. Whichever route you choose, we design, build, deploy, host, support and maintain the system, and we run the Monthly Plan. We do this through your brand where the Client needs to see a name: status pages, support replies and documentation can carry your name, and we will not contact your Client directly without your agreement except where section 9 (safety and law) requires it.",
            "What you do. You own the relationship with your Client: the sale, the retail invoice, the first line of communication and the collection of your retail price. You pass us the Client's requirements, approvals and content in good time so we can deliver on the dates we quote.",
            "Paying us. We invoice you the partner price on the same milestones we use with direct Clients: 50% of the build to start, 25% at design sign-off and 25% before go-live, and the Monthly Plan monthly in advance. Our obligation to keep the system live follows our invoices to you being paid, not your Client's invoices to you.",
            "No misrepresentation. You must describe the system, our timescales and our scope accurately, and must not make promises on our behalf that we have not put in writing. You must not describe the system as your own in-house development where the Client asks the direct question, and you must not claim certifications, insurance or guarantees we do not hold.",
            "Confidentiality of the arrangement. The existence and terms of your white-label arrangement with us are confidential on both sides. We will not list you as a partner, or your Client as our Client, without your written permission. You will not disclose our partner pricing.",
          ],
        },
      ],
    },
    {
      n: "5",
      heading: "Acceptance review",
      blocks: [
        {
          kind: "p",
          text: "Every partner application, every Client and every piece of work goes through our acceptance review before we commit to it. We review the business, the proposed system, the data it will handle and any regulatory or safety considerations. We may decline a Client or a project, or accept it with conditions, and we will tell you why in plain terms where we can. A declined project earns no fee and attracts no partner price. Acceptance of one project does not imply acceptance of the next.",
        },
      ],
    },
    {
      n: "6",
      heading: "Who owns what",
      blocks: [
        {
          kind: "bullets",
          items: [
            'The Client owns the delivered system. Under our Client Terms, the delivered code, data and every account the system runs on (hosting, domain, database, email, payment and AI accounts) belong to the Client from handover, whichever model you work under. In the white-label model, "Client" for this purpose means the end business using the system, not you, unless the Order Form says otherwise.',
            "We keep our tools. We keep ownership of our own tooling, libraries, templates, know-how and anything we created before or outside the project, and we licence what the Client needs to run their system.",
            "Brands stay with their owners. Each of us keeps our own name, logo and marketing material. You may describe yourself as a Nullshift partner only with our written permission; we may name you as a partner only with yours.",
          ],
        },
      ],
    },
    {
      n: "7",
      heading: "Data protection",
      blocks: [
        {
          kind: "p",
          text: `Each of us is an independent controller of the business-contact information we exchange about each other and about Clients. Where we process personal data on behalf of a Client (for example, their customers' data inside a system we host), our Data Processing Agreement at ${R.clientServices} applies, and in the white-label model you must ensure the Client's instructions reach us through you. You must only pass us personal data you are entitled to share, and you must tell us promptly if a Client raises a data-protection request or complaint about a system we run.`,
        },
      ],
    },
    {
      n: "8",
      heading: "Non-exclusivity and no minimums",
      blocks: [
        {
          kind: "p",
          text: "This agreement is non-exclusive on both sides. You may work with other developers; we may work with other partners and sell directly, including in your sector or region. There is no minimum number of introductions or purchases, and no fee for taking part.",
        },
      ],
    },
    {
      n: "9",
      heading: "Standards, safety and law",
      blocks: [
        {
          kind: "bullets",
          items: [
            "Both of us will comply with the law that applies to us, including UK data-protection law, the Bribery Act 2010 and applicable sanctions. Neither of us will offer or accept anything that could be seen as an inducement to a Client's staff.",
            `Our Acceptable Use Policy at ${R.acceptableUse} applies to every system we build, however it was sold. If a Client's use breaches it, we may suspend the affected feature after giving you (or the Client, in the referral model) notice where it is safe to do so.`,
            "We may contact a Client directly, regardless of model, where we reasonably believe it is necessary to protect people, data or the lawful operation of the system, or where the law requires it. We will tell you first where that is possible.",
          ],
        },
      ],
    },
    {
      n: "10",
      heading: "Marketing and communications",
      blocks: [
        {
          kind: "p",
          text: "You may use the partner materials we give you, unaltered except for adding your own branding where the material says you can. You must not send marketing on our behalf to people who have not agreed to receive it, and you must not represent that Nullshift has endorsed your other services. We will not market to your white-label Clients.",
        },
      ],
    },
    {
      n: "11",
      heading: "Term and ending the agreement",
      blocks: [
        {
          kind: "bullets",
          items: [
            `Either of us may end this agreement at any time by giving the other ${PARTNER_TERMS.noticeDays} days' written notice. Email to the addresses on file is enough.`,
            "Either of us may end it immediately on written notice if the other commits a serious breach that is not put right within 14 days of being asked, becomes insolvent, or brings the other into disrepute.",
            "Referral fees already earned remain payable after the agreement ends, including fees on a Client who signs within the attribution window after the end date. No new introductions are accepted after the end date.",
            "White-label quotes and Order Forms already signed continue on their own terms until the project is delivered and, for Monthly Plans, until the plan is ended under the Client Terms. We will, at your option, either carry on serving the Client through you under this agreement for those projects only, or move the Client to a direct relationship with us at the same monthly price they were paying you. The choice is yours; the Client's continuity is not negotiable.",
          ],
        },
      ],
    },
    {
      n: "12",
      heading: "Live client systems are never switched off",
      blocks: [
        {
          kind: "p",
          text: "Ending this agreement, a dispute between us, or an unpaid partner invoice does not entitle either of us to switch off, degrade or hold hostage a live Client system. Our remedies against each other are financial. If a Client's Monthly Plan is unpaid, we deal with that under the Client Terms with the Client's continuity protected in the same way: notice, a grace period and a full export of their data and code.",
        },
      ],
    },
    {
      n: "13",
      heading: "Liability",
      blocks: [
        {
          kind: "bullets",
          items: [
            "Nothing in this agreement limits liability for death or personal injury caused by negligence, for fraud, or for anything that cannot lawfully be limited.",
            "Subject to that, neither of us is liable to the other for loss of profit, loss of business, loss of goodwill or any indirect or consequential loss arising under this agreement.",
            "Subject to that, each party's total liability to the other under this agreement in any 12-month period is capped at the greater of (a) the referral fees and partner-price payments made between us in that period and (b) £5,000.",
            "Our liability to a Client for a system we build is governed by the Client Terms, not by this agreement. In the white-label model you are responsible for your own retail contract with your Client, and you must not pass on to the Client obligations that exceed what we have agreed with you.",
          ],
        },
      ],
    },
    {
      n: "14",
      heading: "General",
      blocks: [
        {
          kind: "bullets",
          items: [
            "This agreement, your accepted application and each written quote or Order Form are the whole agreement between us about the partner programme. Where they conflict, the Order Form wins for that project, then this agreement.",
            "We may update this agreement by publishing a new version and emailing you at least 30 days before it takes effect. Introductions and quotes made before the effective date stay on the version in force when they were made.",
            "Neither of us may transfer this agreement without the other's written consent, except that we may transfer it to a successor that takes over our business.",
            "Nothing here creates a partnership in law, an agency or employment. Neither of us may bind the other.",
            "Notices are valid if sent by email to the addresses on file, and are treated as received on the next working day.",
            `This agreement is governed by the law of ${legalConfig.legal.governingLaw}, and the courts of England and Wales have exclusive jurisdiction. We will both try to settle any dispute by discussion first, and then by mediation, before going to court.`,
          ],
        },
        {
          kind: "note",
          text: `Questions about the programme or this agreement: ${C.legal}.`,
        },
      ],
    },
  ],
};
