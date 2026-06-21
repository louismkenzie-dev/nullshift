import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";

/**
 * Clients — the list of every client, backed by `tenants` (type='client'). One row
 * per client; click through to the unified client hub (/admin/clients/[id]). Built
 * to stay fast with hundreds of clients: a handful of bulk queries joined in memory,
 * no per-row round-trips.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const STAGE_TONE: Record<string, string> = {
  discovery: T.info,
  build: T.primary,
  review: T.warning,
  live: T.success,
  care: T.success,
};

type Tenant = {
  id: string;
  name: string;
  vertical: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
};

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
      <div
        className="flex items-end justify-between flex-wrap gap-3"
        style={{ marginBottom: 8 }}
      >
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: T.primary,
              marginBottom: 8,
            }}
          >
            // Clients
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1.9rem",
              color: T.fg,
            }}
          >
            Clients
          </h1>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
          {tenants.length} clients ·{" "}
          <span style={{ color: T.primary }}>{gbp(totalMrr)}/mo MRR</span>
        </span>
      </div>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          marginBottom: 22,
        }}
      >
        Click a client to open their hub — booking, proposal, DPA, invoicing and
        deliverables in one place.
      </p>

      {tenants.length === 0 ? (
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.faint }}>
          No clients yet. Promote a lead from the Pipeline to create one.
        </p>
      ) : (
        <div className="overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {tenants.map((t, i) => {
            const stage = stageByTenant.get(t.id);
            const mrr = mrrByTenant.get(t.id) ?? 0;
            const openCr = openCrByTenant.get(t.id) ?? 0;
            const dpaSigned = dpaSet.has(t.id);
            return (
              <Link
                key={t.id}
                href={`/admin/clients/${t.id}`}
                className="grid items-center gap-4 px-5 py-3.5 hover:bg-[#1f1f23] transition-colors"
                style={{
                  gridTemplateColumns: "1.4fr 1.6fr 110px 90px 90px",
                  borderTop: i ? `1px solid ${T.border}` : "none",
                  background: T.surface,
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: T.fg,
                  }}
                >
                  {t.name}
                  {t.vertical && (
                    <span style={{ color: T.faint, fontFamily: T.mono, fontSize: 10 }}>
                      {" "}
                      · {t.vertical}
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                  {t.contact_email || t.contact_name || "—"}
                </span>
                <span>
                  {stage ? (
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: STAGE_TONE[stage] ?? T.muted,
                      }}
                    >
                      ● {stage}
                    </span>
                  ) : (
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.faint }}>
                      no project
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: dpaSigned ? T.success : T.faint,
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
                    fontFamily: T.mono,
                    fontSize: 12,
                    color: mrr > 0 ? T.primary : T.faint,
                    textAlign: "right",
                  }}
                >
                  {mrr > 0 ? `${gbp(mrr)}/mo` : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
