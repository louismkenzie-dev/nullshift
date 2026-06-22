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
            fontWeight: 500,
            color: "var(--k-accent)",
            border: "1px solid var(--k-border-strong)",
            borderRadius: 0,
            padding: "2px 7px",
          }}
        >
          {n}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
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
  dpaRequired,
}: {
  reference: string;
  clientName: string;
  businessName?: string | null;
  date: string;
  overview: string | null;
  items: { name: string; amount: number }[];
  total: number;
  carePlan: {
    label: string;
    mrr: number;
    blurb?: string | null;
    features?: string[] | null;
  } | null;
  paymentTerms: string | null;
  accepted: { name: string; at: string } | null;
  /** true = limited company (full DPA below), false = sole trader (terms only),
   *  null/undefined = business type not yet declared. */
  dpaRequired?: boolean | null;
}) {
  // Sequential section numbers — the overview number is skipped when there's no
  // overview, so adding sections never desyncs the numbering.
  let _sec = 0;
  const sec = () => String(++_sec).padStart(2, "0");
  const phases: { title: string; detail: string }[] = [
    {
      title: "Discovery & scope",
      detail: "We confirm requirements, your data model and what success looks like.",
    },
    {
      title: "Design",
      detail: "Screens and flows for the modules above, shared with you for sign-off.",
    },
    {
      title: "Build",
      detail:
        "We develop the modules in iterative milestones you can follow in your portal.",
    },
    {
      title: "Review & QA",
      detail: "Testing, accessibility and your review before anything goes live.",
    },
    {
      title: "Launch",
      detail:
        "We deploy to your domain — you own the code and the infrastructure outright.",
    },
    {
      title: "Care & iterate",
      detail: "Ongoing support and improvements under your care plan.",
    },
  ];
  return (
    <div
      className="k-kard"
      style={{
        background: "var(--k-surface)",
        padding: "26px 24px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between flex-wrap gap-3"
        style={{ paddingBottom: 18, borderBottom: "1px solid var(--k-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <LogoMark size={24} />
          <span
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "1.05rem",
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
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
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--k-accent)",
            }}
          >
            Proposal
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: "var(--k-fg)" }}>
            {reference}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--k-faint)",
          }}
        >
          Prepared for
        </div>
        <div
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "1.5rem",
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
            marginTop: 4,
            lineHeight: 1.06,
          }}
        >
          {businessName || clientName}
        </div>
        <div style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-muted)" }}>
          {date}
        </div>
      </div>

      {overview && (
        <Section n={sec()} title="Overview">
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.95rem",
              lineHeight: 1.7,
              color: "var(--k-muted)",
              whiteSpace: "pre-wrap",
            }}
          >
            {overview}
          </p>
        </Section>
      )}

      <Section n={sec()} title="What we'll build & you'll own">
        <div className="flex flex-col">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex items-center justify-between"
              style={{ padding: "10px 0", borderTop: "1px solid var(--k-border)" }}
            >
              <span
                style={{ fontFamily: T.sans, fontSize: "0.92rem", color: "var(--k-fg)" }}
              >
                {it.name}
              </span>
              <span
                style={{ fontFamily: T.mono, fontSize: "0.88rem", color: "var(--k-fg)" }}
              >
                {gbp(Number(it.amount))}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              Build modules will be listed here.
            </p>
          )}
        </div>
      </Section>

      <Section n={sec()} title="How we'll build it">
        <div className="flex flex-col" style={{ gap: 2 }}>
          {phases.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-3"
              style={{ padding: "10px 0", borderTop: "1px solid var(--k-border)" }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--k-accent)",
                  paddingTop: 2,
                  minWidth: 22,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 600,
                    fontSize: "0.92rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.84rem",
                    color: "var(--k-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  {p.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={sec()} title="Investment">
        <div
          className="flex items-center justify-between"
          style={{ padding: "12px 0", borderTop: "1px solid var(--k-border)" }}
        >
          <span style={{ fontFamily: T.sans, fontWeight: 600, color: "var(--k-fg)" }}>
            One-off build (you own it)
          </span>
          <span
            style={{
              fontFamily: T.sans,
              fontWeight: 800,
              fontSize: "1.6rem",
              letterSpacing: "-0.03em",
              color: "var(--k-fg)",
            }}
          >
            {gbp(total)}
          </span>
        </div>
        {carePlan && (
          <div
            className="flex items-center justify-between"
            style={{ padding: "12px 0", borderTop: "1px solid var(--k-border)" }}
          >
            <span style={{ fontFamily: T.sans, fontWeight: 600, color: "var(--k-fg)" }}>
              Ongoing care · {carePlan.label}
            </span>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.95rem",
                color: "var(--k-accent)",
              }}
            >
              {gbp(carePlan.mrr)}/mo
            </span>
          </div>
        )}
      </Section>

      {carePlan && (carePlan.blurb || (carePlan.features?.length ?? 0) > 0) && (
        <Section n={sec()} title="Your care plan">
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span
              style={{
                fontFamily: T.sans,
                fontWeight: 600,
                fontSize: "0.95rem",
                color: "var(--k-fg)",
              }}
            >
              {carePlan.label}
            </span>
            <span
              style={{ fontFamily: T.mono, fontSize: "0.9rem", color: "var(--k-accent)" }}
            >
              {gbp(carePlan.mrr)}/mo
            </span>
          </div>
          {carePlan.blurb && (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.88rem",
                color: "var(--k-muted)",
                lineHeight: 1.6,
                marginBottom: 10,
              }}
            >
              {carePlan.blurb}
            </p>
          )}
          {carePlan.features && carePlan.features.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {carePlan.features.map((f, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "5px 0",
                  }}
                >
                  <span style={{ color: "var(--k-accent)", lineHeight: 1.5 }} aria-hidden>
                    ▸
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      color: "var(--k-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p
            style={{
              fontFamily: T.mono,
              fontSize: 10.5,
              letterSpacing: "0.06em",
              color: "var(--k-faint)",
              marginTop: 10,
            }}
          >
            Billed monthly · cancel any time · no lock-in.
          </p>
        </Section>
      )}

      <Section n={sec()} title="Payment terms">
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.7,
            color: "var(--k-muted)",
            whiteSpace: "pre-wrap",
          }}
        >
          {paymentTerms || DEFAULT_PAYMENT_TERMS}
        </p>
      </Section>

      <Section
        n={sec()}
        title={dpaRequired === false ? "Data processing" : "Data Processing Agreement"}
      >
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.7,
            color: "var(--k-muted)",
          }}
        >
          {dpaRequired === true
            ? "As a limited company, a Data Processing Agreement (UK GDPR) forms part of this proposal and is shown in full below. Signing also accepts the DPA so we can lawfully process data on your behalf and take your project live."
            : dpaRequired === false
              ? "Our standard data-processing terms (UK GDPR) apply to this engagement. As a sole trader / non-limited entity, a separate Data Processing Agreement isn't required — signing this proposal accepts these terms."
              : "Before signing you'll confirm your business type. Limited companies also sign a Data Processing Agreement (UK GDPR); sole traders accept our standard data-processing terms with the proposal."}
        </p>
      </Section>

      {accepted && (
        <div
          style={{
            marginTop: 24,
            padding: "12px 14px",
            background: "rgba(16,185,129,0.12)",
            borderLeft: "2px solid var(--k-accent)",
            border: "1px solid var(--k-border)",
            borderLeftWidth: 2,
            borderLeftColor: "var(--k-accent)",
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--k-fg)",
          }}
        >
          ✓ Accepted &amp; signed by {accepted.name} —{" "}
          {new Date(accepted.at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
        </div>
      )}
    </div>
  );
}
