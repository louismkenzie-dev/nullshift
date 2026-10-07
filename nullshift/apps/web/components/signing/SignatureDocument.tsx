import { T } from "@nullshift/ui/tokens";
import type { Block } from "@/lib/signing/blocks";
import {
  formatMinor,
  hashFingerprint,
  KIND_LABEL,
  type SigningContent,
} from "@/lib/signing/model";
import { dateTimeGB, SIGNATURE_FONT, type SignatureBlock } from "@/lib/signing/format";

/**
 * The document, rendered from its frozen snapshot — the one component the
 * admin preview, the public signing page, the portal page and the completed
 * view all use, so what the signer sees is what staff saw and what the
 * certificate prints.
 *
 * Server component. No interactivity here; the signing form sits below it.
 */

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.64rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.98rem",
  lineHeight: 1.75,
  color: "var(--k-fg)",
  margin: 0,
};
const cell: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.86rem",
  lineHeight: 1.5,
  color: "var(--k-fg)",
  padding: "8px 10px",
  borderBottom: "1px solid var(--k-border)",
  verticalAlign: "top",
  textAlign: "left",
};

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return block.level === 1 ? (
        <h2
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "1.45rem",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            color: "var(--k-fg)",
            margin: "28px 0 10px",
          }}
        >
          {block.text}
        </h2>
      ) : (
        <h3
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "1.02rem",
            letterSpacing: "0.01em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
            margin: "26px 0 8px",
          }}
        >
          {block.text}
        </h3>
      );
    case "paragraph":
      return <p style={{ ...body, margin: "0 0 12px" }}>{block.text}</p>;
    case "callout":
      return (
        <p
          style={{
            ...body,
            margin: "16px 0",
            paddingLeft: 14,
            borderLeft: "2px solid var(--k-accent)",
            color: "var(--k-fg)",
          }}
        >
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul style={{ margin: "0 0 14px", paddingLeft: 20 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ ...body, marginBottom: 4 }}>
              {item}
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div style={{ overflowX: "auto", margin: "8px 0 18px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {block.header.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      ...cell,
                      ...mono,
                      color: "var(--k-faint)",
                      borderBottom: "1px solid var(--k-border-strong)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td
                      key={i}
                      style={{
                        ...cell,
                        color:
                          /^(yes|included)$/i.test(c) ? "var(--k-accent)" : "var(--k-fg)",
                        fontWeight: /^(yes|included)$/i.test(c) ? 600 : 400,
                        whiteSpace: c.length <= 4 ? "nowrap" : "normal",
                      }}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function SignatureSlot({
  party,
  signature,
  placeholder,
}: {
  party: string;
  signature: SignatureBlock;
  placeholder: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <span style={mono}>{party}</span>
      <div
        style={{
          marginTop: 18,
          minHeight: 44,
          borderBottom: "1px solid var(--k-border-strong)",
          display: "flex",
          alignItems: "flex-end",
          paddingBottom: 6,
        }}
      >
        {signature ? (
          <span
            style={{
              fontFamily: SIGNATURE_FONT,
              fontSize: "1.9rem",
              lineHeight: 1,
              color: "var(--k-fg)",
            }}
          >
            {signature.name}
          </span>
        ) : (
          <span style={{ fontFamily: T.sans, fontSize: "0.86rem", color: "var(--k-faint)" }}>
            {placeholder}
          </span>
        )}
      </div>
      {signature && (
        <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-muted)", marginTop: 8, lineHeight: 1.5 }}>
          {signature.name}
          {signature.role ? `, ${signature.role}` : ""}
          <br />
          {dateTimeGB(signature.at)}
        </p>
      )}
    </div>
  );
}

export function SignatureDocument({
  content,
  hash,
  signatures,
  nullshiftName,
}: {
  content: SigningContent;
  hash: string | null;
  signatures: { client: SignatureBlock; nullshift: SignatureBlock };
  nullshiftName: string;
}) {
  const c = content.commercial;
  return (
    <article
      style={{
        background: "var(--k-surface)",
        border: "1px solid var(--k-border)",
        padding: "clamp(22px, 4vw, 44px)",
      }}
    >
      {/* Header: what this is, who it is between */}
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 12,
          paddingBottom: 18,
          borderBottom: "1px solid var(--k-border-strong)",
        }}
      >
        <div>
          <span style={{ ...mono, color: "var(--k-accent)" }}>
            {KIND_LABEL[content.kind]} · {content.reference}
          </span>
          <h1
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: "var(--k-fg)",
              margin: "6px 0 0",
            }}
          >
            {content.title}
          </h1>
        </div>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto auto", gap: "4px 14px", alignContent: "start" }}>
          <dt style={mono}>Between</dt>
          <dd style={{ margin: 0, fontFamily: T.sans, fontSize: "0.86rem", color: "var(--k-fg)" }}>
            {nullshiftName}
          </dd>
          <dt style={mono}>And</dt>
          <dd style={{ margin: 0, fontFamily: T.sans, fontSize: "0.86rem", color: "var(--k-fg)" }}>
            {content.client.name}
          </dd>
          <dt style={mono}>Issued</dt>
          <dd style={{ margin: 0, fontFamily: T.sans, fontSize: "0.86rem", color: "var(--k-fg)" }}>
            {dateTimeGB(content.issuedAt)}
          </dd>
        </dl>
      </header>

      {/* Body */}
      <div style={{ marginTop: 6 }}>
        {content.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>

      {/* Costing */}
      {c.lines.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <span style={mono}>Costing</span>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <tbody>
              {c.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ ...cell, padding: "9px 0" }}>{l.label}</td>
                  <td
                    style={{
                      ...cell,
                      padding: "9px 0",
                      textAlign: "right",
                      fontFamily: T.mono,
                      whiteSpace: "nowrap",
                      color: l.amountMinor < 0 ? "var(--k-accent)" : "var(--k-fg)",
                    }}
                  >
                    {formatMinor(l.amountMinor, c.currency)}
                  </td>
                </tr>
              ))}
              {c.totalMinor !== null && (
                <tr>
                  <td
                    style={{
                      ...cell,
                      padding: "12px 0",
                      borderBottom: "none",
                      borderTop: "1px solid var(--k-border-strong)",
                      fontWeight: 700,
                    }}
                  >
                    Total
                  </td>
                  <td
                    style={{
                      ...cell,
                      padding: "12px 0",
                      borderBottom: "none",
                      borderTop: "1px solid var(--k-border-strong)",
                      textAlign: "right",
                      fontFamily: T.display,
                      fontWeight: 700,
                      fontSize: "1.3rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatMinor(c.totalMinor, c.currency)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {c.note && (
            <p style={{ fontFamily: T.sans, fontSize: "0.86rem", color: "var(--k-muted)", marginTop: 8, lineHeight: 1.6 }}>
              {c.note}
            </p>
          )}
        </section>
      )}

      {/* Agreement wording — part of the hashed document */}
      <section style={{ marginTop: 30, paddingTop: 18, borderTop: "1px solid var(--k-border)" }}>
        <span style={mono}>Agreement</span>
        <div style={{ marginTop: 8 }}>
          {content.agreement.map((p, i) => (
            <p key={i} style={{ ...body, fontSize: "0.9rem", color: "var(--k-muted)", margin: "0 0 10px" }}>
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* Signatures */}
      <section
        style={{
          marginTop: 26,
          paddingTop: 18,
          borderTop: "1px solid var(--k-border-strong)",
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
        }}
      >
        <SignatureSlot
          party={`For ${content.client.name}`}
          signature={signatures.client}
          placeholder={`${content.signer.name}${content.signer.role ? `, ${content.signer.role}` : ""} — awaiting signature`}
        />
        <SignatureSlot
          party={`For ${nullshiftName}`}
          signature={signatures.nullshift}
          placeholder="Countersigned once the client has signed"
        />
      </section>

      <footer style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
        <span style={{ ...mono, color: "var(--k-faint)" }}>Document fingerprint</span>
        <span style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-muted)", letterSpacing: "0.04em" }} title={hash ?? ""}>
          SHA-256 {hashFingerprint(hash)} …
        </span>
      </footer>
    </article>
  );
}
