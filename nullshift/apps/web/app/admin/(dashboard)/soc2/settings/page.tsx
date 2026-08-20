import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2 } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { seedProgramme, detectActiveIntegrations } from "@/lib/soc2/seed";
import { runSweep, loadEngineConfig } from "@/lib/soc2/sweep";
import type { ProgrammeRole } from "@/lib/soc2/types";
import { PROGRAMME_ROLE_LABEL } from "@/lib/soc2/types";
import { inp, primaryBtn, actionBtn, dangerBtn, Field, shortDate, faintMono, bodyText, EmptyRow, HeaderRow } from "../shared";

/**
 * Programme settings — roles and accountability, seeding, the manual sweep,
 * and the engine's SLA configuration (read from ops_settings.soc2_engine).
 *
 * Bootstrap rule: while NO programme roles exist, any staff member may appoint
 * the FIRST Programme Owner (that act is audited); afterwards only Programme
 * Owners manage roles. Auditor roles are granted from the Audit Pack page so
 * the invitation sits next to what it opens.
 */

export const dynamic = "force-dynamic";

type RoleRow = {
  id: string;
  user_email: string;
  role: ProgrammeRole;
  scope_note: string | null;
  granted_by: string | null;
  expires_at: string | null;
  created_at: string;
};

const GRANTABLE: ProgrammeRole[] = [
  "programme_owner",
  "control_owner",
  "evidence_reviewer",
  "system_owner",
  "staff",
];

// ── server actions ─────────────────────────────────────────────

