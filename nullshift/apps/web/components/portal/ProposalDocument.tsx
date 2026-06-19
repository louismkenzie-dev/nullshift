import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";

/**
 * Branded, auto-composed proposal document — the formal document the client reads
 * and signs in their portal. Built from the build modules + care plan + a light
 * admin-authored overview + payment terms. Presentational (no hooks), so it renders
 * in the portal and could be reused on a print page. Mirrors the look of the old
 * /proposal/[id] document.
 */
export const DEFAULT_PAYMENT_TERMS =
  "50% deposit on acceptance, 50% on completion. Invoices are payable within 14 days.";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 28 }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            fontWeight: 600,
            color: T.primary,
            border: `1px solid ${T.primary}55`,
            borderRadius: 6,
            padding: "2px 7px",
          }}
        >
          {n}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

export function ProposalDocument({
  reference,
  clientName,
  businessName,
  date,
  overview,
  items,
  total,
  carePlan,
  paymentTerms,
  accepted,
}: {
  reference: string;
  clientName: string;
  businessName?: string | null;
  date: string;
  overview: string | null;
  items: { name: string; amount: number }[];
  total: number;
  carePlan: { label: string; mrr: number } | null;
  paymentTerms: string | null;
  accepted: { name: string; at: string } | null;
}) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.lg,
        padding: "26px 24px",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <LogoMark size={24} />
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1.05rem",
              color: T.fg,
            }}
          >
            Nullshift
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            Proposal
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.fg }}>{reference}</div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.faint,
          }}
        >
          Prepared for
        </div>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "1.35rem",
            color: T.fg,
            marginTop: 2,
          }}
        >
          {businessName || clientName}
        </div>
        <div style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
          {date}
        </div>
      </div>

      {overview && (
        <Section n="01" title="Overview">
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.95rem",
              lineHeight: 1.7,
              color: T.muted,
              whiteSpace: "pre-wrap",
            }}
          >
            {overview}
          </p>
        </Section>
      )}

      <Section n={overview ? "02" : "01"} title="What we'll build & you'll own">
        <div className="flex flex-col">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex items-center justify-between"
              style={{ padding: "9px 0", borderTop: `1px solid ${T.border}` }}
            >
              <span style={{ fontFamily: T.sans, fontSize: "0.92rem", color: T.fg }}>
                {it.name}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "0.88rem", color: T.muted }}>
                {gbp(Number(it.amount))}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
              Build modules will be listed here.
            </p>
          )}
        </div>
      </Section>

      <Section n={overview ? "03" : "02"} title="Investment">
        <div
          className="flex items-center justify-between"
          style={{ padding: "12px 0", borderTop: `1px solid ${T.border}` }}
        >
          <span style={{ fontFamily: T.sans, fontWeight: 600, color: T.fg }}>
            One-off build (you own it)
          </span>
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.4rem",
              color: T.fg,
            }}
          >
            {gbp(total)}
          </span>
        </div>
        {carePlan && (
          <div
            className="flex items-center justify-between"
            style={{ padding: "12px 0", borderTop: `1px solid ${T.border}` }}
          >
            <span style={{ fontFamily: T.sans, fontWeight: 600, color: T.fg }}>
              Ongoing care · {carePlan.label}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: "0.95rem", color: T.primary }}>
              {gbp(carePlan.mrr)}/mo
            </span>
          </div>
        )}
      </Section>

      <Section n={overview ? "04" : "03"} title="Payment terms">
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.7,
            color: T.muted,
            whiteSpace: "pre-wrap",
          }}
        >
          {paymentTerms || DEFAULT_PAYMENT_TERMS}
        </p>
      </Section>

      <Section n={overview ? "05" : "04"} title="Data Processing Agreement">
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.7,
            color: T.muted,
          }}
        >
          A Data Processing Agreement (UK GDPR) forms part of this proposal and is shown
          in full below. Signing this proposal also accepts the DPA so we can lawfully
          process data on your behalf and take your project live.
        </p>
      </Section>

      {accepted && (
        <div
          style={{
            marginTop: 24,
            padding: "12px 14px",
            background: `${T.primary}14`,
            border: `1px solid ${T.primary}`,
            borderRadius: T.r.md,
            fontFamily: T.mono,
            fontSize: 11,
            color: T.fg,
          }}
        >
          ✓ Accepted &amp; signed by {accepted.name} —{" "}
          {new Date(accepted.at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
        </div>
      )}
    </div>
  );
}
