import { T } from "@nullshift/ui/tokens";
import { SUPPORT_BOUNDARY, SUPPORT_EXAMPLES } from "@nullshift/content/pricing";

/**
 * The support boundary — what the monthly fee covers, and what is quoted as a
 * separate fixed-price project. Two columns for the rule, then real requests
 * classified, because the abstract definition only lands once someone sees
 * "add SMS confirmations" sitting on the development side of the line.
 */
export function SupportBoundary() {
  const col = (
    side: typeof SUPPORT_BOUNDARY.included,
    tone: "accent" | "muted",
    mark: string
  ) => (
    <div
      style={{
        borderRight: "1px solid var(--k-border)",
        borderBottom: "1px solid var(--k-border)",
        padding: "clamp(22px,2.4vw,30px)",
      }}
    >
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "0.68rem",
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: tone === "accent" ? "var(--k-accent)" : "var(--k-muted)",
        }}
      >
        {side.title}
      </span>
      <ul
        className="mt-5 flex flex-col gap-3"
        style={{ listStyle: "none", margin: "20px 0 0", padding: 0 }}
      >
        {side.items.map((it) => (
          <li
            key={it}
            className="flex items-start gap-3"
            style={{
              fontFamily: T.sans,
              fontSize: "0.9rem",
              lineHeight: 1.5,
              color: "var(--k-fg)",
            }}
          >
            <span
              aria-hidden
              style={{
                color: tone === "accent" ? "var(--k-accent)" : "var(--k-faint)",
                fontFamily: T.mono,
                fontSize: "0.8rem",
                lineHeight: 1.5,
              }}
            >
              {mark}
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      {/* The one-line test, given the weight it deserves */}
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "clamp(1.05rem,1.7vw,1.3rem)",
          lineHeight: 1.5,
          letterSpacing: "-0.015em",
          color: "var(--k-fg)",
          maxWidth: "62ch",
          margin: 0,
          paddingLeft: 18,
          borderLeft: "2px solid var(--k-accent)",
        }}
      >
        {SUPPORT_BOUNDARY.test}
      </p>

      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{
          marginTop: 36,
          borderTop: "1px solid var(--k-border)",
          borderLeft: "1px solid var(--k-border)",
        }}
      >
        {col(SUPPORT_BOUNDARY.included, "accent", "✓")}
        {col(SUPPORT_BOUNDARY.quoted, "muted", "→")}
      </div>

      {/* Worked examples — the line made concrete */}
      <div style={{ marginTop: 36 }}>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.68rem",
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
          }}
        >
          Real requests, classified
        </span>
        <div style={{ marginTop: 16, borderTop: "1px solid var(--k-border)" }}>
          {SUPPORT_EXAMPLES.map((ex) => (
            <div
              key={ex.request}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
              style={{
                padding: "13px 0",
                borderBottom: "1px solid var(--k-border)",
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: ex.verdict === "support" ? "var(--k-accent)" : "var(--k-faint)",
                  border: `1px solid ${
                    ex.verdict === "support"
                      ? "color-mix(in oklab, var(--k-accent) 45%, transparent)"
                      : "var(--k-border)"
                  }`,
                  padding: "2px 8px",
                  whiteSpace: "nowrap",
                  flex: "0 0 auto",
                  minWidth: 92,
                  textAlign: "center",
                }}
              >
                {ex.verdict === "support" ? "In your plan" : "Quoted"}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                  flex: "1 1 22ch",
                }}
              >
                “{ex.request}”
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.84rem",
                  color: "var(--k-muted)",
                  flex: "1 1 20ch",
                }}
              >
                {ex.why}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
