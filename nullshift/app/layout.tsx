import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Nullshift — Web Design & Development",
  description:
    "Nullshift helps small and medium-sized businesses make the move online — with websites and branding built to last.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-full bg-[#09090b] text-[#fafafa] antialiased overflow-x-hidden">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
