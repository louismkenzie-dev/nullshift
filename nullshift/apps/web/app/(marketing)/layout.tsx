import type { Metadata } from "next";
import { SmoothScroll } from "@/components/SmoothScroll";
import { ConsentBanner } from "@/components/ConsentBanner";
import { IntroSplash } from "@/components/IntroSplash";
import { PageTransition } from "@/components/PageTransition";
import { ScrollProgress } from "@/components/ScrollProgress";
import { LEGAL_ENTITY } from "@nullshift/content/legalEntity";
import { CARE_PLANS } from "@/lib/carePlans";

const SITE_URL = "https://nullshift.co.uk";
const TITLE = "Nullshift — Websites, Systems & Automations";
const DESCRIPTION =
  "Nullshift designs, builds and runs bespoke websites, custom systems and the automations behind them — owned outright by your business. No per-seat SaaS fees.";

// Marketing-only layout: the public site's SEO metadata, smooth scrolling and
// privacy consent banner live here, NOT in the root layout, so the internal
// /admin and /portal surfaces are never wrapped by Lenis or the cookie banner.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Nullshift",
    type: "website",
    locale: "en_GB",
    // TODO: replace /og-image.png with a properly designed 1200×630 share image
    // (current file is a generated brand-mark placeholder).
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Nullshift" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

// LocalBusiness structured data (rendered on every marketing page).
/**
 * Entity graph for search + AI answer engines (AEO). One connected @graph:
 * the company (with its legal identifiers — Companies House + ICO — the
 * strongest disambiguation signals against the unrelated "Nullshift" music/
 * gaming entities), the founder, the website, and the service catalogue with
 * real prices. Facts come from the canonical LEGAL_ENTITY record so the
 * schema can never drift from the legal pages.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "ProfessionalService"],
      "@id": `${SITE_URL}/#organization`,
      name: "Nullshift",
      legalName: LEGAL_ENTITY.name,
      alternateName: ["Nullshift Development", "NullShift"],
      description: DESCRIPTION,
      url: SITE_URL,
      email: LEGAL_ENTITY.email,
      logo: `${SITE_URL}/logos/nullshift-wordmark.svg`,
      image: `${SITE_URL}/logos/nullshift-wordmark.svg`,
      areaServed: ["London", "United Kingdom", "Worldwide"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "66 Paul Street",
        addressLocality: "London",
        postalCode: "EC2A 4NA",
        addressCountry: "GB",
      },
      priceRange: "££",
      founder: [
        { "@id": `${SITE_URL}/#founder` },
        { "@id": `${SITE_URL}/#cofounder` },
      ],
      identifier: [
        {
          "@type": "PropertyValue",
          name: "Companies House number",
          value: LEGAL_ENTITY.companyNumber,
        },
        {
          "@type": "PropertyValue",
          name: "UK ICO data protection registration",
          value: LEGAL_ENTITY.ico,
        },
      ],
      sameAs: [
        "https://www.linkedin.com/company/nullshift-development-ltd",
        `https://find-and-update.company-information.service.gov.uk/company/${LEGAL_ENTITY.companyNumber}`,
        `https://ico.org.uk/ESDWebPages/Entry/${LEGAL_ENTITY.ico}`,
      ],
      knowsAbout: [
        "agentic AI systems",
        "business process automation",
        "bespoke booking and payments systems",
        "custom business software",
        "AI workflow automation",
        "Next.js",
        "Supabase",
        "Stripe integrations",
      ],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Nullshift services",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Bespoke system build",
              description:
                "Custom-built business systems — booking, payments, client portals, automation — owned outright by the client: code, data and accounts.",
            },
          },
          ...CARE_PLANS.map((p) => ({
            "@type": "Offer",
            price: String(p.mrr),
            priceCurrency: "GBP",
            itemOffered: {
              "@type": "Service",
              name: `${p.label} care plan`,
              description: p.blurb,
            },
          })),
        ],
      },
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#founder`,
      name: "Louis McKenzie",
      jobTitle: "Co-Founder & Lead Developer",
      worksFor: { "@id": `${SITE_URL}/#organization` },
      url: `${SITE_URL}/about`,
      email: LEGAL_ENTITY.email,
      sameAs: ["https://www.linkedin.com/in/louis-mckenzie-a287b9247"],
      knowsAbout: [
        "agentic AI automation",
        "full-stack development",
        "business operations systems",
      ],
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#cofounder`,
      name: "Christopher Melsa",
      jobTitle: "Co-Founder & Director",
      worksFor: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Nullshift",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <IntroSplash />
      <PageTransition />
      <ScrollProgress />
      <SmoothScroll>{children}</SmoothScroll>
      <ConsentBanner />
    </>
  );
}
