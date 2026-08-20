import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/LegalShell";
import { DraftNotice } from "@/components/legal/LegalDocView";
import { T } from "@nullshift/ui/tokens";
import { effectiveDateLabel, legalConfig } from "@nullshift/content/legal/config";
import { DpaTemplate } from "@/components/legal/DpaTemplate";
import { ServiceTermsTemplate } from "@/components/legal/ServiceTermsTemplate";

export const metadata: Metadata = {
  title: "Client services framework — Nullshift",
  description:
    "The agreement structure behind a paid Nullshift engagement: the Order Form, Master Services Agreement and the schedules it incorporates.",
  alternates: { canonical: "/legal/client-services" },
};

/**
 * The client-facing contract framework (spec §2).
 *
 * The full executed pack for a specific client lives in their portal — that is
 * the copy with their Order Form, their figures and their signature. This page
 * publishes the standard current framework so a prospect can read what they
 * would be signing up to before anyone asks them to sign anything.
 */
export default function Page() {
  const h2: React.CSSProperties = {
    fontFamily: T.display,
    fontWeight: 600,
    fontSize: "1.25rem",
    letterSpacing: "-0.015em",
    color: "var(--k-fg)",
  };
  const p: React.CSSProperties = {
    fontFamily: T.sans,
    fontSize: "0.9375rem",
    lineHeight: 1.8,
    color: "var(--k-muted)",
    marginTop: 16,
  };

  return (
    <LegalShell
      title="Client services framework"
      eyebrow="Client services"
      active={legalConfig.routes.clientServices}
    >
      <DraftNotice />

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "1rem",
          lineHeight: 1.7,
          color: "var(--k-fg)",
          margin: 0,
          paddingLeft: 16,
          borderLeft: "2px solid var(--k-accent)",
        }}
      >
        What a paid engagement is actually made of, and which document governs what.
      </p>
      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.7rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
          marginTop: 16,
        }}
      >
        {legalConfig.legal.clientAgreementVersion} · Effective {effectiveDateLabel()}
      </p>

      <section className="mt-12">
        <h2 style={h2}>Contract architecture</h2>
        <p style={p}>
          An engagement is one agreement made up of the following, in this order of
          priority where they conflict:
        </p>
        <ol
          className="mt-4 flex flex-col gap-2.5"
          style={{ paddingLeft: 20, color: "var(--k-muted)" }}
        >
          {[
            "a signed Change Order, but only for the subject matter of that Change Order;",
            "the Order Form or Statement of Work;",
            "the applicable specialist Schedule;",
            "the Master Services Agreement; and",
            "the Acceptable Use Policy.",
          ].map((t) => (
            <li
              key={t}
              style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.7 }}
            >
              {t}
            </li>
          ))}
        </ol>
        <p style={p}>
          A specialist Schedule does not change another Schedule unless it expressly says
          so. Each Order Form is governed by the version of the agreement identified in
          it — a later website update does not retrospectively amend an agreement you
          have already signed.
        </p>
      </section>

      <section className="mt-14">
        <h2 style={h2}>Your copy</h2>
        <p style={p}>
          If you are already a client, the executed version — your Order Form, your
          figures, the schedules that apply to you and your signature — is in your{" "}
          <Link href="/portal/proposal" style={{ color: "var(--k-accent)" }}>
            client portal
          </Link>
          , together with a downloadable PDF of each document. The text below is the
          standard current framework, published so it can be read before anyone signs
          anything.
        </p>
      </section>

      <section className="mt-14">
        <ServiceTermsTemplate mode="template" />
      </section>

      <section className="mt-16" style={{ borderTop: "1px solid var(--k-border)", paddingTop: 32 }}>
        <DpaTemplate mode="template" />
      </section>
    </LegalShell>
  );
}
