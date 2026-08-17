import type { Metadata, Viewport } from "next";
import { NoZoom } from "@/components/NoZoom";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NullShift",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Stops iOS Safari auto-zooming the page when a form field gains focus, so
  // the app stays at a fixed scale like a native app. Pinch-zoom still works
  // (iOS ≥10 ignores the cap for user gestures), so accessibility is intact —
  // belt-and-braces with the ≥16px form-control font rule in the body below.
  maximumScale: 1,
  themeColor: "#0a0a0a",
  // Edge-to-edge on notched iPhones when launched from the home screen.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full bg-[#09090b] text-[#fafafa] antialiased overflow-x-hidden">
        {/* App-like fixed scale on touch devices — three iOS zoom behaviours,
            three locks:
            1. Focus zoom: any control under 16px triggers it → force ≥16px
               (stylesheet !important beats components' inline styles).
            2. Pinch + double-tap zoom: Safari IGNORES the viewport maximumScale
               for these, but honours touch-action — html/body allowing only
               panning blocks zoom gestures everywhere (descendants can't
               re-enable a gesture an ancestor forbids).
            3. Legacy gesture events: belt-and-braces in NoZoom below.
            Plus app-feel details: no tap-highlight flash, no font inflation on
            rotation. Desktop is untouched. */}
        <style>{`
          html { -webkit-text-size-adjust: 100%; }
          @media (max-width: 767px), (pointer: coarse) {
            input, select, textarea { font-size: 16px !important; }
          }
          @media (pointer: coarse) {
            html, body { touch-action: pan-x pan-y; }
            * { -webkit-tap-highlight-color: transparent; }
          }
        `}</style>
        <NoZoom />
        {children}
      </body>
    </html>
  );
}
