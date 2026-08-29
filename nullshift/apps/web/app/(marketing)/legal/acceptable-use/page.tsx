import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { ACCEPTABLE_USE } from "@nullshift/content/legal/text";
import { legalConfig } from "@nullshift/content/legal/config";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — Nullshift",
  description: ACCEPTABLE_USE.summary,
  alternates: { canonical: "/legal/acceptable-use" },
};

export default function Page() {
  return (
    <LegalShell title="Acceptable Use Policy" eyebrow="Acceptable use" active={legalConfig.routes.acceptableUse}>
      <LegalDocView doc={ACCEPTABLE_USE} />
    </LegalShell>
  );
}
