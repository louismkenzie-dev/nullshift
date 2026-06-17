import type { Metadata } from "next";
import "@nullshift/ui/styles/fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nullshift — Ops Hub",
  description: "Internal operations hub for Nullshift staff.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-full bg-[#09090b] text-[#fafafa] antialiased">
        {children}
      </body>
    </html>
  );
}
