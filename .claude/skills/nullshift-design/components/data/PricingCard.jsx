import React from "react";

/**
 * Pricing card — a plan tier with mono tier name, large display price,
 * benefit checklist, and a CTA. `highlighted` promotes the featured plan with
 * an emerald edge, top accent line, and a "Most popular" badge.
 */
export function PricingCard({
  tier,
  price,
  bestFor,
  benefits = [],
  cta = "Book a call",
  href = "#",
  highlighted = false,
  className = "",
  style = {},
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${highlighted ? "color-mix(in oklab, var(--primary) 60%, transparent)" : "var(--border)"}`,
        background: highlighted
          ? "linear-gradient(145deg, color-mix(in oklab, var(--primary) 7%, var(--surface)), var(--surface))"
          : "linear-gradient(145deg, var(--surface), var(--bg))",
        boxShadow: highlighted ? "0 0 0 1px var(--primary-soft), var(--shadow-md)" : "var(--shadow-md)",
        padding: 28,
        ...style,
      }}
    >
      {highlighted && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--primary)", boxShadow: "0 0 12px var(--primary)" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 24, marginBottom: 24, borderBottom: `1px solid ${highlighted ? "color-mix(in oklab, var(--primary) 25%, transparent)" : "var(--border)"}` }}>
        {highlighted && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: "var(--radius-full)", marginBottom: 16, fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary)", background: "color-mix(in oklab, var(--primary) 15%, transparent)", border: "1px solid color-mix(in oklab, var(--primary) 35%, transparent)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", background: "var(--primary)", boxShadow: "0 0 4px var(--primary)" }} />
            Most popular
          </span>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: highlighted ? "var(--primary)" : "var(--muted)", marginBottom: 14 }}>{tier}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "2.5rem", lineHeight: 1, letterSpacing: "var(--tracking-display)", color: highlighted ? "var(--primary)" : "var(--fg)", marginBottom: 10 }}>{price}</span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", lineHeight: 1.55, color: "var(--muted)", textAlign: "center" }}>{bestFor}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, marginBottom: 28 }}>
        {benefits.map((b, i) => {
          const checked = typeof b === "string" ? true : b.checked;
          const text = typeof b === "string" ? b : b.text;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "grid", placeContent: "center", width: 16, height: 16, borderRadius: "var(--radius-full)", flexShrink: 0, background: checked ? "color-mix(in oklab, var(--primary) 22%, transparent)" : "var(--elevated)", border: `1px solid ${checked ? "color-mix(in oklab, var(--primary) 55%, transparent)" : "var(--border)"}`, color: checked ? "var(--primary)" : "var(--muted)", fontSize: 9, fontFamily: "var(--font-mono)" }}>
                {checked ? "✓" : "✕"}
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: checked ? "var(--fg)" : "var(--muted)" }}>{text}</span>
            </div>
          );
        })}
      </div>
      <a
        href={href}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", height: 44,
          fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)", fontWeight: 600, letterSpacing: "0.06em",
          borderRadius: "var(--radius-md)",
          background: highlighted ? "var(--primary)" : "transparent",
          color: highlighted ? "var(--primary-fg)" : "var(--fg)",
          border: highlighted ? "none" : "1px solid var(--border)",
          boxShadow: highlighted ? "var(--glow-primary)" : "none",
          textDecoration: "none",
        }}
      >
        <span>{cta}</span>
        <span>→</span>
      </a>
    </div>
  );
}
