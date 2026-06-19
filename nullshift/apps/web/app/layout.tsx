import type { Metadata } from "next";
import "@nullshift/ui/styles/fonts.css";
import "./globals.css";

const SITE_URL = "https://nullshift.co.uk";

// Minimal root layout shared by every surface (marketing, /admin, /portal). It
// owns the single <html>/<body>, the fonts, and the global stylesheet — but NOT
// the marketing chrome (smooth-scroll, consent banner, LocalBusiness JSON-LD),
// which lives in app/(marketing)/layout.tsx so it never wraps the internal apps.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nullshift — Web Design & Development",
    template: "%s — Nullshift",
  },
  description:
    "Nullshift helps small and medium-sized businesses make the move online — with websites and branding built to last.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full bg-[#09090b] text-[#fafafa] antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
