"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import type { ConsultationPlan } from "@nullshift/agents/consultation";
import { AiFirstInteractionNotice, AiIndicator } from "@/components/legal/AiNotice";

/** The Agent Consultation — the primary content of /plan/[token].
 *
 *  First visit drives two generation phases against /api/consult/[token]:
 *    1. POST ?phase=plan   — the agent researches the business online, then
 *       drafts the tailored plan (statuses: researching → planning)
 *    2. POST ?phase=mockup — designs the bespoke frontend mockup
 *  Both stream SSE; later visits load the cached result instantly via GET.
 *
 *  The mockup iframe is sandbox="allow-scripts" with allow-same-origin
 *  deliberately omitted (opaque origin) — never add it.
 */

type Phase =
  | "loading"
  | "researching"
  | "planning"
  | "building"
  | "ready"
  | "mockup_failed"
  | "failed"
  | "unconfigured";

const WORKING_COPY: Record<string, string> = {
  loading: "Waking your agent…",
  researching: "Your agent is finding your business online…",
  planning: "Reading what it found and drafting your tailored plan…",
};

export function AgentConsultation({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<ConsultationPlan | null>(null);
  const [hasMockup, setHasMockup] = useState(false);
  const [buildChars, setBuildChars] = useState(0);
  const started = useRef(false);

  /** Consume one SSE response; returns the last `done` phase seen (or null). */
  const consume = useCallback(async (res: Response): Promise<string | null> => {
    if (!res.body) throw new Error("no stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let donePhase: string | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const ev = JSON.parse(line.slice(6)) as Record<string, unknown>;
        switch (ev.type) {
          case "status":
            setPhase(ev.status as Phase);
            break;
          case "plan":
            setPlan(ev.plan as ConsultationPlan);
            break;
          case "mockup_delta":
            setBuildChars(ev.chars as number);
            break;
          case "mockup_ready":
            setHasMockup(true);
            break;
          case "mockup_error":
            setPhase("mockup_failed");
            break;
          case "error":
            setPhase("failed");
            break;
          case "done":
            donePhase = (ev.phase as string) ?? null;
            break;
        }
      }
    }
    return donePhase;
  }, []);

  const runMockupPhase = useCallback(async () => {
    setPhase("building");
    const res = await fetch(`/api/consult/${token}?phase=mockup`, { method: "POST" });
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("application/json")) return "poll";
    const done = await consume(res);
    if (done === "mockup") {
      setPhase((p) => (p === "mockup_failed" ? p : "ready"));
      return "done";
    }
    return "poll";
  }, [token, consume]);

  const runPlanPhase = useCallback(async () => {
    setPhase("researching");
    const res = await fetch(`/api/consult/${token}?phase=plan`, { method: "POST" });
    if (res.status === 503) {
      setPhase("unconfigured");
      return "stop";
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("application/json")) return "poll";
    const done = await consume(res);
    return done === "plan" ? "mockup" : "poll";
  }, [token, consume]);

  const poll = useCallback(() => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/consult/${token}`);
        const data = (await res.json()) as {
          status: string;
          plan?: ConsultationPlan | null;
          hasMockup?: boolean;
        };
        if (data.plan) setPlan(data.plan);
        switch (data.status) {
          case "ready":
            setHasMockup(Boolean(data.hasMockup));
            setPhase(data.hasMockup ? "ready" : "mockup_failed");
            return;
          case "failed":
            setPhase("failed");
            return;
          case "plan_ready": {
            // The plan-phase tab died before starting the mockup — pick it up.
            const r = await runMockupPhase();
            if (r === "done") return;
            break;
          }
          case "building":
            setPhase("building");
            break;
          case "generating":
            setPhase((p) => (p === "researching" ? p : "planning"));
            break;
          case "pending": {
            // Nothing is generating (e.g. the funnel saved the lead but the
            // visitor landed here before any generator ran, or a claim was
            // released). Kick the plan phase ourselves — the DB claim makes
            // this safe if another tab beats us to it.
            const next = await runPlanPhase();
            if (next === "mockup") {
              const r = await runMockupPhase();
              if (r === "done") return;
            } else if (next === "stop") {
              return;
            }
            break;
          }
          default:
            setPhase("planning");
        }
        setTimeout(tick, 3000);
      } catch {
        setTimeout(tick, 5000);
      }
    };
    void tick();
  }, [token, runMockupPhase, runPlanPhase]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/consult/${token}`);
        const data = (await res.json()) as {
          status: string;
          plan?: ConsultationPlan | null;
          hasMockup?: boolean;
        };
        if (data.plan) setPlan(data.plan);
        switch (data.status) {
          case "ready":
            setHasMockup(Boolean(data.hasMockup));
            setPhase(data.hasMockup ? "ready" : "mockup_failed");
            return;
          case "plan_ready": {
            const r = await runMockupPhase();
            if (r !== "done") poll();
            return;
          }
          case "generating":
          case "building":
            poll();
            return;
          default: {
            const next = await runPlanPhase();
            if (next === "mockup") {
              const r = await runMockupPhase();
              if (r !== "done") poll();
            } else if (next === "poll") {
              poll();
            }
          }
        }
      } catch {
        poll();
      }
    })();
  }, [token, poll, runPlanPhase, runMockupPhase]);

  if (phase === "unconfigured") return null;

  const working = WORKING_COPY[phase];

  return (
    <section style={{ marginTop: 40 }}>
      {/* §13: the plan on this page is written by an AI agent. The badge is
          persistent — it stays for as long as the output does — and the notice
          appears once, before the first thing the agent produces. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <AiIndicator />
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "0.82rem",
            color: "var(--k-faint)",
          }}
        >
          This plan and mockup are generated by an AI agent.
        </span>
      </div>
      <AiFirstInteractionNotice surface="agent-consultation" />

      {phase === "failed" && (
        <Panel>
          <p style={bodyStyle}>
            The agent couldn&apos;t finish your plan just now. Refresh this page to retry
            — your consultation answers are safe.
          </p>
        </Panel>
      )}

      {working && !plan && <WorkingRow label={working} />}

      {plan && <PlanBody plan={plan} />}

      {/* Mockup */}
      {plan && (
        <div style={{ marginTop: 40 }}>
          <SectionHeading tag="Live mockup" title="Your system, in your brand" />
          {phase === "building" && (
            <WorkingRow
              label={`Designing your bespoke mockup${buildChars > 0 ? ` · ${Math.round(buildChars / 1000)}k characters written` : "…"}`}
            />
          )}
          {phase === "mockup_failed" && (
            <Panel>
              <p style={bodyStyle}>
                The live mockup didn&apos;t finish this time. Your plan above is complete
                — we&apos;ll walk you through the system live on your call.
              </p>
            </Panel>
          )}
          {hasMockup && (
            <div
              style={{
                border: `1px solid ${T.border}`,
                background: T.surface,
              }}
            >
              <div
                className="flex items-center justify-between px-4"
                style={{ height: 40, borderBottom: `1px solid ${T.border}` }}
              >
                <span style={monoTagStyle}>Interactive · designed for your business</span>
                <span style={{ ...monoTagStyle, color: T.faint }}>
                  Demo data — nothing is saved
                </span>
              </div>
              <iframe
                title="Your live system mockup"
                src={`/api/consult/${token}/mockup`}
                sandbox="allow-scripts"
                style={{
                  width: "100%",
                  height: "70vh",
                  minHeight: 480,
                  border: "none",
                  display: "block",
                  background: T.bg,
                }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Plan rendering ─────────────────────────────────────────────── */

function PlanBody({ plan }: { plan: ConsultationPlan }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <h3 style={{ ...headingStyle, fontSize: "1.25rem" }}>{plan.headline}</h3>
        <p style={{ ...bodyStyle, marginTop: 8 }}>{plan.intro}</p>
      </Panel>

      <Panel title="What your current setup costs you">
        <p style={bodyStyle}>{plan.diagnosis.summary}</p>
        {plan.diagnosis.currentStack.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {plan.diagnosis.currentStack.map((s, i) => (
              <div
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                style={{ borderTop: `1px solid ${T.border}` }}
              >
                <span style={{ ...bodyStyle, color: T.fg, fontWeight: 600 }}>
                  {s.name}{" "}
                  <span style={{ color: T.muted, fontWeight: 400 }}>{s.monthlyCost}</span>
                </span>
                <span style={{ ...monoTagStyle, color: T.primary }}>
                  → {s.replaceWith}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="How you become more productive">
        <p style={bodyStyle}>{plan.productivity.summary}</p>
        <div className="grid gap-3 sm:grid-cols-2" style={{ marginTop: 14 }}>
          {plan.productivity.wins.map((w, i) => (
            <div key={i} style={{ border: `1px solid ${T.border}`, padding: 14 }}>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ ...bodyStyle, color: T.fg, fontWeight: 600 }}>
                  {w.title}
                </span>
                <span style={{ ...monoTagStyle, color: T.success }}>
                  {w.hoursSavedPerWeek}
                </span>
              </div>
              <p style={{ ...bodyStyle, fontSize: "0.85rem", marginTop: 6 }}>
                {w.detail}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="The money">
        <p style={bodyStyle}>{plan.savings.summary}</p>
        <div className="grid grid-cols-3 gap-2" style={{ marginTop: 14 }}>
          <Stat label="Now / month" value={plan.savings.monthlyNow} />
          <Stat label="After / month" value={plan.savings.monthlyAfter} accent />
          <Stat label="Saved / year" value={plan.savings.annualSaving} accent />
        </div>
      </Panel>

      <Panel title="What your customers feel">
        <p style={bodyStyle}>{plan.customerExperience.summary}</p>
        <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {plan.customerExperience.improvements.map((im, i) => (
            <li key={i} style={{ ...bodyStyle, paddingLeft: 16, position: "relative" }}>
              <span
                style={{ position: "absolute", left: 0, color: T.primary }}
                aria-hidden
              >
                ▸
              </span>
              <strong style={{ color: T.fg }}>{im.title}.</strong> {im.detail}
            </li>
          ))}
        </ul>
      </Panel>

      {plan.proof.length > 0 && (
        <Panel title="How this has worked before">
          <div className="flex flex-col gap-3">
            {plan.proof.map((p, i) => (
              <div
                key={i}
                style={{ borderLeft: `2px solid ${T.primary}`, paddingLeft: 14 }}
              >
                <p style={{ ...bodyStyle, color: T.fg }}>{p.result}</p>
                <p style={{ ...monoTagStyle, marginTop: 4 }}>{p.context}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Included in your free plan">
        <ul className="grid gap-2 sm:grid-cols-2">
          {plan.freePlan.included.map((item, i) => (
            <li key={i} style={{ ...bodyStyle, paddingLeft: 16, position: "relative" }}>
              <span
                style={{ position: "absolute", left: 0, color: T.success }}
                aria-hidden
              >
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p style={{ ...bodyStyle, marginTop: 12, color: T.muted }}>
          {plan.freePlan.whatTheMockupShows}
        </p>
      </Panel>

      <Panel>
        <p style={{ ...bodyStyle, color: T.fg }}>{plan.nextStep.pitch}</p>
        <Link
          href="/book"
          className="inline-flex items-center font-medium"
          style={{
            marginTop: 14,
            height: 42,
            paddingInline: 20,
            background: T.primary,
            color: T.primaryFg,
            fontFamily: T.sans,
            fontSize: "0.9rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {plan.nextStep.cta || "Book your call"}
        </Link>
      </Panel>
    </div>
  );
}

/* ── Small pieces ───────────────────────────────────────────────── */

const bodyStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.92rem",
  lineHeight: 1.6,
  color: T.muted,
};
const headingStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontWeight: 600,
  color: T.fg,
};
const monoTagStyle: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: T.muted,
};

function SectionHeading({ tag, title }: { tag: string; title: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <span style={{ ...monoTagStyle, color: T.primary }}>{tag}</span>
      <h2 style={{ ...headingStyle, fontSize: "1.4rem", marginTop: 6 }}>{title}</h2>
    </div>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, background: T.surface, padding: 20 }}>
      {title && (
        <h3 style={{ ...headingStyle, fontSize: "1.02rem", marginBottom: 10 }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={{ border: `1px solid ${T.border}`, padding: "12px 14px" }}>
      <div style={monoTagStyle}>{label}</div>
      <div
        style={{
          fontFamily: T.sans,
          fontWeight: 700,
          fontSize: "1.15rem",
          marginTop: 4,
          color: accent ? T.primary : T.fg,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function WorkingRow({ label }: { label: string }) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "999px",
            background: T.primary,
            animation: "nsPulse 1.2s ease-in-out infinite",
          }}
        />
        <span style={{ ...bodyStyle, color: T.fg }}>{label}</span>
      </div>
      <style>{`@keyframes nsPulse { 0%,100% { opacity: .3 } 50% { opacity: 1 } }`}</style>
    </Panel>
  );
}
