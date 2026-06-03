import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Nullshift Studio — Web Design & Development",
  description:
    "Nullshift Studio helps small and medium-sized businesses make the move online — with websites and branding built to last.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${barlowCondensed.variable} dark`}
    >
      <body className="min-h-full bg-[#09090b] text-[#fafafa] antialiased overflow-x-hidden" style={{ fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif" }}>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
