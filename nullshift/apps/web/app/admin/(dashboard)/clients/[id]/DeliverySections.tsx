import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import { playbooksForStage, type ChecklistItem } from "@/lib/playbooks";
import {
  addDecision,
  addMilestone,
  addRisk,
  resolveRisk,
  seedChecklist,
  setMilestoneHealth,
  toggleChecklistItem,
} from "./delivery-actions";

/**
 * The delivery layer on the client hub (audit Phase 3): milestones, the risk
 * register, the decision log, and playbook checklists — the record a new
 * employee reads instead of asking for a verbal briefing. Server component;
 * fetches its own data so the (huge) hub page only mounts it.
 */

const card: React.CSSProperties = {
  background: "var(--k-surface)",
  border: "1px solid var(--k-border)",
  padding: "18px 20px",
  marginBottom: 14,
};
const h2: React.CSSProperties = {
  fontFamily: T.display,
  fontWeight: 700,
  fontSize: "1.02rem",
  letterSpacing: "-0.01em",
  color: "var(--k-fg)",
  marginBottom: 4,
};
const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 32,
  padding: "0 10px",
  background: "var(--k-bg)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  outline: "none",
};
const btn = (bg: string, fg: string): React.CSSProperties => ({
  fontFamily: T.mono,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  height: 32,
  paddingInline: 12,
  background: bg,
  color: fg,
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  cursor: "pointer",
});
const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
};
const rowText: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  color: "var(--k-fg)",
};
const dimNote: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.8rem",
  color: "var(--k-muted)",
};

const dateGB = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

const MILESTONE_TONE: Record<string, string> = {
  on_track: T.success,
  watch: T.warning,
  at_risk: T.danger,
  done: "var(--k-faint)",
};

type Milestone = {
  id: string;
  title: string;
  target_date: string | null;
  owner: string | null;
  acceptance_criteria: string | null;
  health: string;
};
type Risk = {
  id: string;
  title: string;
  impact: string | null;
  owner: string | null;
  mitigation: string | null;
  review_date: string | null;
  status: string;
};
type Decision = {
  id: string;
  decision: string;
  rationale: string | null;
  approver: string | null;
  source: string | null;
  impact: string | null;
  decided_at: string;
};
type Checklist = { id: string; kind: string; title: string; items: ChecklistItem[] };

