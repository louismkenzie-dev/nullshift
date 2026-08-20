import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { COOKIE_POLICY } from "@nullshift/content/legal/text";
import { legalConfig } from "@nullshift/content/legal/config";
import { CookieInventoryTable } from "@/components/legal/CookieInventoryTable";
import { T } from "@nullshift/ui/tokens";

export const metadata: Metadata = {
  title: "Cookie and Storage Technologies Policy — Nullshift",
  description: COOKIE_POLICY.summary,
  alternates: { canonical: "/legal/cookies" },
};

export default function Page() {
  return (
    <LegalShell
      title="Cookie and Storage Technologies Policy"
      eyebrow="Cookies"
      active={legalConfig.routes.cookies}
    >
      <LegalDocView doc={COOKIE_POLICY} />
      <CookieInventoryTable />

      {/* The policy has to say where the switch is, and the switch has to be
          one click from the policy. */}
      <div
        className="mt-10"
        style={{ borderTop: "1px solid var(--k-border)", paddingTop: 22 }}
      >
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.7,
            color: "var(--k-muted)",
          }}
        >
          You can change or withdraw your choices at any time — you do not need an
          account, and withdrawing is as easy as consenting.
        </p>
        <Link
          href={legalConfig.routes.cookieSettings}
          className="kb kb-outline kb-sm"
          style={{ display: "inline-flex", marginTop: 14 }}
        >
          Cookie settings
          <span className="k-arrow" aria-hidden>
            →
          </span>
        </Link>
      </div>
    </LegalShell>
  );
}
