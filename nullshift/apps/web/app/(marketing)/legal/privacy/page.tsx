import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { PRIVACY_NOTICE } from "@nullshift/content/legal/text";
import { legalConfig } from "@nullshift/content/legal/config";

export const metadata: Metadata = {
  title: "Privacy Notice — Nullshift",
  description: PRIVACY_NOTICE.summary,
  alternates: { canonical: "/legal/privacy" },
};

export default function Page() {
  return (
    <LegalShell title="Privacy Notice" eyebrow="Privacy" active={legalConfig.routes.privacy}>
      <LegalDocView doc={PRIVACY_NOTICE} />
    </LegalShell>
  );
}
