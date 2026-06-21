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
    default: "Nullshift — Websites, Systems & Automations",
    template: "%s — Nullshift",
  },
  description:
    "Nullshift designs, builds and runs bespoke websites, custom systems and the automations behind them — owned outright by your business.",
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
