import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { READINESS_DISCLAIMER } from "@/lib/soc2/ui";
import { buildAuditPack, PACK_SECTIONS, type PackSection } from "@/lib/soc2/pack";
import { addDays, toDateOnly } from "@/lib/soc2/schedule";
import {
  inp,
  actionBtn,
  primaryBtn,
  dangerBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  monoLabel,
  faintMono,
  bodyText,
} from "../shared";

/**
 * Audit pack & review periods — the controlled hand-over surface of the
 * programme. Review periods define the reporting window; the pack builder
 * exports what happened inside one (against an APPROVED scope version only)
 * as period-scoped, secret-redacted readiness material for a qualified
 * independent auditor; and auditor access itself is managed here as read-only,
 * time-limited, explicitly invited programme roles. Every generation, download
 * and access grant is a named, audited act.
 */

export const dynamic = "force-dynamic";

const PAGE = "/admin/soc2/audit-pack";

const PERIOD_KINDS = ["readiness", "type1_prep", "type2_period"] as const;
type PeriodKind = (typeof PERIOD_KINDS)[number];

type PeriodRow = {
  id: string;
  label: string;
  kind: PeriodKind;
  starts_on: string;
  ends_on: string;
  status: "open" | "closed";
  notes: string | null;
  created_at: string;
};

type PackRow = {
  id: string;
  review_period_id: string;
  scope_id: string;
  generated_by: string;
  generated_at: string;
  sections: string[] | null;
  file_path: string | null;
  content_sha256: string | null;
  recipient_note: string | null;
};

type ScopeRow = {
  id: string;
  version: number;
  status: "draft" | "approved" | "superseded";
  approved_at: string | null;
};

type AuditorRow = {
  id: string;
  user_email: string;
  scope_note: string | null;
  expires_at: string | null;
  granted_by: string | null;
  created_at: string;
};

// ── server actions ─────────────────────────────────────────────

