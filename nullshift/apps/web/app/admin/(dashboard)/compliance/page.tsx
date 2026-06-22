import { revalidatePath } from "next/cache";
import { SubmitButton } from "@/components/admin/SubmitButton";
import Link from "next/link";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";

/**
 * Compliance centre — a per-client-tenant checklist + log (brief §5/§9). Tracks
 * the GDPR controls that gate go-live: DPA signed, data-processing register
 * entry, last backup verified, and any breach / SAR. Pulls from
 * compliance_records. A project can't go live until its DPA is logged (Phase 5
 * enforces the block; this surfaces the state).
 */

export const dynamic = "force-dynamic";

type Tenant = { id: string; name: string };
type Record_ = { id: string; tenant_id: string; kind: string; recorded_at: string };

const CHECKS: { kind: string; label: string }[] = [
  { kind: "dpa_signed", label: "DPA signed" },
  { kind: "data_register", label: "Data-processing register entry" },
  { kind: "backup_check", label: "Last backup verified" },
];

async function recordCompliance(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const kind = String(formData.get("kind") || "");
  if (!tenantId || !kind) return;
  const supabase = await createClient();
  await supabase
    .from("compliance_records")
    .insert({ tenant_id: tenantId, kind: kind as never });
  await logAudit({
    action: `compliance.${kind}`,
    target: `tenant:${tenantId}`,
    tenantId,
  });
  revalidatePath("/admin/compliance");
}

// Retention + right-to-erasure: hard-delete a tenant (cascades to all its data).
async function deleteTenant(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!tenantId || confirm !== "DELETE") return;
  const supabase = await createClient();
  // Audit BEFORE the row (and its audit rows) cascade away.
  await logAudit({ action: "tenant.erased", target: `tenant:${tenantId}`, tenantId });
  await supabase.from("tenants").delete().eq("id", tenantId);
  revalidatePath("/admin/compliance");
}

// Square mono action button used inside the per-tenant forms.
const actionBtn = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  height: 28,
  paddingInline: 11,
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  cursor: "pointer",
};

export default async function CompliancePage() {
  const supabase = await createClient();
  const [{ data: tenants }, { data: records }] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("type", "client").order("name"),
    supabase.from("compliance_records").select("id, tenant_id, kind, recorded_at"),
  ]);
  const tenantList = (tenants ?? []) as Tenant[];
  const recordList = (records ?? []) as Record_[];

  return (
    <div>
      <PageHeader
        index="07"
        label="Compliance"
        title="Compliance centre"
        lead="UK GDPR controls per client. A clinic can't go live until its DPA is signed and logged."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
        {tenantList.map((tenant, ti) => {
          const recs = recordList.filter((r) => r.tenant_id === tenant.id);
          const doneCount = CHECKS.filter((c) =>
            recs.some((r) => r.kind === c.kind)
          ).length;
          const allDone = doneCount === CHECKS.length;
          return (
            <Reveal key={tenant.id} delay={ti * 0.05}>
              <Panel
                title={tenant.name}
                actions={
                  <StatusChip tone={allDone ? "success" : "warning"}>
                    {doneCount}/{CHECKS.length} controls
                  </StatusChip>
                }
              >
                <div className="flex flex-col">
                  {CHECKS.map((check, ci) => {
                    const done = recs.find((r) => r.kind === check.kind);
                    return (
                      <div
                        key={check.kind}
                        className="flex items-center justify-between"
                        style={{
                          padding: "10px 0",
                          borderTop: ci ? "1px solid var(--k-border)" : "none",
                        }}
                      >
                        <span
                          className="flex items-center gap-2"
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.88rem",
                            color: done ? "var(--k-fg)" : "var(--k-muted)",
                          }}
                        >
                          <span style={{ color: done ? T.success : "var(--k-faint)" }}>
                            {done ? "✓" : "○"}
                          </span>
                          {check.label}
                          {done && (
                            <span
                              style={{
                                fontFamily: T.mono,
                                fontSize: "10px",
                                letterSpacing: "0.06em",
                                color: "var(--k-faint)",
                                marginLeft: 6,
                              }}
                            >
                              {new Date(done.recorded_at).toLocaleDateString("en-GB")}
                            </span>
                          )}
                        </span>
                        {!done && (
                          <form action={recordCompliance}>
                            <input type="hidden" name="tenant_id" value={tenant.id} />
                            <input type="hidden" name="kind" value={check.kind} />
                            <SubmitButton style={actionBtn}>Mark done</SubmitButton>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Data subject rights — SAR export + right to erasure */}
                <div
                  className="flex items-center gap-3 flex-wrap"
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid var(--k-border)",
                  }}
                >
                  <Link
                    href={`/api/sar/${tenant.id}`}
                    prefetch={false}
                    style={{
                      ...actionBtn,
                      display: "inline-flex",
                      alignItems: "center",
                      textDecoration: "none",
                    }}
                  >
                    ↓ Export data (SAR)
                  </Link>
                  <form action={deleteTenant} className="flex items-center gap-2">
                    <input type="hidden" name="tenant_id" value={tenant.id} />
                    <input
                      name="confirm"
                      placeholder="type DELETE"
                      autoComplete="off"
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.06em",
                        height: 28,
                        padding: "0 9px",
                        width: 104,
                        background: "var(--k-surface)",
                        color: "var(--k-fg)",
                        border: `1px solid ${T.danger}55`,
                        borderRadius: 0,
                      }}
                    />
                    <SubmitButton
                      style={{
                        ...actionBtn,
                        background: "transparent",
                        color: T.danger,
                        border: `1px solid ${T.danger}55`,
                      }}
                    >
                      Erase tenant
                    </SubmitButton>
                  </form>
                </div>
              </Panel>
            </Reveal>
          );
        })}
        {tenantList.length === 0 && (
          <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            No client tenants yet.
          </p>
        )}
      </div>
    </div>
  );
}
