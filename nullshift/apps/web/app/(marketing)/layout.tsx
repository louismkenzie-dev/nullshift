import type { Metadata } from "next";
import { SmoothScroll } from "@/components/SmoothScroll";
import { ConsentBanner } from "@/components/ConsentBanner";
import { IntroSplash } from "@/components/IntroSplash";
import { PageTransition } from "@/components/PageTransition";
import { ScrollProgress } from "@/components/ScrollProgress";

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
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Nullshift",
  description: DESCRIPTION,
  url: SITE_URL,
  areaServed: ["London", "United Kingdom", "Worldwide"],
  address: {
    "@type": "PostalAddress",
    // TODO: add your registered streetAddress here.
    addressLocality: "London",
    addressCountry: "GB",
  },
  priceRange: "££",
  logo: `${SITE_URL}/logos/nullshift-wordmark.svg`,
  // TODO: add social profile URLs (LinkedIn, Instagram, X, …).
  sameAs: [] as string[],
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
