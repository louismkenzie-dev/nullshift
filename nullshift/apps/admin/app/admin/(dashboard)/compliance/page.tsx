import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";

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
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
          marginBottom: 8,
        }}
      >
        // Compliance
      </div>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.9rem",
          color: T.fg,
          marginBottom: 4,
        }}
      >
        Compliance centre
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          marginBottom: 24,
          maxWidth: "62ch",
        }}
      >
        UK GDPR controls per client. A clinic can&apos;t go live until its DPA is signed
        and logged.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {tenantList.map((tenant) => {
          const recs = recordList.filter((r) => r.tenant_id === tenant.id);
          return (
            <section
              key={tenant.id}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: T.fg,
                  marginBottom: 12,
                }}
              >
                {tenant.name}
              </div>
              <div className="flex flex-col gap-2">
                {CHECKS.map((check) => {
                  const done = recs.find((r) => r.kind === check.kind);
                  return (
                    <div
                      key={check.kind}
                      className="flex items-center justify-between"
                      style={{ padding: "8px 0", borderTop: `1px solid ${T.border}` }}
                    >
                      <span
                        className="flex items-center gap-2"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.88rem",
                          color: done ? T.fg : T.muted,
                        }}
                      >
                        <span style={{ color: done ? T.success : T.faint }}>
                          {done ? "✓" : "○"}
                        </span>
                        {check.label}
                        {done && (
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "10px",
                              color: T.faint,
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
                          <button
                            type="submit"
                            style={{
                              fontFamily: T.mono,
                              fontSize: "10px",
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              height: 26,
                              paddingInline: 10,
                              background: T.surface2,
                              color: T.fg,
                              border: `1px solid ${T.border}`,
                              borderRadius: 5,
                              cursor: "pointer",
                            }}
                          >
                            Mark done
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {tenantList.length === 0 && (
          <p style={{ fontFamily: T.sans, color: T.muted }}>No client tenants yet.</p>
        )}
      </div>
    </div>
  );
}
