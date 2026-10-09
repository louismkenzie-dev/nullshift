/**
 * Self-serve product catalogue — the single source of truth for every
 * off-the-shelf Nullshift product (programme brief: docs/products/PROGRAMME-2026-10-09.md).
 *
 * Marketing pages, the /app console, Stripe Checkout and the entitlement check
 * all read from HERE. A price or a name changes in one place.
 *
 * Prices are in PENCE per month (GBP). Trials are in days.
 */

export const PRODUCT_SLUGS = ["quote", "legal", "watch", "plans", "studio"] as const;
export type ProductSlug = (typeof PRODUCT_SLUGS)[number];

export type Product = {
  slug: ProductSlug;
  /** Short brand name shown in the console and nav. */
  name: string;
  /** Long name for marketing headings. */
  title: string;
  /** One line under the title. */
  tagline: string;
  /** Who it is for, plain English. */
  audience: string;
  pricePence: number;
  trialDays: number;
  /** Marketing bullets — what you get. */
  features: string[];
  /** Three-step "how it works" for the product page. */
  steps: { title: string; body: string }[];
  /** Per-product FAQ. */
  faqs: { q: string; a: string }[];
  /** Hard limits enforced in the console (also quoted on the product page). */
  limits: Record<string, number>;
  /** Index used in eyebrows and the nav ladder. */
  index: string;
};

