import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubprocessorNotices } from "./SubprocessorNotices";
import { Reveal } from "@/components/kyma";
import { GDPR_CONTROLS } from "@/lib/compliance/controls";

/**
 * Compliance centre — the global §12 subprocessor notices plus a compact
 * per-client scan of the UK GDPR controls that gate go-live (compliance_records:
 * DPA signed, data-processing register entry, last backup verified). Read-only
 * per client: the DPA is recorded on the Docs and Legal tile, the two
 * operational controls on Scale and Risk, and erasure lives in the Account
 * management danger zone (email-confirmed deleteClient) — one write path each,
 * no weaker duplicates here. Each row just links to where the work happens.
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string };
type Record_ = { id: string; tenant_id: string; kind: string; recorded_at: string };

const DPA_KIND = "dpa_signed";
/** All three go-live controls: the DPA plus the two operational ones. */
const CONTROL_KINDS = [DPA_KIND, ...GDPR_CONTROLS.map((c) => c.kind)];

// Square mono action link used on the per-tenant rows.
const actionLink: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  height: 26,
  paddingInline: 9,
  background: "var(--k-surface)",
  color: "var(--k-accent)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const dateGB = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

export default async function CompliancePage() {
  const supabase = await createClient();
  const [{ data: tenants }, { data: records }] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("type", "client").order("name"),
    supabase.from("compliance_records").select("id, tenant_id, kind, recorded_at"),
  ]);
  const tenantList = (tenants ?? []) as Tenant[];
  const recordList = (records ?? []) as Record_[];

  const rows = tenantList.map((tenant) => {
    const recs = recordList.filter((r) => r.tenant_id === tenant.id);
    const doneCount = CONTROL_KINDS.filter((k) => recs.some((r) => r.kind === k)).length;
    const dpa = recs.find((r) => r.kind === DPA_KIND);
    return { tenant, doneCount, dpa };
  });
  const readyCount = rows.filter((r) => r.doneCount === CONTROL_KINDS.length).length;

  return (
    <div>
      <PageHeader
        index="07"
        label="Compliance"
        title="Compliance centre"
        lead="UK GDPR controls per client. A clinic can't go live until its DPA is signed and logged."
      />

      <div style={{ marginTop: 28 }}>
        <SubprocessorNotices />
      </div>

      <div style={{ marginTop: 28 }}>
        <Reveal delay={0.05}>
          <Panel
            label="Per client"
            title="Go-live controls"
            pad={false}
            actions={
              tenantList.length > 0 ? (
                <StatusChip tone={readyCount === tenantList.length ? "success" : "muted"}>
                  {readyCount}/{tenantList.length} ready
                </StatusChip>
              ) : undefined
            }
          >
            {rows.length === 0 && (
              <p
                style={{
                  fontFamily: T.sans,
                  color: "var(--k-muted)",
                  padding: "14px 18px",
                  margin: 0,
                }}
              >
                No client tenants yet.
              </p>
            )}
            {rows.map(({ tenant, doneCount, dpa }, i) => {
              const allDone = doneCount === CONTROL_KINDS.length;
              return (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between gap-4 flex-wrap"
                  style={{
                    padding: "12px 18px",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  {/* Tenant name → the client block */}
                  <Link
                    href={`/admin/clients/${tenant.id}`}
                    className="truncate"
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                      textDecoration: "none",
                      minWidth: 0,
                      flex: "1 1 180px",
                    }}
                    title={`Open ${tenant.name}`}
                  >
                    {tenant.name}
                  </Link>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Controls chip → Scale and Risk (where the operational controls are recorded) */}
                    <Link
                      href={`/admin/clients/${tenant.id}/pricing`}
                      style={{ textDecoration: "none" }}
                      title="Data-processing register + backup check — recorded on Scale and Risk"
                    >
                      <StatusChip tone={allDone ? "success" : "warning"}>
                        {doneCount}/{CONTROL_KINDS.length} controls
                      </StatusChip>
                    </Link>
                    {/* DPA chip → Docs and Legal (where the DPA is recorded) */}
                    <Link
                      href={`/admin/clients/${tenant.id}/docs`}
                      style={{ textDecoration: "none" }}
                      title={
                        dpa
                          ? `DPA signed ${dateGB(dpa.recorded_at)} — Docs and Legal`
                          : "DPA not yet signed — recorded on Docs and Legal"
                      }
                    >
                      <StatusChip tone={dpa ? "success" : "danger"}>
                        {dpa ? `DPA signed ${dateGB(dpa.recorded_at)}` : "DPA unsigned"}
                      </StatusChip>
                    </Link>

                    <Link href={`/admin/compliance/${tenant.id}`} style={actionLink}>
                      Reviews →
                    </Link>
                    <Link
                      href={`/api/sar/${tenant.id}`}
                      prefetch={false}
                      style={{ ...actionLink, color: "var(--k-fg)" }}
                      title="Subject access request — export this client's data"
                    >
                      ↓ SAR
                    </Link>
                  </div>
                </div>
              );
            })}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
