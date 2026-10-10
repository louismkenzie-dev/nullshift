"use client";

import { useEffect, useRef, useState } from "react";
import type { EmbedBrand } from "@/lib/plan-embed/data";

const TEAM = ["Just me", "2–5 people", "6–15 people", "16–50 people", "50+ people"];
const BOTTLENECKS = [
  "Admin and paperwork",
  "Chasing leads and quotes",
  "Scheduling and bookings",
  "Invoicing and getting paid",
  "Customer communication",
  "Reporting and knowing the numbers",
  "Something else",
];
const BUDGET = [
  "Just exploring",
  "A few hundred pounds",
  "£1,000–£5,000",
  "£5,000–£20,000",
  "More, if it pays back",
];

/**
 * Six questions, then a plan. Inline styles because it renders inside other
 * people's websites via iframe. `preview` disables submission.
 */
export function PlanQuestionnaire({
  brand,
  intro,
  publicKey,
  poweredBy,
  preview = false,
  embedded = false,
  sourceUrl,
}: {
  brand: EmbedBrand;
  intro: string | null;
  publicKey: string;
  poweredBy: boolean;
  preview?: boolean;
  embedded?: boolean;
  sourceUrl?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState({
    businessName: "",
    sector: "",
    teamSize: "",
    bottleneck: "",
    bottleneckDetail: "",
    tools: "",
    goal: "",
    budget: "",
  });
  const [c, setC] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"form" | "generating" | "ready" | "failed">("form");
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !embedded ||
      typeof window === "undefined" ||
      window.parent === window ||
      !rootRef.current
    )
      return;
    const el = rootRef.current;
    const post = () =>
      window.parent.postMessage(
        { type: "ns-plan-size", key: publicKey, height: el.offsetHeight },
        "*"
      );
    post();
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded, publicKey, step, phase]);

  const dark = brand.dark;
  const k = {
    bg: dark ? "#0f1115" : "#fff",
    fg: dark ? "#f3f4f6" : "#111318",
    muted: dark ? "#9aa0ae" : "#5c6170",
    border: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    surface: dark ? "#161920" : "#f6f7f9",
    accent: brand.colour,
  };
  const font = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const label: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: k.muted,
    fontWeight: 600,
  };
  const input: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 6,
    border: `1px solid ${k.border}`,
    background: k.surface,
    color: k.fg,
    fontFamily: font,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  };
  const btn: React.CSSProperties = {
    height: 46,
    padding: "0 20px",
    borderRadius: 6,
    border: "none",
    background: k.accent,
    color: "#fff",
    fontFamily: font,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  };
  const ghost: React.CSSProperties = {
    ...btn,
    background: "transparent",
    color: k.muted,
    border: `1px solid ${k.border}`,
  };
  const chip = (on: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 6,
    border: `1px solid ${on ? k.accent : k.border}`,
    background: on ? `${k.accent}1f` : k.surface,
    color: k.fg,
    fontFamily: font,
    fontSize: 14,
    cursor: "pointer",
    textAlign: "left",
  });

  const steps = [
    {
      ok: a.businessName.trim().length > 1 && a.sector.trim().length > 1,
      body: (
        <>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>Your business name</span>
            <input
              style={input}
              value={a.businessName}
              onChange={(e) => setA({ ...a, businessName: e.target.value })}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>What do you do?</span>
            <input
              style={input}
              placeholder="e.g. independent dental practice, electrical contractor"
              value={a.sector}
              onChange={(e) => setA({ ...a, sector: e.target.value })}
            />
          </label>
        </>
      ),
    },
    {
      ok: !!a.teamSize,
      body: (
        <>
          <span style={label}>How big is the team?</span>
          <div style={{ display: "grid", gap: 6 }}>
            {TEAM.map((t) => (
              <button
                key={t}
                type="button"
                style={chip(a.teamSize === t)}
                onClick={() => setA({ ...a, teamSize: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      ok: !!a.bottleneck && a.bottleneckDetail.trim().length > 5,
      body: (
        <>
          <span style={label}>Where does the week disappear?</span>
          <div style={{ display: "grid", gap: 6 }}>
            {BOTTLENECKS.map((t) => (
              <button
                key={t}
                type="button"
                style={chip(a.bottleneck === t)}
                onClick={() => setA({ ...a, bottleneck: t })}
              >
                {t}
              </button>
            ))}
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>Tell us a bit more</span>
            <textarea
              style={{ ...input, minHeight: 80, resize: "vertical" }}
              placeholder="What actually happens, and what it costs you"
              value={a.bottleneckDetail}
              onChange={(e) => setA({ ...a, bottleneckDetail: e.target.value })}
            />
          </label>
        </>
      ),
    },
    {
      ok: a.tools.trim().length > 1 && a.goal.trim().length > 5,
      body: (
        <>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>What tools do you use today?</span>
            <input
              style={input}
              placeholder="e.g. WhatsApp, a paper diary, Xero, spreadsheets"
              value={a.tools}
              onChange={(e) => setA({ ...a, tools: e.target.value })}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>What would a good next 90 days look like?</span>
            <textarea
              style={{ ...input, minHeight: 80, resize: "vertical" }}
              value={a.goal}
              onChange={(e) => setA({ ...a, goal: e.target.value })}
            />
          </label>
        </>
      ),
    },
    {
      ok: !!a.budget,
      body: (
        <>
          <span style={label}>Appetite to invest in fixing it?</span>
          <div style={{ display: "grid", gap: 6 }}>
            {BUDGET.map((t) => (
              <button
                key={t}
                type="button"
                style={chip(a.budget === t)}
                onClick={() => setA({ ...a, budget: t })}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      ok: c.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email),
      body: (
        <>
          <p style={{ margin: 0, color: k.muted, fontSize: 14, lineHeight: 1.5 }}>
            Where should we send the plan?
          </p>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>Your name</span>
            <input
              style={input}
              value={c.name}
              autoComplete="name"
              onChange={(e) => setC({ ...c, name: e.target.value })}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>Email</span>
            <input
              style={input}
              type="email"
              value={c.email}
              autoComplete="email"
              onChange={(e) => setC({ ...c, email: e.target.value })}
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>Phone (optional)</span>
            <input
              style={input}
              type="tel"
              value={c.phone}
              autoComplete="tel"
              onChange={(e) => setC({ ...c, phone: e.target.value })}
            />
          </label>
        </>
      ),
    },
  ];

  async function submit() {
    if (preview) {
      setPhase("ready");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan-embed/${encodeURIComponent(publicKey)}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...a,
          ...c,
          sourceUrl:
            sourceUrl ?? (typeof document !== "undefined" ? document.referrer : null),
          startedAt: startedAt.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setPhase("generating");
      const gen = await fetch(
        `/api/plan-embed/${encodeURIComponent(publicKey)}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: data.token }),
        }
      );
      const g = await gen.json();
      if (!gen.ok || g.status === "failed")
        throw new Error(
          g.error ||
            "We could not write the plan just now. It will be emailed to you shortly."
        );
      setPlanUrl(g.planUrl);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={rootRef}
      style={{
        fontFamily: font,
        background: k.bg,
        color: k.fg,
        border: `1px solid ${k.border}`,
        borderRadius: 10,
        padding: 24,
        maxWidth: 560,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" style={{ height: 28 }} />
          ) : (
            <span
              style={{
                width: 10,
                height: 24,
                background: k.accent,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
          )}
          <strong style={{ fontSize: 15 }}>{brand.name}</strong>
        </div>
        {phase === "form" && (
          <span style={label}>
            {step + 1} / {steps.length}
          </span>
        )}
      </div>

      {phase === "form" && (
        <div style={{ display: "grid", gap: 14 }}>
          {step === 0 && (
            <p
              style={{ margin: "0 0 4px", color: k.muted, fontSize: 15, lineHeight: 1.5 }}
            >
              {intro ||
                "Answer six quick questions and get a free, written plan for your business — priorities, quick wins and a 90-day roadmap."}
            </p>
          )}
          {steps[step].body}
          {/* honeypot */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: "absolute", left: -9999, opacity: 0 }}
            aria-hidden
            onChange={() => undefined}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              style={{ ...ghost, visibility: step === 0 ? "hidden" : "visible" }}
              onClick={() => setStep((s) => s - 1)}
            >
              ← Back
            </button>
            {step < steps.length - 1 ? (
              <button
                type="button"
                style={{ ...btn, opacity: steps[step].ok ? 1 : 0.5 }}
                disabled={!steps[step].ok}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                style={{ ...btn, opacity: steps[step].ok && !busy ? 1 : 0.5 }}
                disabled={!steps[step].ok || busy}
                onClick={submit}
              >
                {busy ? "Sending…" : "Write my plan →"}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "generating" && (
        <div style={{ display: "grid", gap: 10, padding: "12px 0" }}>
          <div
            style={{
              height: 4,
              background: k.surface,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "40%",
                background: k.accent,
                animation: "nsPlanBar 1.6s ease-in-out infinite",
              }}
            />
          </div>
          <style>{`@keyframes nsPlanBar{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}`}</style>
          <strong style={{ fontSize: 18 }}>
            Writing your plan for {a.businessName}…
          </strong>
          <p style={{ margin: 0, color: k.muted, fontSize: 14, lineHeight: 1.5 }}>
            Usually under a minute. We are also emailing a private link to {c.email}.
          </p>
        </div>
      )}

      {phase === "ready" && (
        <div style={{ display: "grid", gap: 12 }}>
          <strong style={{ fontSize: 20 }}>
            Your plan is ready{c.name ? `, ${c.name.split(" ")[0]}` : ""}.
          </strong>
          <p style={{ margin: 0, color: k.muted, fontSize: 14, lineHeight: 1.5 }}>
            A private link has gone to {c.email || "your inbox"}. {brand.name} will follow
            up.
          </p>
          {planUrl && (
            <a
              href={planUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                ...btn,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                justifySelf: "start",
              }}
            >
              Read the plan →
            </a>
          )}
        </div>
      )}

      {phase === "failed" && (
        <div style={{ display: "grid", gap: 12 }}>
          <strong style={{ fontSize: 18 }}>We hit a snag</strong>
          <p style={{ margin: 0, color: "#e5484d", fontSize: 14 }}>{error}</p>
          <button
            type="button"
            style={{ ...ghost, justifySelf: "start" }}
            onClick={() => setPhase("form")}
          >
            Try again
          </button>
        </div>
      )}

      {poweredBy && (
        <div
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: `1px solid ${k.border}`,
            textAlign: "right",
          }}
        >
          <a
            href="https://nullshift.co.uk/products/plans"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: k.muted, textDecoration: "none" }}
          >
            Powered by Nullshift
          </a>
        </div>
      )}
    </div>
  );
}