export const PRODUCTS: Record<ProductSlug, Product> = {
  quote: {
    slug: "quote",
    name: "Quote",
    title: "Nullshift Quote",
    tagline: "A price in sixty seconds, on your own website.",
    audience:
      "Plumbers, electricians, roofers, decorators, landscapers — any trade that loses evenings to quote requests.",
    pricePence: 2900,
    trialDays: 14,
    index: "01",
    features: [
      "Paste one script tag — the widget appears on any website builder",
      "Your rate card: fixed-price jobs, per-unit work and hourly call-outs",
      "Smart questions that adjust the price (property type, access, urgency)",
      "Customers see a low–high range, you see the exact answers",
      "Every lead emailed to you and kept in your dashboard",
      "Branded with your colour and logo; no Nullshift badge on paid plans",
    ],
    steps: [
      {
        title: "Set your rates",
        body: "Add the jobs you do and what you charge. Fixed, per unit or per hour — plus the questions that change the price.",
      },
      {
        title: "Paste the tag",
        body: "One line of code goes on your website, Wix, Squarespace or WordPress. It renders as a tidy panel in your colours.",
      },
      {
        title: "Leads arrive priced",
        body: "A customer answers the questions, sees a range, leaves their details. You get the lead with the ballpark already attached.",
      },
    ],
    faqs: [
      {
        q: "Will it quote the wrong price?",
        a: "It shows a range, not a fixed quote, and says so. You set the low and high margins. Every final price is still yours to confirm.",
      },
      {
        q: "Does it work on Wix, Squarespace or WordPress?",
        a: "Yes. Anywhere you can paste an HTML embed, the tag works. We give you a copy-and-paste snippet.",
      },
      {
        q: "What happens to the leads?",
        a: "They are emailed to you within seconds and kept in your dashboard with every answer. Export any time as CSV.",
      },
      {
        q: "Can I turn it off for a week?",
        a: "Yes — pause the widget from the dashboard and it disappears from your site until you switch it back on.",
      },
    ],
    limits: { widgets: 3, services: 40, leadsPerMonth: 500 },
  },
  legal: {
    slug: "legal",
    name: "Legal",
    title: "Nullshift Legal",
    tagline: "Privacy, cookies and terms for your website, hosted and kept current.",
    audience:
      "Any UK small business with a website that collects a name and an email address.",
    pricePence: 1200,
    trialDays: 14,
    index: "02",
    features: [
      "Privacy Notice, Cookie Policy and Website Terms generated from a ten-minute form",
      "Hosted on a clean page you link to — or embed the text on your own site",
      "Written for UK GDPR and PECR, in plain English, clause-numbered",
      "Edit an answer and every document updates; a changelog records what changed",
      "Covers analytics, forms, newsletters, online payments and bookings",
      "Download as HTML to hand to your web developer",
    ],
    steps: [
      {
        title: "Answer the form",
        body: "Who you are, what the website does, which tools you use. Ten minutes, no legal jargon.",
      },
      {
        title: "Documents appear",
        body: "Three documents are generated and hosted at your own link. Review them, then point your footer at them.",
      },
      {
        title: "Stay current",
        body: "Change an answer when your site changes. The text updates, the version bumps, the old version is kept.",
      },
    ],
    faqs: [
      {
        q: "Is this legal advice?",
        a: "No. These are template documents generated from your answers. They cover the common cases well; a regulated business or anything unusual should have a solicitor review them.",
      },
      {
        q: "Can I put the text on my own website instead?",
        a: "Yes. Every document can be copied or downloaded as HTML. The hosted page is the easy option, not the only one.",
      },
      {
        q: "What if the law changes?",
        a: "We update the templates. Your documents regenerate with a new version number and you get an email saying what changed.",
      },
      {
        q: "Does it include a Data Processing Agreement?",
        a: "Not at launch. It is on the roadmap for businesses that process data for other businesses.",
      },
    ],
    limits: { sites: 3 },
  },
  watch: {
    slug: "watch",
    name: "Watch",
    title: "Nullshift Watch",
    tagline: "Know your sites are up, fast and not quietly broken.",
    audience:
      "Freelancers and small agencies who look after client websites, and owners who want one email a month that says everything is fine.",
    pricePence: 1900,
    trialDays: 14,
    index: "03",
    features: [
      "Uptime check every fifteen minutes with an alert when a site goes down",
      "SSL certificate expiry warnings at 30, 14 and 7 days",
      "Weekly broken-link sweep of the pages your homepage links to",
      "PageSpeed scores for mobile and desktop, tracked over time",
      "A monthly client-ready report email per site, in plain English",
      "Up to ten sites on one plan",
    ],
    steps: [
      {
        title: "Add a site",
        body: "Paste the URL and a label. Optionally add the client's email for the monthly report.",
      },
      {
        title: "We watch it",
        body: "Uptime every fifteen minutes, SSL daily, links and speed weekly. Nothing to install on the site.",
      },
      {
        title: "You get told",
        body: "Downtime alerts when they matter. Otherwise one monthly report, ready to forward to the client.",
      },
    ],
    faqs: [
      {
        q: "Do I need to install anything on the site?",
        a: "No. Everything is checked from the outside, exactly as a visitor would see it.",
      },
      {
        q: "How fast is a downtime alert?",
        a: "Checks run every fifteen minutes and an alert is emailed after two consecutive failures, so around thirty minutes at most.",
      },
      {
        q: "What does the client see?",
        a: "A plain-English monthly report with uptime, speed scores and anything that needs fixing. Your name, not ours.",
      },
      {
        q: "Can I add more than ten sites?",
        a: "Add a second plan or talk to us about an agency tier.",
      },
    ],
    limits: { sites: 10 },
  },
  plans: {
    slug: "plans",
    name: "Plans",
    title: "Nullshift Plans",
    tagline: "An AI systems plan for every visitor who asks — under your brand.",
    audience:
      "Growth consultants, web agencies and freelancers who want a lead magnet that actually earns the email address.",
    pricePence: 4900,
    trialDays: 14,
    index: "04",
    features: [
      "Embeddable questionnaire about the visitor's business and bottlenecks",
      "Claude writes a tailored systems plan: priorities, quick wins, a 90-day roadmap",
      "Your brand name, colour and services — Nullshift stays out of sight",
      "Lead and plan land in your dashboard; the visitor gets a link by email",
      "Fifty plans a month included, then pay as you go",
      "Export leads to CSV or forward them to your CRM by email",
    ],
    steps: [
      {
        title: "Describe your practice",
        body: "Your name, what you offer, who you serve. The plan recommends your services, not generic software.",
      },
      {
        title: "Embed the form",
        body: "One tag on your site or a hosted link in your bio. Visitors answer six questions.",
      },
      {
        title: "Plans write themselves",
        body: "A plan is generated in under a minute, emailed to the visitor, and the lead is in your dashboard with the plan attached.",
      },
    ],
    faqs: [
      {
        q: "Does it mention Nullshift?",
        a: "No. The plan carries your brand and recommends your services. There is a small 'powered by' line in the footer of the hosted page that you can remove.",
      },
      {
        q: "What does it cost per plan over the included fifty?",
        a: "£1 per additional plan, billed monthly.",
      },
      {
        q: "Can I edit a plan before the visitor sees it?",
        a: "The visitor receives it immediately by design. You can see every plan and follow up with your own notes.",
      },
      {
        q: "What if someone enters nonsense?",
        a: "Rate limits and a spam check keep the volume honest; plans for junk input are not counted against your allowance.",
      },
    ],
    limits: { embeds: 3, plansPerMonth: 50 },
  },
  studio: {
    slug: "studio",
    name: "Studio",
    title: "Nullshift Studio",
    tagline: "Proposals, acceptance and invoices, under your own name.",
    audience:
      "Freelancers and agencies of one to five who patch together five tools to send a proposal and get paid.",
    pricePence: 3900,
    trialDays: 14,
    index: "05",
    features: [
      "Proposals with line items, a scope and your terms",
      "One link for the client: read, accept and sign by typed name — with a hashed snapshot of what they accepted",
      "Invoices generated from accepted proposals, with your bank details or a payment link",
      "Private notes against every client",
      "Your logo and colour on every client-facing page",
      "Twenty-five active clients included",
    ],
    steps: [
      {
        title: "Add a client",
        body: "Name, company, email. Add your logo and colour once and every page carries it.",
      },
      {
        title: "Send a proposal",
        body: "Line items, scope and terms. The client gets a link, reads it, accepts by typing their name.",
      },
      {
        title: "Invoice and get paid",
        body: "Turn the acceptance into an invoice in one click. Bank transfer or your own payment link.",
      },
    ],
    faqs: [
      {
        q: "Is a typed-name acceptance binding?",
        a: "In England and Wales a typed name with intent to sign is an electronic signature. We record the time, the IP address and a hash of the exact proposal text.",
      },
      {
        q: "Can I take card payments?",
        a: "Paste your own Stripe or GoCardless payment link onto the invoice. Money goes straight to you; we never touch it.",
      },
      {
        q: "Does the client need an account?",
        a: "No. They open a private link. You can revoke it any time.",
      },
      {
        q: "Can I use my own domain?",
        a: "Not at launch. Pages live at nullshift.co.uk/c/… with your branding. Custom domains are on the roadmap.",
      },
    ],
    limits: { clients: 25 },
  },
};

export const PRODUCT_LIST: Product[] = PRODUCT_SLUGS.map((s) => PRODUCTS[s]);

export function isProductSlug(value: string): value is ProductSlug {
  return (PRODUCT_SLUGS as readonly string[]).includes(value);
}

export function productBySlug(slug: string): Product | null {
  return isProductSlug(slug) ? PRODUCTS[slug] : null;
}

export function formatMonthly(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}/mo`;
}

/** Statuses that grant access to a product's console and public surfaces. */
export const ENTITLED_STATUSES = ["trialing", "active", "past_due"] as const;
export type ProductSubscriptionStatus =
  | (typeof ENTITLED_STATUSES)[number]
  | "canceled"
  | "incomplete"
  | "unpaid"
  | "expired";
