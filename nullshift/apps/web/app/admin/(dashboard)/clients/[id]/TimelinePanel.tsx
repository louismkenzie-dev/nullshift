import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { Reveal } from "@/components/kyma";

/**
 * The unified project timeline (audit Phase 3.1): notes, client updates,
 * issues, calls, documents, invoices, and logged decisions merged into ONE
 * chronological story — the answer to "what has actually happened on this
 * account?" without opening six panels. Read-only by design; each source
 * keeps its own editing surface.
 */

type Entry = {
  id: string;
  at: string;
  kind: string;
  label: string;
  detail: string | null;
  internal: boolean;
};

const KIND_META: Record<string, { tag: string; color: string }> = {
  note: { tag: "NOTE", color: "var(--k-muted)" },
  update: { tag: "CLIENT UPDATE", color: "var(--k-accent)" },
  issue: { tag: "REQUEST", color: T.warning },
  call: { tag: "CALL", color: "var(--k-accent)" },
  document: { tag: "FILE", color: "var(--k-muted)" },
  invoice: { tag: "INVOICE", color: T.success },
  decision: { tag: "DECISION", color: T.warning },
};

export async function TimelinePanel({
  tenantId,
  projectId,
  limit = 25,
}: {
  tenantId: string;
  projectId: string | null;
  limit?: number;
}) {
  const supabase = await createClient();
  const [notes, updates, issues, calls, docs, invoices, decisions] = await Promise.all([
    projectId
      ? supabase
          .from("project_notes")
          .select("id, body, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
    supabase
      .from("project_updates")
      .select("id, title, type, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("issues")
      .select("id, title, kind, status, source, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("calls")
      .select("id, call_date, call_time, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("documents")
      .select("id, name, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("invoices")
      .select("id, amount, status, type, created_at, paid_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit),
    projectId
      ? supabase
          .from("decisions")
          .select("id, decision, approver, decided_at")
          .eq("project_id", projectId)
          .order("decided_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
  ]);

  const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
  const entries: Entry[] = [
    ...((notes.data ?? []) as { id: string; body: string; created_at: string }[]).map(
      (n) => ({
        id: `note-${n.id}`,
        at: n.created_at,
        kind: "note",
        label: n.body.length > 120 ? `${n.body.slice(0, 120)}…` : n.body,
        detail: null,
        internal: true,
      })
    ),
    ...(
      (updates.data ?? []) as {
        id: string;
        title: string;
        type: string;
        created_at: string;
      }[]
    ).map((u) => ({
      id: `update-${u.id}`,
      at: u.created_at,
      kind: u.type === "decision" ? "decision" : "update",
      label: u.title,
      detail: u.type === "decision" ? "client choice card" : null,
      internal: false,
    })),
    ...(
      (issues.data ?? []) as {
        id: string;
        title: string;
        kind: string;
        status: string;
        source: string;
        created_at: string;
      }[]
    ).map((i) => ({
      id: `issue-${i.id}`,
      at: i.created_at,
      kind: "issue",
      label: i.title,
      detail: `${i.kind} · via ${i.source} · now ${i.status.replace(/_/g, " ")}`,
      internal: false,
    })),
    ...(
      (calls.data ?? []) as {
        id: string;
        call_date: string;
        call_time: string;
        status: string;
        created_at: string;
      }[]
    ).map((c) => ({
      id: `call-${c.id}`,
      at: c.created_at,
      kind: "call",
      label: `Call ${c.status} — ${c.call_date} ${c.call_time ?? ""}`.trim(),
      detail: null,
      internal: false,
    })),
    ...((docs.data ?? []) as { id: string; name: string; created_at: string }[]).map(
      (d) => ({
        id: `doc-${d.id}`,
        at: d.created_at,
        kind: "document",
        label: d.name,
        detail: null,
        internal: false,
      })
    ),
    ...(
      (invoices.data ?? []) as {
        id: string;
        amount: number;
        status: string;
        type: string | null;
        created_at: string;
        paid_at: string | null;
      }[]
    ).map((inv) => ({
      id: `inv-${inv.id}`,
      at: inv.paid_at ?? inv.created_at,
      kind: "invoice",
      label: `${gbp(Number(inv.amount))} ${inv.paid_at ? "paid" : `invoice ${inv.status}`}`,
      detail: inv.type?.replace(/_/g, " ") ?? null,
      internal: false,
    })),
    ...(
      (decisions.data ?? []) as {
        id: string;
        decision: string;
        approver: string | null;
        decided_at: string;
      }[]
    ).map((d) => ({
      id: `dec-${d.id}`,
      at: d.decided_at,
      kind: "decision",
      label: d.decision,
      detail: d.approver ? `approved by ${d.approver}` : null,
      internal: true,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);

  if (entries.length === 0) return null;

  return (
    <Reveal>
      <section
        style={{
          background: "var(--k-surface)",
          border: "1px solid var(--k-border)",
          padding: "18px 20px",
          marginBottom: 14,
        }}
      >
        <div className="flex items-center justify-between">
          <h2
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.02rem",
              letterSpacing: "-0.01em",
              color: "var(--k-fg)",
            }}
          >
            Timeline
          </h2>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-faint)",
            }}
          >
            everything, one story · last {entries.length}
          </span>
        </div>
        <div className="flex flex-col" style={{ marginTop: 10 }}>
          {entries.map((e, i) => {
            const meta = KIND_META[e.kind] ?? KIND_META.note;
            return (
              <div
                key={e.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                style={{
                  padding: "7px 0",
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 9,
                    letterSpacing: "0.06em",
                    color: "var(--k-faint)",
                    minWidth: 74,
                  }}
                >
                  {new Date(e.at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    color: meta.color,
                    minWidth: 96,
                  }}
                >
                  {meta.tag}
                  {e.internal ? " ·🔒" : ""}
                </span>
                <span
                  className="min-w-0"
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.86rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {e.label}
                  {e.detail && (
                    <span style={{ color: "var(--k-faint)" }}> — {e.detail}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}
