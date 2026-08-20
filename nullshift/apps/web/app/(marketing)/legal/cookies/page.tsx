import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { COOKIE_POLICY } from "@nullshift/content/legal/text";
import { legalConfig } from "@nullshift/content/legal/config";
import { CookieInventoryTable } from "@/components/legal/CookieInventoryTable";

export const metadata: Metadata = {
  title: "Cookie and Storage Technologies Policy — Nullshift",
  description: COOKIE_POLICY.summary,
  alternates: { canonical: "/legal/cookies" },
};

export default function Page() {
  return (
    <LegalShell title="Cookie and Storage Technologies Policy" eyebrow="Cookies" active={legalConfig.routes.cookies}>
      <LegalDocView doc={COOKIE_POLICY} />
      <CookieInventoryTable />
    </LegalShell>
  );
}
