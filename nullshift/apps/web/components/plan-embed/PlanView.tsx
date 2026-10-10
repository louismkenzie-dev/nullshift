import type { PartnerPlan } from "@nullshift/agents/partnerPlan";
import type { EmbedBrand } from "@/lib/plan-embed/data";

/** The hosted plan document. Light, print-friendly, the partner's accent. */
export function PlanView({
  plan,
  brand,
  businessName,
  forName,
  poweredBy,
}: {
  plan: PartnerPlan;
  brand: EmbedBrand;
  businessName: string;
  forName: string;
  poweredBy: boolean;
}) {
  const font = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const h2: React.CSSProperties = {
    fontSize: "1.1rem",
    margin: "34px 0 10px",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    color: brand.colour,
  };
  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    background: "#fff",
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        fontFamily: font,
        color: "#1d1f24",
      }}
    >
      <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" style={{ height: 28 }} />
          ) : (
            <span
              style={{
                width: 10,
                height: 24,
                background: brand.colour,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
          )}
          <strong>{brand.name}</strong>
          {brand.website && (
            <a
              href={
                brand.website.startsWith("http")
                  ? brand.website
                  : `https://${brand.website}`
              }
              style={{
                marginLeft: "auto",
                fontSize: 13,
                color: brand.colour,
                textDecoration: "none",
              }}
            >
              {brand.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </header>
      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "40px 20px 64px",
          lineHeight: 1.65,
        }}
      >
        <p
          style={{
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: brand.colour,
            fontWeight: 700,
            margin: 0,
          }}
        >
          Systems plan · {businessName}
        </p>
        <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: "8px 0 14px" }}>
          {plan.headline}
        </h1>
        <p style={{ fontSize: 17, color: "#4b5563", margin: 0 }}>{plan.intro}</p>

        <h2 style={h2}>Where you are</h2>
        <p style={{ margin: 0 }}>{plan.diagnosis}</p>

        <h2 style={h2}>Three priorities</h2>
        <ol
          style={{
            paddingLeft: 0,
            listStyle: "none",
            margin: 0,
            display: "grid",
            gap: 12,
          }}
        >
          {plan.priorities.map((p, i) => (
            <li key={i} style={card}>
              <strong style={{ display: "block", fontSize: 17 }}>
                <span style={{ color: brand.colour, marginRight: 8 }}>{i + 1}.</span>
                {p.title}
              </strong>
              <p style={{ margin: "6px 0", color: "#4b5563" }}>{p.why}</p>
              <p style={{ margin: 0, fontSize: 14 }}>
                <strong>First step:</strong> {p.firstStep}
              </p>
            </li>
          ))}
        </ol>

        <h2 style={h2}>Quick wins</h2>
        <ul
          style={{
            paddingLeft: 0,
            listStyle: "none",
            margin: 0,
            display: "grid",
            gap: 8,
          }}
        >
          {plan.quickWins.map((q, i) => (
            <li
              key={i}
              style={{
                ...card,
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span>
                <strong>{q.title}</strong>
                <br />
                <span style={{ color: "#4b5563", fontSize: 15 }}>{q.detail}</span>
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: brand.colour,
                  whiteSpace: "nowrap",
                  alignSelf: "flex-start",
                  fontWeight: 600,
                }}
              >
                {q.effort}
              </span>
            </li>
          ))}
        </ul>

        <h2 style={h2}>90-day roadmap</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {plan.roadmap.map((r, i) => (
            <div key={i} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <strong>{r.phase}</strong>
                <span style={{ color: "#6b7280", fontSize: 14 }}>{r.timing}</span>
              </div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                {r.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {plan.recommendedServices.length > 0 && (
          <>
            <h2 style={h2}>How {brand.name} can help</h2>
            <ul
              style={{
                paddingLeft: 0,
                listStyle: "none",
                margin: 0,
                display: "grid",
                gap: 8,
              }}
            >
              {plan.recommendedServices.map((s, i) => (
                <li key={i} style={card}>
                  <strong>{s.service}</strong>
                  <p style={{ margin: "4px 0 0", color: "#4b5563" }}>{s.why}</p>
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.risks.length > 0 && (
          <>
            <h2 style={h2}>Honest caveats</h2>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#4b5563" }}>
              {plan.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}

        <div
          style={{
            marginTop: 40,
            padding: 24,
            borderRadius: 8,
            background: brand.colour,
            color: "#fff",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 600 }}>
            {plan.nextStep.pitch}
          </p>
          <p style={{ margin: 0, opacity: 0.9 }}>
            {plan.nextStep.cta}
            {brand.website ? ` — ${brand.website.replace(/^https?:\/\//, "")}` : ""}
          </p>
        </div>
        <p style={{ marginTop: 28, fontSize: 12, color: "#9ca3af" }}>
          Prepared for {forName} by {brand.name}. This plan is based on the answers given
          and is a starting point for a conversation, not a guarantee of results.
          {poweredBy && (
            <>
              {" "}
              ·{" "}
              <a
                href="https://nullshift.co.uk/products/plans"
                style={{ color: "#9ca3af" }}
              >
                Powered by Nullshift
              </a>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
