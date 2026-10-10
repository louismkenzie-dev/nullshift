import type { LegalBlock, LegalDoc } from "@nullshift/content/legal/text";

/**
 * Renderer for a customer's hosted legal page. Light, neutral, their accent
 * colour on the headings. No Nullshift chrome beyond a one-line footer.
 */
export function HostedDoc({
  doc,
  business,
  version,
  updated,
  colour,
}: {
  doc: LegalDoc;
  business: string;
  version: number;
  updated: string;
  colour: string;
}) {
  return (
    <article
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "0 0 48px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#1d1f24",
        lineHeight: 1.7,
      }}
    >
      <p
        style={{
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: colour,
          fontWeight: 700,
          margin: "0 0 8px",
        }}
      >
        {business}
      </p>
      <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: "0 0 10px" }}>
        {doc.title}
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 18px" }}>
        Version {version} · Last updated {updated}
      </p>
      <p
        style={{
          fontSize: 17,
          color: "#4b5563",
          margin: "0 0 28px",
          paddingLeft: 14,
          borderLeft: `3px solid ${colour}`,
        }}
      >
        {doc.summary}
      </p>
      {doc.sections.map((s) => (
        <section key={s.n} style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: "1.15rem", margin: "0 0 6px" }}>
            <span style={{ color: colour, marginRight: 10 }}>{s.n}.</span>
            {s.heading}
          </h2>
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </section>
      ))}
    </article>
  );
}

function Block({ b }: { b: LegalBlock }) {
  if (b.kind === "p") return <p style={{ margin: "10px 0" }}>{b.text}</p>;
  if (b.kind === "note")
    return (
      <p
        style={{
          margin: "10px 0",
          padding: 12,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          fontSize: 14,
        }}
      >
        {b.text}
      </p>
    );
  if (b.kind === "bullets")
    return (
      <ul style={{ margin: "10px 0", paddingLeft: 22 }}>
        {b.items.map((it, i) => (
          <li key={i} style={{ margin: "4px 0" }}>
            {it}
          </li>
        ))}
      </ul>
    );
  return (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
        <thead>
          <tr>
            {b.head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: 8,
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #e5e7eb",
                    verticalAlign: "top",
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

export function HostedShell({
  children,
  business,
  slug,
  docs,
  colour,
  poweredBy,
}: {
  children: React.ReactNode;
  business: string;
  slug: string;
  docs: { key: string; title: string }[];
  colour: string;
  poweredBy: boolean;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <a
            href={`/l/${slug}`}
            style={{ fontWeight: 700, color: "#111", textDecoration: "none" }}
          >
            {business}
          </a>
          <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
            {docs.map((d) => (
              <a
                key={d.key}
                href={`/l/${slug}/${d.key}`}
                style={{ color: colour, textDecoration: "none" }}
              >
                {d.title}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main style={{ padding: "36px 20px" }}>{children}</main>
      <footer
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 20px 32px",
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          color: "#9ca3af",
        }}
      >
        These documents were generated from information supplied by {business} and are not
        legal advice.
        {poweredBy && (
          <>
            {" "}
            ·{" "}
            <a href="https://nullshift.co.uk/products/legal" style={{ color: "#9ca3af" }}>
              Hosted by Nullshift Legal
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