async function grantRole(formData: FormData) {
  "use server";
  const guard = await requireSoc2();
  if (!guard.ok) return;
  const email = String(formData.get("user_email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");
  const scopeNote = String(formData.get("scope_note") || "").trim();
  if (!email || !email.includes("@") || !(GRANTABLE as string[]).includes(role)) return;

  // After bootstrap, only Programme Owners grant roles. During bootstrap, the
  // ONLY grantable role is the first programme_owner.
  if (guard.bootstrap) {
    if (role !== "programme_owner") return;
  } else if (!guard.roles.includes("programme_owner")) {
    return;
  }

  const db = createServiceClient();
  const { data: created, error } = await db
    .from("soc2_programme_roles")
    .upsert(
      { user_email: email, role, scope_note: scopeNote || null, granted_by: guard.email },
      { onConflict: "user_email,role", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (error) redirect(`/admin/soc2/settings?err=${encodeURIComponent(error.message)}`);
  await logSoc2Event({
    recordType: "programme_role",
    recordId: created?.id ?? "00000000-0000-0000-0000-000000000000",
    type: guard.bootstrap ? "bootstrap_granted" : "granted",
    summary: `${PROGRAMME_ROLE_LABEL[role as ProgrammeRole]} granted to ${email} by ${guard.email}${guard.bootstrap ? " (programme bootstrap)" : ""}.`,
    actor: guard.email,
  });
  revalidatePath("/admin/soc2/settings");
}

async function revokeRole(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!id || confirm !== "REVOKE") return;
  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_programme_roles")
    .select("id, user_email, role")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  // The last Programme Owner cannot remove themself into a headless programme.
  if (row.role === "programme_owner") {
    const { count } = await db
      .from("soc2_programme_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "programme_owner");
    if ((count ?? 0) <= 1) {
      redirect(
        `/admin/soc2/settings?err=${encodeURIComponent("Appoint another Programme Owner before removing the last one.")}`
      );
    }
  }
  await db.from("soc2_programme_roles").delete().eq("id", id);
  await logSoc2Event({
    recordType: "programme_role",
    recordId: id,
    type: "revoked",
    summary: `${PROGRAMME_ROLE_LABEL[row.role as ProgrammeRole]} revoked from ${row.user_email} by ${guard.email}.`,
    actor: guard.email,
  });
  revalidatePath("/admin/soc2/settings");
}

async function seedAction() {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;
  const report = await seedProgramme(guard.email);
  redirect(
    `/admin/soc2/settings?seeded=${encodeURIComponent(
      `${report.controlsCreated} controls, ${report.policiesCreated} policies, ${report.vendorsCreated} vendors, ${report.assetsCreated} assets`
    )}`
  );
}

async function sweepAction() {
  "use server";
  const guard = await requireSoc2("programme_owner", "control_owner", "evidence_reviewer");
  if (!guard.ok) return;
  const outcome = await runSweep("manual", guard.email);
  redirect(
    `/admin/soc2/settings?swept=${encodeURIComponent(
      `${outcome.runsScheduled} evidence requests scheduled, ${outcome.exceptionsRaised} exceptions raised, ${outcome.exceptionsAutoResolved} moved to pending-verification, ${outcome.alertsSent} alerts sent`
    )}`
  );
}

// ── page ───────────────────────────────────────────────────────

const ROLE_GRID = "1.6fr 170px 1.4fr 140px 120px 110px";

export default async function Soc2SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; seeded?: string; swept?: string }>;
}) {
  const { err, seeded, swept } = await searchParams;
  const guard = await requireSoc2();
  const supabase = await createClient();
  const [{ data: roles }, { count: controlCount }, config] = await Promise.all([
    supabase
      .from("soc2_programme_roles")
      .select("id, user_email, role, scope_note, granted_by, expires_at, created_at")
      .order("created_at"),
    supabase.from("soc2_controls").select("id", { count: "exact", head: true }),
    loadEngineConfig(),
  ]);
  const roleList = (roles ?? []) as RoleRow[];
  const bootstrap = roleList.length === 0;
  const isOwner = guard.ok && guard.roles.includes("programme_owner");
  const integrations = detectActiveIntegrations();

  const banner = (text: string, tone: "danger" | "success") => (
    <p
      style={{
        fontFamily: T.mono,
        fontSize: "11px",
        letterSpacing: "0.04em",
        color: tone === "danger" ? T.danger : T.success,
        border: `1px solid ${(tone === "danger" ? T.danger : T.success) + "40"}`,
        padding: "10px 14px",
        marginTop: 16,
      }}
    >
      {text}
    </p>
  );

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Programme settings"
        lead="Roles and accountability, programme seeding, and the detection sweep. Every change here is audited."
      />

      {err && banner(err, "danger")}
      {seeded && banner(`Seed complete: ${seeded}.`, "success")}
      {swept && banner(`Sweep complete: ${swept}.`, "success")}

      {/* Roles */}
      <Reveal delay={0.04}>
        <div style={{ marginTop: 22 }}>
          <Panel
            label="// PROGRAMME ROLES"
            title="Who is accountable"
            actions={
              bootstrap ? <StatusChip tone="warning">bootstrap — appoint the Programme Owner</StatusChip> : undefined
            }
            pad={false}
          >
            {roleList.length === 0 ? (
              <EmptyRow>
                No roles yet. Appoint the first Programme Owner below — for a small company this is
                a Director/Partner. The appointment is audited.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow grid={ROLE_GRID} cols={["email", "role", "scope", "granted by", "expires", ""]} />
                {roleList.map((r, i) => (
                  <div
                    key={r.id}
                    className="grid gap-3 items-center px-4 py-2.5"
                    style={{ gridTemplateColumns: ROLE_GRID, borderTop: i ? "1px solid var(--k-border)" : "none" }}
                  >
                    <span style={{ fontFamily: T.sans, fontSize: "0.84rem", color: "var(--k-fg)" }}>
                      {r.user_email}
                    </span>
                    <StatusChip tone={r.role === "programme_owner" ? "accent" : r.role === "auditor" ? "warning" : "muted"}>
                      {PROGRAMME_ROLE_LABEL[r.role]}
                    </StatusChip>
                    <span style={faintMono}>{r.scope_note ?? "—"}</span>
                    <span style={faintMono}>{r.granted_by ?? "—"}</span>
                    <span
                      style={{
                        ...faintMono,
                        color: r.expires_at && r.expires_at < new Date().toISOString() ? T.danger : "var(--k-faint)",
                      }}
                    >
                      {r.expires_at ? shortDate(r.expires_at) : "—"}
                    </span>
                    {isOwner ? (
                      <form action={revokeRole} className="flex items-center gap-2 justify-end">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="confirm" style={{ ...inp, width: 88, height: 28, fontSize: "0.7rem" }} placeholder="REVOKE" />
                        <SubmitButton style={dangerBtn}>Revoke</SubmitButton>
                      </form>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {(bootstrap || isOwner) && (
        <Reveal delay={0.06}>
          <div style={{ marginTop: 14 }}>
            <Panel label="// GRANT A ROLE">
              <form action={grantRole} className="flex flex-wrap items-end gap-3">
                <Field label="Email" grow>
                  <input name="user_email" style={inp} required placeholder="person@nullshift.co.uk" />
                </Field>
                <Field label="Role">
                  <select name="role" style={inp} defaultValue={bootstrap ? "programme_owner" : "control_owner"}>
                    {(bootstrap ? (["programme_owner"] as ProgrammeRole[]) : GRANTABLE).map((r) => (
                      <option key={r} value={r}>
                        {PROGRAMME_ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Scope note (e.g. which systems)" grow>
                  <input name="scope_note" style={inp} maxLength={200} />
                </Field>
                <SubmitButton style={primaryBtn}>{bootstrap ? "Appoint Programme Owner" : "Grant role"}</SubmitButton>
              </form>
              <p style={{ ...faintMono, marginTop: 10 }}>
                Auditor access (read-only, time-limited) is granted from the Audit Pack page. Client
                users can never hold programme roles — this area is staff-side only.
              </p>
            </Panel>
          </div>
        </Reveal>
      )}

      {/* Seeding + sweep */}
      <div className="grid md:grid-cols-2 gap-4" style={{ marginTop: 18 }}>
        <Reveal delay={0.08}>
          <Panel label="// SEED THE PROGRAMME" title={controlCount ? "Re-run seed (additive)" : "Install the baseline"}>
            <p style={bodyText}>
              Installs the control library ({controlCount ?? 0} controls present), the 12 policy
              drafts (all marked for human review), the vendor register (from the sub-processor
              register + live integrations, seeded as <em>proposed</em> because the legal register
              marks them unverified), and the asset inventory (platform estate + client system
              passports). Re-running only adds what is missing — owners, schedules and decisions
              are never overwritten.
            </p>
            {isOwner ? (
              <form action={seedAction} style={{ marginTop: 12 }}>
                <SubmitButton style={primaryBtn} pendingLabel="Seeding…">
                  Seed / update programme
                </SubmitButton>
              </form>
            ) : (
              <p style={{ ...faintMono, marginTop: 12 }}>Programme Owner only.</p>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.1}>
          <Panel label="// DETECTION SWEEP" title="Runs daily at 06:30 UTC; run now on demand">
            <p style={bodyText}>
              One idempotent pass: schedules due evidence requests, runs every exception rule over
              a fresh snapshot, routes alerts by severity, and escalates unacknowledged
              critical/high exceptions. Re-runs never duplicate or re-alert.
            </p>
            <p style={{ ...faintMono, marginTop: 10 }}>
              Engine SLAs (ops_settings.soc2_engine): acknowledgement grace {config.ackGraceDays}d ·
              revoke action {config.revokeActionSlaDays}d · incident ack {config.incidentAckSlaHours}h ·
              post-incident review {config.postIncidentReviewGraceDays}d · management review cadence{" "}
              {config.managementReviewCadenceDays}d · AI heartbeat stale {config.aiStaleHours}h
            </p>
            {guard.ok && !bootstrap ? (
              <form action={sweepAction} style={{ marginTop: 12 }}>
                <SubmitButton style={actionBtn} pendingLabel="Sweeping…">
                  Run sweep now
                </SubmitButton>
              </form>
            ) : (
              <p style={{ ...faintMono, marginTop: 12 }}>Appoint the Programme Owner first.</p>
            )}
          </Panel>
        </Reveal>
      </div>

      {/* Integrations detected */}
      <Reveal delay={0.12}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// INTEGRATIONS DETECTED IN THIS ENVIRONMENT" pad={false}>
            <div className="flex flex-col">
              {integrations.map((integ, i) => (
                <div
                  key={integ.key}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderTop: i ? "1px solid var(--k-border)" : "none" }}
                >
                  <span style={bodyText}>{integ.label}</span>
                  <span style={faintMono}>configured · secret held in env, reference only</span>
                </div>
              ))}
            </div>
            <p style={{ ...faintMono, padding: "10px 14px", borderTop: "1px solid var(--k-border)" }}>
              Detection reads configuration presence only — never key material. An integration in
              use without a vendor-register entry raises a high-severity exception on the next
              sweep.
            </p>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
