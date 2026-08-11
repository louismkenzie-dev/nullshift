import { T } from "@nullshift/ui/tokens";
import { BANK_DETAILS } from "@nullshift/content/legalEntity";

/**
 * Bank-transfer payment option shown alongside unpaid invoices — a collapsible
 * KYMA-styled block with the business account details and the client's payment
 * reference. The no-card-fee alternative to the Stripe "Pay now" link; the
 * admin marks the invoice paid from the client hub when the transfer lands.
 */

const label: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.62rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const value: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.82rem",
  letterSpacing: "0.04em",
  color: "var(--k-fg)",
  userSelect: "all",
};

export function BankTransferDetails({
  reference,
  amount,
  only = false,
}: {
  /** Payment reference the client should use (e.g. NS-2E458EB1). */
  reference: string;
  /** Amount due, in £ — shown so the transfer screen can be copied 1:1. */
  amount?: number;
  /**
   * Bank transfer is the ONLY payment route (no card link) — render expanded
   * with direct copy, instead of as a collapsed alternative to "Pay by card".
   */
  only?: boolean;
}) {
  const rows: [string, string][] = [
    ["Account name", BANK_DETAILS.accountName],
    ["Sort code", BANK_DETAILS.sortCode],
    ["Account number", BANK_DETAILS.accountNumber],
    ...(amount !== undefined
      ? ([["Amount", "£" + Math.round(amount).toLocaleString("en-GB")]] as [
          string,
          string,
        ][])
      : []),
    ["Payment reference", reference],
  ];
  return (
    <details
      open={only}
      style={{
        marginTop: 12,
        background: "var(--k-bg)",
        border: only ? "1px solid var(--k-accent)" : "1px solid var(--k-border)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "10px 14px",
          fontFamily: T.mono,
          fontSize: "0.66rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--k-accent)",
        }}
      >
        {only
          ? "Pay by bank transfer — account details"
          : "Prefer a bank transfer? View account details"}
      </summary>
      <div style={{ padding: "4px 14px 14px" }}>
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
            style={{
              padding: "8px 0",
              borderTop: i ? "1px solid var(--k-border)" : "none",
            }}
          >
            <span style={label}>{k}</span>
            <span style={value}>{v}</span>
          </div>
        ))}
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.8rem",
            lineHeight: 1.6,
            color: "var(--k-muted)",
            marginTop: 10,
          }}
        >
          Faster Payments, BACS and CHAPS are all fine. Please include the payment
          reference so we can match your transfer — we&apos;ll mark the invoice paid as
          soon as it arrives (usually the same day).
        </p>
      </div>
    </details>
  );
}
