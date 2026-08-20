import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { controlHealth } from "@/lib/soc2/health";
import { HEALTH_TONE } from "@/lib/soc2/ui";
import {
  CONTROL_HEALTH_LABEL,
  TSC_LABEL,
  type ControlHealth,
  type ControlRow,
  type ControlRunRow,
  type EvidenceRow,
  type ExceptionRow,
  type TscCategory,
} from "@/lib/soc2/types";
import { EmptyRow, HeaderRow, faintMono, monoLabel, shortDate } from "../shared";

/**
 * Control library — every control the programme runs: who owns it, how often
 * it is performed, and whether its evidence trail is current. Health is a
 * per-control status with a stated basis (operating / evidence due / evidence
 * missing / exception open), never a rollup score: readiness is a set of
 * statuses with reasons, and the report conclusion belongs to an independent
 * auditor. Rows open the control's detail page (definition, runs, evidence,
 * exceptions).
 */

export const dynamic = "force-dynamic";

const GRID = "90px 1.6fr 130px 1.1fr 100px 1.5fr 100px";

const CATEGORIES = Object.keys(TSC_LABEL) as TscCategory[];
const HEALTHS = Object.keys(CONTROL_HEALTH_LABEL) as ControlHealth[];

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: T.mono,
        fontSize: "10px",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "5px 9px",
        border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
        color: active ? "var(--k-accent)" : "var(--k-muted)",
        background: active ? "rgba(16,185,129,0.08)" : "var(--k-surface)",
        whiteSpace: "nowrap",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

