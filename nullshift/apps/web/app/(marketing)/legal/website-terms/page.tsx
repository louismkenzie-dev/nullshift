import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { WEBSITE_TERMS } from "@nullshift/content/legal/text";
import { legalConfig } from "@nullshift/content/legal/config";

export const metadata: Metadata = {
  title: "Website Terms of Use — Nullshift",
  description: WEBSITE_TERMS.summary,
  alternates: { canonical: "/legal/website-terms" },
};

export default function Page() {
  return (
    <LegalShell title="Website Terms of Use" eyebrow="Website terms" active={legalConfig.routes.websiteTerms}>
      <LegalDocView doc={WEBSITE_TERMS} />
    </LegalShell>
  );
}
