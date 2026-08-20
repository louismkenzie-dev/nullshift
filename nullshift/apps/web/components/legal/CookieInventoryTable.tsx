import { T } from "@nullshift/ui/tokens";
import { COOKIE_INVENTORY } from "@nullshift/content/legal/cookies";

/**
 * The live cookie table, generated from the maintained inventory — never hand
 * written, and nothing invented. If the site later sets an analytics or
 * marketing technology, it must be added to the inventory before it ships
 * (the CI rule in legal/cookies.ts), and it appears here automatically.
 */
export function CookieInventoryTable() {
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

  const optional = COOKIE_INVENTORY.filter((c) => c.category !== "necessary");

  return (
    <section className="mt-10">
      <h3
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.05rem",
          letterSpacing: "-0.015em",
          color: "var(--k-fg)",
        }}
      >
        What we currently store
      </h3>

      <div
        className="mt-5 overflow-x-auto"
        style={{ border: "1px solid var(--k-border)" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>Name / pattern</th>
              <th style={th}>Provider</th>
              <th style={th}>Purpose</th>
              <th style={th}>Category</th>
              <th style={th}>Party</th>
              <th style={th}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {COOKIE_INVENTORY.map((c) => (
              <tr key={c.nameOrPattern}>
                <td style={{ ...td, fontFamily: T.mono, fontSize: "0.76rem" }}>
                  {c.nameOrPattern}
                </td>
                <td style={td}>{c.provider}</td>
                <td style={td}>{c.purpose}</td>
                <td style={{ ...td, textTransform: "capitalize" }}>{c.category}</td>
                <td style={td}>{c.firstOrThirdParty === "first" ? "First" : "Third"}</td>
                <td style={td}>{c.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className="mt-5"
        style={{
          fontFamily: T.sans,
          fontSize: "0.88rem",
          lineHeight: 1.7,
          color: "var(--k-muted)",
        }}
      >
        {optional.length === 0
          ? "We currently set no analytics, advertising or cross-site tracking technologies. Everything listed above is strictly necessary to run the site and the accounts on it — which is why there is nothing here to opt out of."
          : "Optional technologies are listed above and stay off until you choose otherwise."}
      </p>
    </section>
  );
}
