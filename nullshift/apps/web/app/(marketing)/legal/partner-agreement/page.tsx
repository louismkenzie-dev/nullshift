import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalDocView } from "@/components/legal/LegalDocView";
import { T } from "@nullshift/ui/tokens";
import { legalConfig } from "@nullshift/content/legal/config";
import {
  PARTNER_AGREEMENT,
  PARTNER_AGREEMENT_STATUS,
  PARTNER_AGREEMENT_VERSION,
} from "@nullshift/content/legal/partnerAgreement";

export const metadata: Metadata = {
  title: "Partner Programme Agreement — Nullshift",
  description: PARTNER_AGREEMENT.summary,
  alternates: { canonical: legalConfig.routes.partnerAgreement },
};

/**
 * The partner agreement is versioned on its own line, separate from the
 * client pack: it was drafted in-house on 2026-10-09 and has not been through
 * solicitor review, so it carries its own draft banner regardless of whether
 * the client pack has an effective date.
 */
function SolicitorReviewNotice() {
  if (PARTNER_AGREEMENT_STATUS !== "draft") return null;
  return (
    <div
      role="note"
      style={{
        border: `1px solid ${T.warning}55`,
        background: "color-mix(in oklab, " + T.warning + " 10%, transparent)",
        padding: "14px 18px",
        marginBottom: 28,
      }}
    >
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "0.68rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.warning,
        }}
      >
        Draft for solicitor review
      </span>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.88rem",
          lineHeight: 1.65,
          color: "var(--k-muted)",
          marginTop: 8,
        }}
      >
        This is the plain-English draft of the agreement partners will sign. It is
        published so applicants can read the terms before applying, and is awaiting legal
        sign-off. No partner is bound by it until we send the reviewed version with your
        acceptance confirmation.
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <LegalShell
      title="Partner Programme Agreement"
      eyebrow="Partners"
      active={legalConfig.routes.partnerAgreement}
    >
      <LegalDocView
        doc={PARTNER_AGREEMENT}
        notice={<SolicitorReviewNotice />}
        versionLine={`Version ${PARTNER_AGREEMENT_VERSION} · ${
          PARTNER_AGREEMENT_STATUS === "draft" ? "Draft — not yet in force" : "In force"
        }`}
      />
    </LegalShell>
  );
}
