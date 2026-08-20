import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { AI_SCHEDULE } from "@nullshift/content/legal/text";
import { legalConfig } from "@nullshift/content/legal/config";

export const metadata: Metadata = {
  title: "AI Services Schedule — Nullshift",
  description: AI_SCHEDULE.summary,
  alternates: { canonical: "/legal/ai" },
};

export default function Page() {
  return (
    <LegalShell title="AI Services Schedule" eyebrow="AI services" active={legalConfig.routes.ai}>
      <LegalDocView doc={AI_SCHEDULE} />
    </LegalShell>
  );
}
