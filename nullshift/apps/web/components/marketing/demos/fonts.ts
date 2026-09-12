import {
  Oswald,
  Inter,
  Archivo,
  Hanken_Grotesk,
  Cormorant_Garamond,
  DM_Sans,
} from "next/font/google";

/* The clients' own typefaces, self-hosted by next/font so the demos look
 * like the real products without a single request leaving nullshift.co.uk.
 * Each demo wraps itself in the matching `variable` class names. */

/** The Dance Exclusive — Oswald display, Inter body (their index.css). */
export const tdeDisplay = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--demo-tde-display",
  display: "swap",
});
export const tdeBody = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--demo-tde-body",
  display: "swap",
});

/** Suffolk Tennis LTA — Archivo headings, Hanken Grotesk body (their index.css). */
export const suffolkDisplay = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--demo-suffolk-display",
  display: "swap",
});
export const suffolkBody = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--demo-suffolk-body",
  display: "swap",
});

/** NewFuture Therapy — Cormorant Garamond serif voice, DM Sans body. */
export const nftSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--demo-nft-serif",
  display: "swap",
});
export const nftBody = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--demo-nft-body",
  display: "swap",
});
