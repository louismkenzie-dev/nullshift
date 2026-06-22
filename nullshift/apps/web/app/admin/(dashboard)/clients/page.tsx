import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";

/**
 * Clients — the list of every client, backed by `tenants` (type='client'). One row
 * per client; click through to the unified client hub (/admin/clients/[id]). Built
 * to stay fast with hundreds of clients: a handful of bulk queries joined in memory,
 * no per-row round-trips.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
// Stage → emerald is the only brand colour; everything else reads as muted/signal.
const STAGE_TONE: Record<string, string> = {
  discovery: "var(--k-muted)",
  build: "var(--k-accent)",
  review: T.warning,
  live: T.success,
  care: T.success,
};

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

type Tenant = {
  id: string;
  name: string;
  vertical: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
};

const GRID = "1.4fr 1.6fr 110px 90px 90px";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: tenantsRaw } = await supabase
    .from("tenants")
    .select("id, name, vertical, contact_name, contact_email, created_at")
    .eq("type", "client")
    .order("created_at", { ascending: false });
  const tenants = (tenantsRaw ?? []) as Tenant[];
  const ids = tenants.map((t) => t.id);

  // Bulk-load the per-client signals, then fold into maps (no N+1).
  const [{ data: projects }, { data: subs }, { data: dpa }, { data: crs }] = ids.length
    ? await Promise.all([
        supabase
          .from("projects")
          .select("tenant_id, stage, created_at")
          .in("tenant_id", ids),
        supabase
          .from("subscriptions")
          .select("tenant_id, mrr")
          .eq("status", "active")
          .in("tenant_id", ids),
        supabase
          .from("compliance_records")
          .select("tenant_id")
          .eq("kind", "dpa_signed")
          .in("tenant_id", ids),
        supabase.from("change_requests").select("tenant_id, status").in("tenant_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const stageByTenant = new Map<string, string>();
  for (const p of (projects ?? []) as { tenant_id: string; stage: string }[]) {
    // First seen wins is fine; projects aren't ordered, so prefer the "furthest"
    // stage by index for a sensible headline.
    const order = ["discovery", "build", "review", "live", "care"];
    const cur = stageByTenant.get(p.tenant_id);
    if (!cur || order.indexOf(p.stage) > order.indexOf(cur))
      stageByTenant.set(p.tenant_id, p.stage);
  }
  const mrrByTenant = new Map<string, number>();
  for (const s of (subs ?? []) as { tenant_id: string; mrr: number }[])
    mrrByTenant.set(s.tenant_id, (mrrByTenant.get(s.tenant_id) ?? 0) + Number(s.mrr));
  const dpaSet = new Set((dpa ?? []).map((d: { tenant_id: string }) => d.tenant_id));
  const openCrByTenant = new Map<string, number>();
  for (const c of (crs ?? []) as { tenant_id: string; status: string }[]) {
    if (c.status !== "shipped" && c.status !== "rejected")
      openCrByTenant.set(c.tenant_id, (openCrByTenant.get(c.tenant_id) ?? 0) + 1);
  }
  const totalMrr = [...mrrByTenant.values()].reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        index="01"
        label="Clients"
        title="Clients"
        lead="Click a client to open their hub — booking, proposal, DPA, invoicing and deliverables in one place."
        actions={
          <span style={{ ...mono, fontSize: 12, color: "var(--k-muted)" }}>
            {tenants.length} clients ·{" "}
            <span style={{ color: "var(--k-accent)" }}>{gbp(totalMrr)}/mo MRR</span>
          </span>
        }
      />

      {tenants.length === 0 ? (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.9rem",
            color: "var(--k-faint)",
            marginTop: 24,
          }}
        >
          No clients yet. Promote a lead from the Pipeline to create one.
        </p>
      ) : (
        <div
          className="overflow-hidden"
          style={{ border: "1px solid var(--k-border)", marginTop: 24 }}
        >
          {/* Mono uppercase column headers */}
          <div
            className="grid items-center gap-4 px-5 py-3"
            style={{
              gridTemplateColumns: GRID,
              background: "var(--k-surface)",
              borderBottom: "1px solid var(--k-border)",
            }}
          >
            <span style={{ ...mono, color: "var(--k-muted)" }}>Client</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Contact</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Stage</span>
            <span style={{ ...mono, color: "var(--k-muted)" }}>Compliance</span>
            <span style={{ ...mono, color: "var(--k-muted)", textAlign: "right" }}>
              MRR
            </span>
          </div>
          {tenants.map((t, i) => {
            const stage = stageByTenant.get(t.id);
            const mrr = mrrByTenant.get(t.id) ?? 0;
            const openCr = openCrByTenant.get(t.id) ?? 0;
            const dpaSigned = dpaSet.has(t.id);
            return (
              <Reveal key={t.id} delay={Math.min(i, 8) * 0.04}>
                <Link
                  href={`/admin/clients/${t.id}`}
                  className="grid items-center gap-4 px-5 py-3.5 hover:bg-[var(--k-surface)]"
                  style={{
                    gridTemplateColumns: GRID,
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {t.name}
                    {t.vertical && (
                      <span style={{ ...mono, color: "var(--k-faint)" }}>
                        {" "}
                        · {t.vertical}
                      </span>
                    )}
                  </span>
                  <span style={{ ...mono, fontSize: 11, color: "var(--k-muted)" }}>
                    {t.contact_email || t.contact_name || "—"}
                  </span>
                  <span>
                    {stage ? (
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ ...mono, color: STAGE_TONE[stage] ?? "var(--k-muted)" }}
                      >
                        <span
                          className="k-livedot"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: STAGE_TONE[stage] ?? "var(--k-muted)",
                            display: "inline-block",
                          }}
                        />
                        {stage}
                      </span>
                    ) : (
                      <span style={{ ...mono, color: "var(--k-faint)" }}>no project</span>
                    )}
                  </span>
                  <span
                    style={{
                      ...mono,
                      color: dpaSigned ? T.success : "var(--k-faint)",
                    }}
                  >
                    {dpaSigned ? "DPA ✓" : "DPA —"}
                    {openCr > 0 && (
                      <span style={{ color: T.warning, display: "block" }}>
                        {openCr} CR
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      ...mono,
                      fontSize: 12,
                      letterSpacing: "0.04em",
                      color: mrr > 0 ? "var(--k-accent)" : "var(--k-faint)",
                      textAlign: "right",
                    }}
                  >
                    {mrr > 0 ? `${gbp(mrr)}/mo` : "—"}
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
