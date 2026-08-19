import { T } from "@nullshift/ui/tokens";

/**
 * A contract the client is about to be bound by, presented so they can
 * actually read it first: a titled panel with a one-line plain-English blurb,
 * a "download PDF" link, and the full document behind a disclosure while the
 * proposal is pending. Once signed the document renders open — it's a record
 * at that point, not something to expand.
 *
 * Every document the signature covers uses this, so nothing the client signs
 * is harder to find than the proposal itself.
 */
export function Contract({
  id,
  title,
  summary,
  blurb,
  href,
  accepted,
  children,
}: {
  id: string;
  title: string;
  /** The disclosure label while pending. */
  summary: string;
  /** One line, plain English: what this document is for. */
  blurb: string;
  /** PDF download. */
  href: string;
  accepted: boolean;
  children: React.ReactNode;
}) {
  const download = (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        fontFamily: T.mono,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--k-accent)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      Download PDF ↓
    </a>
  );

  if (accepted) {
    return (
      <div id={id} style={{ marginTop: 12 }}>
        <div
          className="flex items-center justify-between gap-3 flex-wrap"
          style={{ marginBottom: 8 }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-muted)",
            }}
          >
            {title} · signed
          </span>
          {download}
        </div>
        {children}
      </div>
    );
  }

  return (
    <details
      id={id}
      className="k-kard"
      style={{ marginTop: 12, background: "var(--k-surface)", padding: "14px 18px" }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontFamily: T.sans,
          fontWeight: 700,
          fontSize: "0.95rem",
          textTransform: "uppercase",
          letterSpacing: "-0.01em",
          color: "var(--k-fg)",
        }}
      >
        {summary}
      </summary>
      <div
        className="flex items-start justify-between gap-4 flex-wrap"
        style={{ marginTop: 10 }}
      >
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.85rem",
            lineHeight: 1.6,
            color: "var(--k-muted)",
            flex: "1 1 32ch",
            margin: 0,
          }}
        >
          {blurb}
        </p>
        {download}
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </details>
  );
}