export default async function Soc2ControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; health?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const categoryFilter = (CATEGORIES as string[]).includes(sp.category ?? "")
    ? (sp.category as TscCategory)
    : null;
  const healthFilter = (HEALTHS as string[]).includes(sp.health ?? "")
    ? (sp.health as ControlHealth)
    : null;
  const err = sp.err || null;

  const supabase = await createClient();
  const [
    { data: controlRows },
    { data: runRows },
    { data: evidenceRows },
    { data: exceptionRows },
  ] = await Promise.all([
    supabase
      .from("soc2_controls")
      .select(
        "id, key, tsc_category, tsc_refs, name, objective, owner_email, frequency, policy_key, applicability, status, next_due_at"
      )
      .order("key"),
    supabase
      .from("soc2_control_runs")
      .select(
        "id, control_id, fire_key, due_at, status, result, performed_by, performed_at, reviewer_email, review_result"
      ),
    supabase
      .from("soc2_evidence_items")
      .select("id, control_id, control_run_id, source, capture_date, review_result, classification"),
    supabase
      .from("soc2_exceptions")
      .select(
        "id, ref, control_id, rule_key, fire_key, title, detail, severity, status, owner_email, due_at, detected_at, triaged_at"
      ),
  ]);
  const controls = (controlRows ?? []) as ControlRow[];
  const runs = (runRows ?? []) as ControlRunRow[];
  const evidence = (evidenceRows ?? []) as EvidenceRow[];
  const exceptions = (exceptionRows ?? []) as ExceptionRow[];

  const today = new Date().toISOString().slice(0, 10);
  const healthById = new Map<string, { health: ControlHealth; explain: string }>();
  for (const c of controls) {
    healthById.set(
      c.id,
      controlHealth({
        control: { ...c, tsc_refs: (c.tsc_refs ?? []) as string[] },
        runs: runs.filter((r) => r.control_id === c.id),
        evidence: evidence.filter((e) => e.control_id === c.id),
        exceptions: exceptions.filter((e) => e.control_id === c.id),
        today,
      })
    );
  }

  const applicable = controls.filter((c) => c.applicability === "applicable");
  const countOf = (h: ControlHealth) =>
    applicable.filter((c) => healthById.get(c.id)?.health === h).length;

  const visible = controls.filter(
    (c) =>
      (!categoryFilter || c.tsc_category === categoryFilter) &&
      (!healthFilter || healthById.get(c.id)?.health === healthFilter)
  );

  const href = (patch: { category?: string | null; health?: string | null }) => {
    const q = new URLSearchParams();
    const cat = patch.category === undefined ? categoryFilter : patch.category;
    const h = patch.health === undefined ? healthFilter : patch.health;
    if (cat) q.set("category", cat);
    if (h) q.set("health", h);
    const s = q.toString();
    return s ? `/admin/soc2/controls?${s}` : "/admin/soc2/controls";
  };

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Control library"
        lead="Every control the programme runs: who owns it, how often it is performed, and whether its evidence trail is current."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: T.danger,
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          {err}
        </p>
      )}

      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 28 }}>
          <StatCard
            value={String(countOf("operating"))}
            label="Operating"
            sub="Performed and evidenced within their window."
          />
          <StatCard
            value={String(countOf("evidence_due"))}
            label="Evidence due"
            sub="A run is due inside the lead window."
          />
          <StatCard
            value={String(countOf("evidence_missing"))}
            label="Evidence missing"
            sub="An overdue run, or a completed run with nothing attached."
          />
          <StatCard
            value={String(countOf("exception_open"))}
            label="Exception open"
            sub="At least one open exception requires review."
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="flex flex-col gap-2" style={{ marginTop: 22 }}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ ...monoLabel, marginRight: 4 }}>Category</span>
            <FilterChip href={href({ category: null })} active={!categoryFilter}>
              All
            </FilterChip>
            {CATEGORIES.map((cat) => (
              <FilterChip key={cat} href={href({ category: cat })} active={categoryFilter === cat}>
                {TSC_LABEL[cat]}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ ...monoLabel, marginRight: 4 }}>Health</span>
            <FilterChip href={href({ health: null })} active={!healthFilter}>
              All
            </FilterChip>
            {HEALTHS.map((h) => (
              <FilterChip key={h} href={href({ health: h })} active={healthFilter === h}>
                {CONTROL_HEALTH_LABEL[h]}
              </FilterChip>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <div style={{ marginTop: 22 }}>
          <Panel label="// CONTROL LIBRARY" pad={false}>
            <HeaderRow
              grid={GRID}
              cols={["Key", "Name", "Category", "Owner", "Frequency", "Health", "Next due"]}
            />
            {visible.length === 0 && (
              <EmptyRow>
                {controls.length === 0 ? (
                  <>
                    The control library is empty. Seed the programme from{" "}
                    <Link href="/admin/soc2/settings" style={{ color: "var(--k-accent)" }}>
                      Settings → Seed programme
                    </Link>
                    .
                  </>
                ) : (
                  "No controls match the current filters."
                )}
              </EmptyRow>
            )}
            {visible.map((c, i) => {
              const h = healthById.get(c.id)!;
              return (
                <Link
                  key={c.id}
                  href={`/admin/soc2/controls/${c.id}`}
                  className="grid md:grid gap-3 items-center px-4 py-2.5"
                  style={{
                    gridTemplateColumns: GRID,
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: "0.75rem", color: "var(--k-fg)" }}>
                    {c.key}
                  </span>
                  <span
                    className="min-w-0"
                    style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-fg)" }}
                  >
                    {c.name}
                  </span>
                  <span style={faintMono}>{TSC_LABEL[c.tsc_category]}</span>
                  {c.owner_email ? (
                    <span
                      className="min-w-0 truncate"
                      style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-muted)" }}
                    >
                      {c.owner_email}
                    </span>
                  ) : (
                    <span>
                      <StatusChip tone="warning">unowned</StatusChip>
                    </span>
                  )}
                  <span style={faintMono}>{c.frequency.replace(/_/g, " ")}</span>
                  <span className="flex flex-col items-start gap-1 min-w-0">
                    <StatusChip tone={HEALTH_TONE[h.health]}>
                      {h.health.replace(/_/g, " ")}
                    </StatusChip>
                    <span style={{ ...faintMono, whiteSpace: "normal" }}>{h.explain}</span>
                  </span>
                  <span style={faintMono}>{shortDate(c.next_due_at)}</span>
                </Link>
              );
            })}
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
