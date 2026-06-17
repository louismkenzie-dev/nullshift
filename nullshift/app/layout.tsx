import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";

const SITE_URL = "https://nullshift.co.uk";
const TITLE = "Nullshift — Web Design & Development";
const DESCRIPTION =
  "Nullshift helps small and medium-sized businesses make the move online — with websites and branding built to last.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  // TODO: add a favicon.ico (or app/icon.png) to public/ and wire it here via
  // `icons: { icon: "/favicon.ico" }`. None present yet, so omitted.
};

// LocalBusiness structured data (rendered on every page).
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Nullshift",
  description: DESCRIPTION,
  url: SITE_URL,
  areaServed: ["Newcastle upon Tyne", "North East England", "United Kingdom"],
  address: {
    "@type": "PostalAddress",
    // TODO: add your registered streetAddress here.
    addressLocality: "Newcastle upon Tyne",
    addressCountry: "GB",
  },
  priceRange: "££",
  logo: `${SITE_URL}/logos/nullshift-wordmark.svg`,
  // TODO: add social profile URLs (LinkedIn, Instagram, X, …).
  sameAs: [] as string[],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full bg-[#09090b] text-[#fafafa] antialiased overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
