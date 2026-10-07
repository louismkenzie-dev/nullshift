/**
 * Presentation helpers shared by the server pages, the client-side signing
 * form and the PDF. Pure, so it is safe in a Client Component bundle —
 * anything that touches `next/headers` or the database lives in data.ts.
 */

export type SignatureBlock = {
  name: string;
  role: string | null;
  email: string | null;
  at: string;
} | null;

/** The adopted-signature face. System script fonts, no download, no flash. */
export const SIGNATURE_FONT =
  '"Snell Roundhand", "Apple Chancery", "Brush Script MT", "Segoe Script", "URW Chancery L", cursive';

export const dateTimeGB = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
        timeZoneName: "short",
      })
    : "—";

export const dateGB = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London",
      })
    : "—";