async function createPeriod(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const label = String(formData.get("label") || "").trim();
  const kind = String(formData.get("kind") || "");
  const startsOn = String(formData.get("starts_on") || "").trim();
  const endsOn = String(formData.get("ends_on") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  if (!label || !startsOn || !endsOn) return;
  if (!(PERIOD_KINDS as readonly string[]).includes(kind)) return;

  const db = createServiceClient();
  const { data: created, error } = await db
    .from("soc2_review_periods")
    .insert({
      label,
      kind,
      starts_on: startsOn,
      ends_on: endsOn,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;

  await logSoc2Event({
    recordType: "review_period",
    recordId: created.id,
    type: "created",
    summary: `Review period "${label}" (${kind.replace(/_/g, " ")}) opened: ${startsOn} to ${endsOn}.`,
    detail: { kind, starts_on: startsOn, ends_on: endsOn },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function closePeriod(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id || confirm !== "CLOSE") return;

  const db = createServiceClient();
  const { data: period } = await db
    .from("soc2_review_periods")
    .select("id, label, status")
    .eq("id", id)
    .maybeSingle();
  if (!period || period.status === "closed") return;

  const { error } = await db
    .from("soc2_review_periods")
    .update({ status: "closed" })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "review_period",
    recordId: id,
    type: "closed",
    summary: `Review period "${period.label}" closed by ${guard.email}.`,
    detail: { previous_status: period.status },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function generatePack(formData: FormData) {
  "use server";
  // Pack generation is a hand-over decision: Programme Owner or Evidence
  // Reviewer only — the roles accountable for what leaves the system.
  const guard = await requireSoc2("programme_owner", "evidence_reviewer");
  if (!guard.ok) return;

  const reviewPeriodId = String(formData.get("review_period_id") || "").trim();
  const scopeId = String(formData.get("scope_id") || "").trim();
  const recipientNote = String(formData.get("recipient_note") || "").trim();
  const sections = formData
    .getAll("sections")
    .map(String)
    .filter((s): s is PackSection => (PACK_SECTIONS as readonly string[]).includes(s));
  if (!reviewPeriodId || !scopeId) return;

  const result = await buildAuditPack({
    reviewPeriodId,
    scopeId,
    sections,
    generatedBy: guard.email,
    recipientNote: recipientNote || undefined,
  });
  // The pack row, storage object and 'generated' trail event are all written
  // inside buildAuditPack — this action only surfaces failure.
  if (!result.ok) redirect(`${PAGE}?err=${encodeURIComponent(result.error)}`);
  revalidatePath(PAGE);
}

async function grantAuditor(formData: FormData) {
  "use server";
  // Auditor access is an explicit Administrator invitation: Programme Owner only.
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;

  const email = String(formData.get("user_email") || "").trim().toLowerCase();
  const expiresAt = String(formData.get("expires_at") || "").trim();
  const scopeNote = String(formData.get("scope_note") || "").trim();
  if (!email || !email.includes("@")) return;

  // Expiry is mandatory and short: after today, at most 90 days out. The DB
  // trigger independently refuses any auditor row without an expiry.
  const today = toDateOnly(new Date());
  const maxExpiry = addDays(today, 90);
  if (!expiresAt || expiresAt <= today || expiresAt > maxExpiry) return;

  const db = createServiceClient();
  const { data: created, error } = await db
    .from("soc2_programme_roles")
    .insert({
      user_email: email,
      role: "auditor",
      scope_note: scopeNote || null,
      expires_at: expiresAt,
      granted_by: guard.email,
    })
    .select("id")
    .single();
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;

  await logSoc2Event({
    recordType: "programme_role",
    recordId: created.id,
    type: "granted",
    summary: `Read-only auditor access granted to ${email} by ${guard.email}, expiring ${expiresAt}.`,
    detail: { role: "auditor", expires_at: expiresAt, scope_note: scopeNote || null },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function revokeAuditor(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  if (!id) return;

  const db = createServiceClient();
  const { data: row } = await db
    .from("soc2_programme_roles")
    .select("id, user_email, role")
    .eq("id", id)
    .eq("role", "auditor")
    .maybeSingle();
  if (!row) return;

  const { error } = await db.from("soc2_programme_roles").delete().eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "programme_role",
    recordId: id,
    type: "revoked",
    summary: `Auditor access for ${row.user_email} revoked by ${guard.email}.`,
    detail: { role: "auditor" },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

// ── page ───────────────────────────────────────────────────────

const PERIOD_GRID = "1.6fr 130px 110px 110px 90px";
const PACK_GRID = "130px 1.3fr 80px 1.1fr 80px 140px 110px";
const AUDITOR_GRID = "1.3fr 1.3fr 150px 1fr 110px";

const KIND_TONE: Record<PeriodKind, "accent" | "warning" | "muted"> = {
  readiness: "muted",
  type1_prep: "accent",
  type2_period: "warning",
};

export default async function AuditPackPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  const supabase = await createClient();
  const [
    { data: periodRows },
    { data: packRows },
    { data: scopeRows },
    { data: auditorRows },
  ] = await Promise.all([
    supabase
      .from("soc2_review_periods")
      .select("id, label, kind, starts_on, ends_on, status, notes, created_at")
      .order("starts_on", { ascending: false })
      .limit(200),
    supabase
      .from("soc2_audit_packs")
      .select(
        "id, review_period_id, scope_id, generated_by, generated_at, sections, file_path, content_sha256, recipient_note"
      )
      .order("generated_at", { ascending: false })
      .limit(200),
    supabase
      .from("soc2_scopes")
      .select("id, version, status, approved_at")
      .order("version", { ascending: false }),
    supabase
      .from("soc2_programme_roles")
      .select("id, user_email, scope_note, expires_at, granted_by, created_at")
      .eq("role", "auditor")
      .order("created_at", { ascending: false }),
  ]);
  const periods = (periodRows ?? []) as PeriodRow[];
  const packs = (packRows ?? []) as PackRow[];
  const scopes = (scopeRows ?? []) as ScopeRow[];
  const auditors = (auditorRows ?? []) as AuditorRow[];

  const approvedScopes = scopes.filter((s) => s.status === "approved");
  const periodById = new Map(periods.map((p) => [p.id, p]));
  const scopeById = new Map(scopes.map((s) => [s.id, s]));
  const nowIso = new Date().toISOString();
  const openPeriods = periods.filter((p) => p.status === "open");
  const liveAuditors = auditors.filter((a) => a.expires_at !== null && a.expires_at > nowIso);
  const today = toDateOnly(new Date());
  const maxExpiry = addDays(today, 90);
  const canGenerate = periods.length > 0 && approvedScopes.length > 0;

  const sectionCount = (p: PackRow): number => (Array.isArray(p.sections) ? p.sections.length : 0);

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Audit pack & review periods"
        lead="Review periods, the period-scoped export prepared for an independent auditor, and the read-only access that auditor holds — every generation, download and grant is a named, recorded act."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.05em",
            color: T.danger,
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          ERR: {err}
        </p>
      )}

      <Reveal delay={0.04}>
        <div style={{ marginTop: 22 }}>
          <Panel label="// DISCLAIMER">
            <div className="flex flex-col gap-2">
              <p style={{ ...bodyText, color: "var(--k-fg)" }}>{READINESS_DISCLAIMER}</p>
              <p style={bodyText}>
                Every pack is readiness material prepared for an independent auditor — never a
                certification. Exports are period-scoped, secret-redacted, and never embed
                evidence files: the pack carries the evidence index, and file access stays inside
                the app behind short-lived signed URLs.
              </p>
            </div>
          </Panel>
        </div>
      </Reveal>

      <Reveal delay={0.07}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ marginTop: 18 }}>
          <StatCard
            value={String(openPeriods.length)}
            label="Open review periods"
            sub={openPeriods.length ? "Windows currently collecting records." : undefined}
          />
          <StatCard value={String(packs.length)} label="Packs generated" />
          <StatCard
            value={String(liveAuditors.length)}
            label="Live auditor grants"
            sub={liveAuditors.length ? "Read-only, time-limited access in force." : undefined}
          />
        </div>
      </Reveal>

      {/* (1) Review periods */}
      <Reveal delay={0.1}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// REVIEW PERIODS" pad={false}>
            {periods.length === 0 ? (
              <EmptyRow>
                No review periods yet — open the first window below; packs are always generated
                over a named period.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={PERIOD_GRID}
                  cols={["period", "kind", "starts", "ends", "status"]}
                />
                {periods.map((p, i) => (
                  <details key={p.id}>
                    <summary
                      className="grid md:grid gap-3 items-center px-4 py-2.5"
                      style={{
                        gridTemplateColumns: PERIOD_GRID,
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                        cursor: "pointer",
                        listStyle: "none",
                      }}
                    >
                      <span
                        className="min-w-0"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.85rem",
                          color: "var(--k-fg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={p.label}
                      >
                        {p.label}
                      </span>
                      <span>
                        <StatusChip tone={KIND_TONE[p.kind] ?? "muted"}>
                          {p.kind.replace(/_/g, " ")}
                        </StatusChip>
                      </span>
                      <span style={faintMono}>{shortDate(p.starts_on)}</span>
                      <span style={faintMono}>{shortDate(p.ends_on)}</span>
                      <span>
                        <StatusChip tone={p.status === "open" ? "accent" : "muted"}>
                          {p.status}
                        </StatusChip>
                      </span>
                    </summary>

                    <div
                      className="flex flex-col gap-3 px-4 py-4"
                      style={{
                        borderTop: "1px dashed var(--k-border)",
                        background: "var(--k-bg)",
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <span style={monoLabel}>Notes</span>
                        <span style={{ ...bodyText, whiteSpace: "pre-wrap" }}>
                          {p.notes || "—"}
                        </span>
                      </div>
                      <p style={faintMono}>
                        Created {shortDate(p.created_at)} ·{" "}
                        {packs.filter((k) => k.review_period_id === p.id).length} pack(s)
                        generated over this period.
                      </p>
                      {p.status === "open" && (
                        <form action={closePeriod} className="flex flex-wrap items-center gap-3">
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            name="confirm"
                            placeholder="type CLOSE"
                            autoComplete="off"
                            style={{ ...inp, fontFamily: T.mono, width: 130 }}
                          />
                          <SubmitButton style={dangerBtn}>Close period</SubmitButton>
                          <p style={faintMono}>
                            Freezes the reporting window. Packs can still be generated over a
                            closed period — its records simply stop moving.
                          </p>
                        </form>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}

            <form
              action={createPeriod}
              className="flex flex-wrap items-end gap-3 px-4 py-4"
              style={{ borderTop: "1px solid var(--k-border)" }}
            >
              <Field label="Label" grow>
                <input
                  name="label"
                  style={inp}
                  required
                  maxLength={120}
                  placeholder="e.g. Readiness Q4 2026"
                />
              </Field>
              <Field label="Kind">
                <select name="kind" style={inp} defaultValue="readiness">
                  {PERIOD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Starts on">
                <input name="starts_on" type="date" style={inp} required />
              </Field>
              <Field label="Ends on">
                <input name="ends_on" type="date" style={inp} required />
              </Field>
              <Field label="Notes" grow>
                <input
                  name="notes"
                  style={inp}
                  maxLength={2000}
                  placeholder="What this window is for."
                />
              </Field>
              <SubmitButton style={primaryBtn}>Open period</SubmitButton>
            </form>
          </Panel>
        </div>
      </Reveal>

      {/* (2) Generate a pack */}
      <Reveal delay={0.13}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// GENERATE PACK" title="Prepare an export for an independent auditor">
            {!canGenerate ? (
              <p style={bodyText}>
                {periods.length === 0
                  ? "Open a review period above first — packs are always generated over a named window."
                  : "No approved Scope of System version exists yet. Approve a scope version on the Scope page before generating a pack; packs are only ever built against an approved scope."}
              </p>
            ) : (
              <form action={generatePack} className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  <Field label="Review period" grow>
                    <select name="review_period_id" style={inp} required defaultValue="">
                      <option value="" disabled>
                        Select a period…
                      </option>
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} — {p.status} ({shortDate(p.starts_on)} to{" "}
                          {shortDate(p.ends_on)})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Scope version (approved only)" grow>
                    <select name="scope_id" style={inp} required defaultValue="">
                      <option value="" disabled>
                        Select a scope…
                      </option>
                      {approvedScopes.map((s) => (
                        <option key={s.id} value={s.id}>
                          v{s.version} — approved {shortDate(s.approved_at)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span style={monoLabel}>Sections included</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {PACK_SECTIONS.map((s) => (
                      <label key={s} className="flex items-center gap-1.5" style={faintMono}>
                        <input
                          type="checkbox"
                          name="sections"
                          value={s}
                          defaultChecked
                          style={{ accentColor: "var(--k-accent)" }}
                        />
                        {s.replace(/_/g, " ")}
                      </label>
                    ))}
                  </div>
                </div>
                <Field label="Recipient note (who this pack is being prepared for)" grow>
                  <input
                    name="recipient_note"
                    style={inp}
                    maxLength={300}
                    placeholder="e.g. Fieldwork request from <firm>, engagement letter ref"
                  />
                </Field>
                <div>
                  <SubmitButton style={primaryBtn}>Generate pack</SubmitButton>
                </div>
                <p style={faintMono}>
                  Programme Owner or Evidence Reviewer only. The export is period-scoped and
                  secret-redacted; evidence files are indexed, never embedded. The pack is stored
                  in the private evidence bucket with a content hash and the generation is
                  recorded on the trail.
                </p>
              </form>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* (3) Generated packs */}
      <Reveal delay={0.16}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// GENERATED PACKS" pad={false}>
            {packs.length === 0 ? (
              <EmptyRow>
                No packs generated yet — pick a review period and an approved scope above to
                prepare the first export.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={PACK_GRID}
                  cols={[
                    "generated",
                    "period",
                    "scope",
                    "generated by",
                    "sections",
                    "sha-256",
                    "download",
                  ]}
                />
                {packs.map((p, i) => {
                  const period = periodById.get(p.review_period_id);
                  const scope = scopeById.get(p.scope_id);
                  return (
                    <details key={p.id}>
                      <summary
                        className="grid md:grid gap-3 items-center px-4 py-2.5"
                        style={{
                          gridTemplateColumns: PACK_GRID,
                          borderTop: i ? "1px solid var(--k-border)" : "none",
                          cursor: "pointer",
                          listStyle: "none",
                        }}
                      >
                        <span style={faintMono}>{shortDate(p.generated_at)}</span>
                        <span
                          className="min-w-0"
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.85rem",
                            color: "var(--k-fg)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={period?.label ?? undefined}
                        >
                          {period?.label ?? "—"}
                        </span>
                        <span style={faintMono}>{scope ? `v${scope.version}` : "—"}</span>
                        <span
                          className="min-w-0"
                          style={{
                            ...faintMono,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={p.generated_by}
                        >
                          {p.generated_by}
                        </span>
                        <span style={faintMono}>{sectionCount(p)}</span>
                        <span style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.content_sha256 ? `${p.content_sha256.slice(0, 14)}…` : "—"}
                        </span>
                        <span>
                          {p.file_path ? (
                            <Link
                              href={`/admin/soc2/audit-pack/${p.id}/download`}
                              prefetch={false}
                              style={{
                                ...actionBtn,
                                display: "inline-flex",
                                alignItems: "center",
                                textDecoration: "none",
                              }}
                            >
                              ↓ Download
                            </Link>
                          ) : (
                            <StatusChip tone="warning">no file</StatusChip>
                          )}
                        </span>
                      </summary>

                      <div
                        className="flex flex-col gap-2 px-4 py-4"
                        style={{
                          borderTop: "1px dashed var(--k-border)",
                          background: "var(--k-bg)",
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          <span style={monoLabel}>Sections</span>
                          <span style={bodyText}>
                            {Array.isArray(p.sections) && p.sections.length > 0
                              ? p.sections.map((s) => s.replace(/_/g, " ")).join(", ")
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span style={monoLabel}>Recipient note</span>
                          <span style={{ ...bodyText, whiteSpace: "pre-wrap" }}>
                            {p.recipient_note || "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span style={monoLabel}>Content SHA-256</span>
                          <span style={{ ...faintMono, wordBreak: "break-all" }}>
                            {p.content_sha256 ?? "—"}
                          </span>
                        </div>
                        <p style={faintMono}>
                          Downloads go through a short-lived signed URL and each one is recorded
                          on this pack&apos;s trail.
                        </p>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* (4) Auditor access */}
      <Reveal delay={0.19}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// AUDITOR ACCESS" pad={false}>
            <p style={{ ...bodyText, padding: "14px 16px 4px" }}>
              Auditor access is read-only, time-limited, and exists only by explicit
              Administrator invitation. An auditor can hold no write role anywhere in the
              programme, and generated packs — not live screens — are the intended surface for
              their review.
            </p>
            {auditors.length === 0 ? (
              <EmptyRow>
                No auditor access has been granted — invite one below when an engagement starts;
                every grant carries a mandatory expiry.
              </EmptyRow>
            ) : (
              <div className="flex flex-col" style={{ marginTop: 8 }}>
                <HeaderRow
                  grid={AUDITOR_GRID}
                  cols={["email", "scope note", "expires", "granted by", ""]}
                />
                {auditors.map((a, i) => {
                  const expired = a.expires_at !== null && a.expires_at <= nowIso;
                  return (
                    <div
                      key={a.id}
                      className="grid md:grid gap-3 items-center px-4 py-2.5"
                      style={{
                        gridTemplateColumns: AUDITOR_GRID,
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                      }}
                    >
                      <span
                        className="min-w-0"
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.85rem",
                          color: "var(--k-fg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={a.user_email}
                      >
                        {a.user_email}
                      </span>
                      <span
                        className="min-w-0"
                        style={{
                          ...bodyText,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={a.scope_note ?? undefined}
                      >
                        {a.scope_note || "—"}
                      </span>
                      <span className="flex items-center gap-2">
                        <span style={faintMono}>{shortDate(a.expires_at)}</span>
                        {expired && <StatusChip tone="muted">expired</StatusChip>}
                      </span>
                      <span
                        className="min-w-0"
                        style={{
                          ...faintMono,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={a.granted_by ?? undefined}
                      >
                        {a.granted_by ?? "—"}
                      </span>
                      <form action={revokeAuditor}>
                        <input type="hidden" name="id" value={a.id} />
                        <SubmitButton style={dangerBtn}>Revoke</SubmitButton>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}

            <form
              action={grantAuditor}
              className="flex flex-wrap items-end gap-3 px-4 py-4"
              style={{ borderTop: "1px solid var(--k-border)" }}
            >
              <Field label="Auditor email" grow>
                <input name="user_email" type="email" style={inp} required maxLength={200} />
              </Field>
              <Field label="Expires (required, max 90 days)">
                <input
                  name="expires_at"
                  type="date"
                  style={inp}
                  required
                  min={addDays(today, 1)}
                  max={maxExpiry}
                />
              </Field>
              <Field label="Scope note (which records this engagement covers)" grow>
                <input name="scope_note" style={inp} maxLength={300} />
              </Field>
              <SubmitButton style={primaryBtn}>Grant auditor access</SubmitButton>
              <p className="w-full" style={faintMono}>
                Programme Owner only. Expiry is validated server-side to at most 90 days from
                today, and the database refuses any auditor row without one.
              </p>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