export async function DeliverySections({
  tenantId,
  projectId,
  stage,
}: {
  tenantId: string;
  projectId: string;
  stage: string;
}) {
  const supabase = await createClient();
  const [{ data: msRaw }, { data: riskRaw }, { data: decRaw }, { data: clRaw }] =
    await Promise.all([
      supabase
        .from("milestones")
        .select("id, title, target_date, owner, acceptance_criteria, health")
        .eq("project_id", projectId)
        .order("target_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("risks")
        .select("id, title, impact, owner, mitigation, review_date, status")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("decisions")
        .select("id, decision, rationale, approver, source, impact, decided_at")
        .eq("project_id", projectId)
        .order("decided_at", { ascending: false }),
      supabase
        .from("checklists")
        .select("id, kind, title, items")
        .eq("project_id", projectId)
        .order("created_at"),
    ]);
  const milestones = (msRaw ?? []) as Milestone[];
  const risks = (riskRaw ?? []) as Risk[];
  const decisions = (decRaw ?? []) as Decision[];
  const checklists = (clRaw ?? []) as Checklist[];
  const openRisks = risks.filter((r) => r.status === "open");
  const seededKinds = new Set(checklists.map((c) => c.kind));
  const offerable = playbooksForStage(stage).filter((p) => !seededKinds.has(p.kind));

  const hidden = (
    <>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="project_id" value={projectId} />
    </>
  );

  return (
    <>
      {/* ── Milestones ── */}
      <Reveal>
        <section style={card}>
          <h2 style={h2}>Milestones</h2>
          {milestones.length === 0 ? (
            <p style={dimNote}>No milestones yet — give the work target dates.</p>
          ) : (
            <div className="flex flex-col" style={{ marginTop: 8 }}>
              {milestones.map((m, i) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
                  style={{
                    padding: "8px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    opacity: m.health === "done" ? 0.55 : 1,
                  }}
                >
                  <div className="min-w-0">
                    <span style={rowText}>{m.title}</span>
                    <div style={{ ...mono, marginTop: 2 }}>
                      {m.target_date && <>due {dateGB(m.target_date)} · </>}
                      {m.owner && <>{m.owner} · </>}
                      {m.acceptance_criteria ?? ""}
                    </div>
                  </div>
                  <form action={setMilestoneHealth} className="flex items-center gap-1">
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <input type="hidden" name="id" value={m.id} />
                    <select
                      name="health"
                      defaultValue={m.health}
                      style={{
                        ...inp,
                        height: 26,
                        fontFamily: T.mono,
                        fontSize: 10,
                        color: MILESTONE_TONE[m.health] ?? "var(--k-muted)",
                      }}
                    >
                      {["on_track", "watch", "at_risk", "done"].map((h) => (
                        <option key={h} value={h}>
                          {h.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <SubmitButton style={btn("transparent", "var(--k-muted)")}>
                      Set
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form
            action={addMilestone}
            className="flex items-center gap-2 flex-wrap"
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--k-border)",
            }}
          >
            {hidden}
            <input
              name="title"
              required
              placeholder="Milestone"
              style={{ ...inp, width: 200 }}
            />
            <input name="target_date" type="date" style={inp} />
            <input name="owner" placeholder="Owner" style={{ ...inp, width: 110 }} />
            <input
              name="acceptance_criteria"
              placeholder="Done when…"
              style={{ ...inp, width: 200 }}
            />
            <SubmitButton style={btn("var(--k-bg)", "var(--k-fg)")}>+ Add</SubmitButton>
          </form>
        </section>
      </Reveal>

      {/* ── Risks & blockers (internal) ── */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between">
            <h2 style={h2}>Risks &amp; blockers</h2>
            <span style={mono}>internal only — never shown to the client</span>
          </div>
          {openRisks.length === 0 ? (
            <p style={dimNote}>No open risks on the register.</p>
          ) : (
            <div className="flex flex-col" style={{ marginTop: 8 }}>
              {openRisks.map((r, i) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
                  style={{
                    padding: "8px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <div className="min-w-0">
                    <span style={rowText}>{r.title}</span>
                    <div style={{ ...mono, marginTop: 2 }}>
                      {r.impact && <>impact: {r.impact} · </>}
                      {r.owner && <>{r.owner} · </>}
                      {r.mitigation && <>mitigation: {r.mitigation} · </>}
                      {r.review_date && <>review {dateGB(r.review_date)}</>}
                    </div>
                  </div>
                  <form action={resolveRisk} className="flex items-center gap-1">
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      name="resolution"
                      placeholder="How it resolved"
                      style={{ ...inp, height: 26, width: 150 }}
                    />
                    <SubmitButton
                      name="status"
                      value="mitigated"
                      style={btn("transparent", T.success)}
                    >
                      Mitigated
                    </SubmitButton>
                    <SubmitButton
                      name="status"
                      value="closed"
                      style={btn("transparent", "var(--k-muted)")}
                    >
                      Close
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}
          <form
            action={addRisk}
            className="flex items-center gap-2 flex-wrap"
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--k-border)",
            }}
          >
            {hidden}
            <input
              name="title"
              required
              placeholder="Risk / blocker"
              style={{ ...inp, width: 190 }}
            />
            <input name="impact" placeholder="Impact" style={{ ...inp, width: 130 }} />
            <input name="owner" placeholder="Owner" style={{ ...inp, width: 100 }} />
            <input
              name="mitigation"
              placeholder="Mitigation"
              style={{ ...inp, width: 170 }}
            />
            <input name="review_date" type="date" style={inp} />
            <SubmitButton style={btn("var(--k-bg)", "var(--k-fg)")}>+ Raise</SubmitButton>
          </form>
        </section>
      </Reveal>

      {/* ── Decision log (internal) ── */}
      <Reveal>
        <section style={card}>
          <div className="flex items-center justify-between">
            <h2 style={h2}>Decision log</h2>
            <span style={mono}>what was decided, why, by whom</span>
          </div>
          {decisions.length === 0 ? (
            <p style={dimNote}>
              No decisions recorded — big calls made on calls or WhatsApp belong here.
            </p>
          ) : (
            <div className="flex flex-col" style={{ marginTop: 8 }}>
              {decisions.slice(0, 8).map((d, i) => (
                <div
                  key={d.id}
                  style={{
                    padding: "8px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <span style={rowText}>{d.decision}</span>
                  <div style={{ ...mono, marginTop: 2 }}>
                    {dateGB(d.decided_at)}
                    {d.approver && <> · approved by {d.approver}</>}
                    {d.source && <> · via {d.source}</>}
                    {d.impact && <> · impact: {d.impact}</>}
                  </div>
                  {d.rationale && (
                    <div style={{ ...dimNote, marginTop: 2 }}>{d.rationale}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          <form
            action={addDecision}
            className="flex items-center gap-2 flex-wrap"
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--k-border)",
            }}
          >
            {hidden}
            <input
              name="decision"
              required
              placeholder="Decision"
              style={{ ...inp, width: 220 }}
            />
            <input name="rationale" placeholder="Why" style={{ ...inp, width: 180 }} />
            <input
              name="approver"
              placeholder="Approved by"
              style={{ ...inp, width: 110 }}
            />
            <select name="source" defaultValue="" style={{ ...inp, width: 110 }}>
              <option value="">source…</option>
              {["call", "whatsapp", "email", "portal", "internal"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              name="impact"
              placeholder="Cost / timeline / scope impact"
              style={{ ...inp, width: 200 }}
            />
            <SubmitButton style={btn("var(--k-bg)", "var(--k-fg)")}>
              + Record
            </SubmitButton>
          </form>
        </section>
      </Reveal>

      {/* ── Playbook checklists ── */}
      {(checklists.length > 0 || offerable.length > 0) && (
        <Reveal>
          <section style={card}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 style={h2}>Playbooks</h2>
              {offerable.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {offerable.map((p) => (
                    <form key={p.kind} action={seedChecklist}>
                      {hidden}
                      <input type="hidden" name="kind" value={p.kind} />
                      <SubmitButton style={btn("transparent", "var(--k-accent)")}>
                        + {p.title}
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              )}
            </div>
            {checklists.map((c) => {
              const done = c.items.filter((i) => i.done).length;
              return (
                <div key={c.id} style={{ marginTop: 12 }}>
                  <div style={{ ...mono, color: "var(--k-muted)", marginBottom: 6 }}>
                    {c.title} — {done}/{c.items.length}
                    {done === c.items.length && c.items.length > 0 && " ✓ COMPLETE"}
                  </div>
                  <div className="flex flex-col gap-1">
                    {c.items.map((item) => (
                      <form
                        key={item.name}
                        action={toggleChecklistItem}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="tenant_id" value={tenantId} />
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="name" value={item.name} />
                        <SubmitButton
                          style={{
                            ...btn(
                              "transparent",
                              item.done ? T.success : "var(--k-faint)"
                            ),
                            height: 22,
                            paddingInline: 6,
                          }}
                        >
                          {item.done ? "✓" : "○"}
                        </SubmitButton>
                        <span
                          style={{
                            ...rowText,
                            fontSize: "0.84rem",
                            color: item.done ? "var(--k-faint)" : "var(--k-fg)",
                            textDecoration: item.done ? "line-through" : "none",
                          }}
                        >
                          {item.name}
                        </span>
                      </form>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </Reveal>
      )}
    </>
  );
}
