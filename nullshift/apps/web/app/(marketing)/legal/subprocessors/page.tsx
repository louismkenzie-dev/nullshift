import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { DraftNotice } from "@/components/legal/LegalDocView";
import { T } from "@nullshift/ui/tokens";
import { legalConfig, effectiveDateLabel } from "@nullshift/content/legal/config";
import {
  activeSubprocessors,
  hasUnverifiedSubprocessors,
  SUBPROCESSOR_NOTICE,
} from "@nullshift/content/legal/subprocessors";

export const metadata: Metadata = {
  title: "Subprocessors — Nullshift",
  description:
    "The material service providers Nullshift uses to deliver its services, what each one does, and the data categories involved.",
  alternates: { canonical: "/legal/subprocessors" },
};

/**
 * The public subprocessor register (spec §12), rendered from the one
 * authoritative list. Entries whose legal name, location or transfer mechanism
 * have not yet been confirmed are shown as "to verify" rather than guessed —
 * publishing an invented supplier detail is worse than admitting the gap.
 */
export default function Page() {
  const rows = activeSubprocessors();
  const unverified = hasUnverifiedSubprocessors();

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "12px 14px",
    fontFamily: T.mono,
    fontSize: "0.66rem",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--k-muted)",
    background: "var(--k-surface)",
    borderBottom: "1px solid var(--k-border)",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "12px 14px",
    verticalAlign: "top",
    fontFamily: T.sans,
    fontSize: "0.84rem",
    lineHeight: 1.6,
    color: "var(--k-muted)",
    borderBottom: "1px solid var(--k-border)",
  };

  return (
    <LegalShell
      title="Subprocessor register"
      eyebrow="Subprocessors"
      active={legalConfig.routes.subprocessors}
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
        The material service providers we use to run client systems, what each one is
        for, and what data it touches.
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
        Version {legalConfig.legal.publicPolicyVersion} · Effective {effectiveDateLabel()}
      </p>

      {unverified && (
        <div
          className="mt-8"
          style={{
            border: `1px solid ${T.warning}55`,
            background: "color-mix(in oklab, " + T.warning + " 10%, transparent)",
            padding: "14px 18px",
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
            Verification in progress
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
            Some entries are marked “to verify”. We publish the supplier and its purpose,
            and confirm the registered legal name, processing location and transfer
            mechanism against the actual contract before stating them here.
          </p>
        </div>
      )}

      <div
        className="mt-8 overflow-x-auto"
        style={{ border: "1px solid var(--k-border)" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead>
            <tr>
              <th style={th}>Provider</th>
              <th style={th}>Purpose</th>
              <th style={th}>Data categories</th>
              <th style={th}>Processing location</th>
              <th style={th}>Applies to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td style={td}>
                  <span style={{ color: "var(--k-fg)", fontWeight: 600 }}>
                    {s.tradingName}
                  </span>
                  <br />
                  <span style={{ fontFamily: T.mono, fontSize: "0.7rem" }}>
                    {s.legalName ?? "legal name to verify"}
                  </span>
                </td>
                <td style={td}>{s.purpose}</td>
                <td style={td}>{s.dataCategories.join("; ")}</td>
                <td style={td}>
                  {s.processingCountries.includes("VERIFY")
                    ? "To verify"
                    : s.processingCountries.join(", ")}
                  {s.transferMechanism ? ` · ${s.transferMechanism}` : ""}
                </td>
                <td style={{ ...td, textTransform: "capitalize" }}>
                  {s.appliesTo.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className="mt-6"
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          lineHeight: 1.75,
          color: "var(--k-muted)",
        }}
      >
        {SUBPROCESSOR_NOTICE.statement}
      </p>
    </LegalShell>
  );
}
