import { T } from "@nullshift/ui/tokens";
import {
  effectiveDateLabel,
  legalConfig,
  statutoryDisclosure,
} from "@nullshift/content/legal/config";
import type { LegalBlock, LegalDoc } from "@nullshift/content/legal/text";

/**
 * One renderer for every structured legal document, so clause numbering,
 * spacing and table styling are identical across the Legal Centre and can't
 * drift policy by policy.
 *
 * While the pack has no effective date it is a DRAFT: the banner says so
 * plainly rather than letting unreviewed text look like it is in force.
 */

function Block({ b }: { b: LegalBlock }) {
  if (b.kind === "p")
    return (
      <p
        className="mt-4"
        style={{
          fontFamily: T.sans,
          fontSize: "0.9375rem",
          lineHeight: 1.8,
          letterSpacing: "-0.003em",
          color: "var(--k-muted)",
        }}
      >
        {b.text}
      </p>
    );

  if (b.kind === "note")
    return (
      <p
        className="mt-4"
        style={{
          fontFamily: T.mono,
          fontSize: "0.78rem",
          lineHeight: 1.7,
          color: "var(--k-faint)",
          borderLeft: "2px solid var(--k-border)",
          paddingLeft: 12,
        }}
      >
        {b.text}
      </p>
    );

  if (b.kind === "bullets")
    return (
      <ul className="mt-4 flex flex-col gap-2.5">
        {b.items.map((it) => (
          <li
            key={it}
            className="flex gap-3"
            style={{
              fontFamily: T.sans,
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              color: "var(--k-muted)",
            }}
          >
            <span style={{ color: "var(--k-accent)", flexShrink: 0 }}>—</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="mt-5 overflow-x-auto" style={{ border: "1px solid var(--k-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: T.sans }}>
        <thead>
          <tr>
            {b.head.map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "12px 16px",
                  fontFamily: T.mono,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                  background: "var(--k-surface)",
                  borderBottom: "1px solid var(--k-border)",
                  borderRight:
                    i < b.head.length - 1 ? "1px solid var(--k-border)" : "none",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "12px 16px",
                    verticalAlign: "top",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    color: "var(--k-muted)",
                    borderBottom:
                      ri < b.rows.length - 1 ? "1px solid var(--k-border)" : "none",
                    borderRight: ci < r.length - 1 ? "1px solid var(--k-border)" : "none",
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

/** Shown whenever the pack has no solicitor-approved effective date. */
export function DraftNotice() {
  if (legalConfig.legal.effectiveDate) return null;
  return (
    <div
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
        Draft — not yet in force
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
        This text is published for review and is awaiting legal sign-off. It does not yet
        take effect, and no client agreement is being accepted against it.
      </p>
    </div>
  );
}

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <article>
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
        {doc.summary}
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

      {doc.sections.map((s) => (
        <section key={s.n} className="mt-12">
          <h2
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1.25rem",
              letterSpacing: "-0.015em",
              lineHeight: 1.3,
              color: "var(--k-fg)",
            }}
          >
            {s.n}. {s.heading}
          </h2>
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </section>
      ))}

      <p
        style={{
          fontFamily: T.mono,
          fontSize: "0.7rem",
          lineHeight: 1.7,
          color: "var(--k-faint)",
          marginTop: 48,
          paddingTop: 20,
          borderTop: "1px solid var(--k-border)",
        }}
      >
        {statutoryDisclosure()}
      </p>
    </article>
  );
}
