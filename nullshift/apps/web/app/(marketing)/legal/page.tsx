import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal/LegalShell";
import { DraftNotice } from "@/components/legal/LegalDocView";
import { T } from "@nullshift/ui/tokens";
import {
  effectiveDateLabel,
  legalConfig,
  statutoryDisclosure,
} from "@nullshift/content/legal/config";

export const metadata: Metadata = {
  title: "Legal Centre — Nullshift",
  description:
    "Nullshift's legal documents in one place: website terms, privacy notice, cookie policy, subprocessor register, acceptable use, AI services and the client services framework.",
  alternates: { canonical: "/legal" },
};

/**
 * Legal Centre index (spec §2). One page listing every controlling document
 * with a plain-English line about what it governs, so a visitor can find the
 * right document without reading four of them first.
 */
const DOCS = [
  {
    href: legalConfig.routes.websiteTerms,
    title: "Website Terms of Use",
    blurb: "Using this website and public demos. Does not govern paid services.",
  },
  {
    href: legalConfig.routes.privacy,
    title: "Privacy Notice",
    blurb: "What personal information we handle as a business, why, and your rights.",
  },
  {
    href: legalConfig.routes.cookies,
    title: "Cookie and Storage Policy",
    blurb: "What we store on your device. Everything optional is off by default.",
  },
  {
    href: legalConfig.routes.subprocessors,
    title: "Subprocessor register",
    blurb: "The service providers we use, what they do and what data they touch.",
  },
  {
    href: legalConfig.routes.acceptableUse,
    title: "Acceptable Use Policy",
    blurb: "What a client system may not be used for.",
  },
  {
    href: legalConfig.routes.ai,
    title: "AI Services Schedule",
    blurb: "How AI features are supplied, their limits, and where humans stay in the loop.",
  },
  {
    href: legalConfig.routes.clientServices,
    title: "Client services framework",
    blurb:
      "The agreement structure behind a paid engagement — MSA, schedules and Order Form.",
  },
  {
    href: legalConfig.routes.dataComplaint,
    title: "Data-protection complaint",
    blurb: "Raise a complaint about how we have handled personal information.",
  },
];

export default function LegalCentre() {
  return (
    <LegalShell
      title="Legal Centre"
      eyebrow="Legal"
      active={legalConfig.routes.centre}
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
        Every document that governs using this website, buying our services, or how we
        handle information — in one place, in full.
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
        Public policies {legalConfig.legal.publicPolicyVersion} · Client agreement{" "}
        {legalConfig.legal.clientAgreementVersion} · Effective {effectiveDateLabel()}
      </p>

      <div
        className="mt-10"
        style={{ borderTop: "1px solid var(--k-border)" }}
      >
        {DOCS.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="k-kard-h"
            style={{
              display: "block",
              padding: "18px 4px",
              borderBottom: "1px solid var(--k-border)",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                fontFamily: T.sans,
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "-0.01em",
                color: "var(--k-fg)",
              }}
            >
              {d.title}
            </span>
            <span
              aria-hidden
              style={{ color: "var(--k-accent)", marginLeft: 8, fontFamily: T.mono }}
            >
              →
            </span>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.88rem",
                lineHeight: 1.6,
                color: "var(--k-muted)",
                marginTop: 4,
              }}
            >
              {d.blurb}
            </p>
          </Link>
        ))}
      </div>

      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.7rem",
          lineHeight: 1.7,
          color: "var(--k-faint)",
          marginTop: 40,
        }}
      >
        {statutoryDisclosure()}
      </p>
    </LegalShell>
  );
}
