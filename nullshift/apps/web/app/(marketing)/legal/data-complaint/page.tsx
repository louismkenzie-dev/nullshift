import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { T } from "@nullshift/ui/tokens";
import { legalConfig } from "@nullshift/content/legal/config";
import { ComplaintForm } from "./ComplaintForm";

export const metadata: Metadata = {
  title: "Data-protection complaint — Nullshift",
  description:
    "Raise a complaint about how Nullshift has handled personal information. We acknowledge complaints within 30 days and respond without undue delay.",
  alternates: { canonical: "/legal/data-complaint" },
};

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <LegalShell
      title="Make a data-protection complaint"
      eyebrow="Data complaint"
      active={legalConfig.routes.dataComplaint}
    >
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
        If you think we&apos;ve handled personal information wrongly, tell us here. You&apos;ll get
        a case reference immediately, an acknowledgement within 30 days, and the outcome
        when we&apos;ve investigated.
      </p>

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          lineHeight: 1.75,
          color: "var(--k-muted)",
          marginTop: 20,
        }}
      >
        You can also email {legalConfig.contact.privacy} directly. If your complaint is
        about a system we built and run for one of our clients, we usually act as that
        client&apos;s processor — we&apos;ll tell you that and pass it on where appropriate, rather
        than leaving you to work out who is responsible.
      </p>

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          lineHeight: 1.75,
          color: "var(--k-muted)",
          marginTop: 14,
        }}
      >
        You have the right to complain to the UK Information Commissioner&apos;s Office at
        any time — you do not have to come to us first. Their current contact details are
        published at{" "}
        <a
          href="https://ico.org.uk"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--k-accent)" }}
        >
          ico.org.uk
        </a>
        .
      </p>

      <ComplaintForm privacyEmail={legalConfig.contact.privacy} />
    </LegalShell>
  );
}
