import { createHash } from "node:crypto";
import { createServiceClient } from "@nullshift/db";
import { redactSecrets } from "@/lib/ai/impact";
import { logSoc2Event } from "./events";
import { withinPeriod, overlapsPeriod } from "./schedule";

/**
 * Audit pack builder — the controlled export a Programme Owner prepares for a
 * qualified independent SOC auditor or external adviser.
 *
 * Guarantees, in order of importance:
 *  · Secret-free: every string in the pack passes the same key- and
 *    value-shape redaction the AI logs use (lib/ai/impact.ts), and evidence
 *    FILES are never embedded — the pack carries the evidence INDEX (title,
 *    source, hash, period, reviewer), with controlled access to files staying
 *    inside the app via signed, expiring URLs.
 *  · Period-scoped: only records overlapping the chosen review period are
 *    included; restricted-classification evidence appears as index metadata
 *    with its notes withheld.
 *  · A pack is itself a record: stored in the private evidence bucket with a
 *    content hash, indexed in soc2_audit_packs, and audit-logged.
 *
 * The pack's cover sheet repeats the language contract: readiness material for
 * an independent examination — not a certification, not a compliance verdict.
 */

export const PACK_SECTIONS = [
  "scope",
  "roles",
  "control_matrix",
  "policies",
  "evidence_index",
  "exceptions",
  "vendors",
  "risks",
  "incidents",
  "management_reviews",
] as const;
export type PackSection = (typeof PACK_SECTIONS)[number];

type Period = { id: string; label: string; starts_on: string; ends_on: string };

export async function buildAuditPack(opts: {
  reviewPeriodId: string;
  scopeId: string;
  sections: PackSection[];
  generatedBy: string;
  recipientNote?: string;
}): Promise<{ ok: true; packId: string; path: string; sha256: string } | { ok: false; error: string }> {
  const db = createServiceClient();

  const [{ data: period }, { data: scope }] = await Promise.all([
    db
      .from("soc2_review_periods")
      .select("id, label, starts_on, ends_on, kind")
      .eq("id", opts.reviewPeriodId)
      .maybeSingle(),
    db
      .from("soc2_scopes")
      .select("id, version, status, service_description, tsc_categories, rationale, approved_by, approved_at")
      .eq("id", opts.scopeId)
      .maybeSingle(),
  ]);
  if (!period) return { ok: false, error: "Review period not found." };
  if (!scope) return { ok: false, error: "Scope not found." };
  if (scope.status !== "approved") {
    return { ok: false, error: "Audit packs are generated against an APPROVED scope version only." };
  }

  const p = period as Period;
  const sections = opts.sections.length > 0 ? opts.sections : [...PACK_SECTIONS];
  const pack: Record<string, unknown> = {
    cover: {
      organisation: "Null Shift Development",
      prepared: new Date().toISOString(),
      prepared_by: opts.generatedBy,
      review_period: { label: p.label, from: p.starts_on, to: p.ends_on },
      scope_version: scope.version,
      statement:
        "Readiness material prepared for review by a qualified independent SOC 2 auditor. " +
        "Contents describe controls implemented, evidence collected and exceptions recorded for the stated period. " +
        "This pack is not a certification, an audit report, or a statement of compliance; " +
        "the independent auditor determines scope sufficiency and the report conclusion.",
    },
  };

  if (sections.includes("scope")) {
    const { data: items } = await db
      .from("soc2_scope_items")
      .select("kind, label, detail, sort")
      .eq("scope_id", scope.id)
      .order("kind")
      .order("sort");
    pack.scope = {
      version: scope.version,
      approved_by: scope.approved_by,
      approved_at: scope.approved_at,
      service_description: scope.service_description,
      tsc_categories: scope.tsc_categories,
      rationale: scope.rationale,
      items: items ?? [],
    };
  }

  if (sections.includes("roles")) {
    const { data: roles } = await db
      .from("soc2_programme_roles")
      .select("user_email, role, scope_note, expires_at, created_at");
    pack.roles = roles ?? [];
  }

  if (sections.includes("control_matrix")) {
    const [{ data: controls }, { data: runs }] = await Promise.all([
      db
        .from("soc2_controls")
        .select(
          "id, key, tsc_category, tsc_refs, name, objective, owner_email, frequency, test_procedure, evidence_requirements, policy_key, applicability, na_reason, status"
        )
        .order("key"),
      db
        .from("soc2_control_runs")
        .select("control_id, due_at, status, result, performed_by, performed_at, reviewer_email, review_result")
        .gte("due_at", p.starts_on)
        .lte("due_at", p.ends_on),
    ]);
    const runsByControl = new Map<string, unknown[]>();
    for (const r of runs ?? []) {
      const list = runsByControl.get(r.control_id) ?? [];
      list.push({ ...r, control_id: undefined });
      runsByControl.set(r.control_id, list);
    }
    pack.control_matrix = (controls ?? []).map((c) => ({
      ...c,
      id: undefined,
      period_runs: runsByControl.get(c.id) ?? [],
    }));
  }

  if (sections.includes("policies")) {
    const [{ data: policies }, { data: versions }] = await Promise.all([
      db
        .from("soc2_policies")
        .select("id, key, title, status, owner_email, approver_email, current_version, effective_date, review_due_at"),
      db
        .from("soc2_policy_versions")
        .select("policy_id, version, status, approved_by, approved_at, changelog, created_at"),
    ]);
    pack.policies = (policies ?? []).map((pol) => ({
      ...pol,
      id: undefined,
      versions: (versions ?? [])
        .filter((v) => v.policy_id === pol.id)
        .map((v) => ({ ...v, policy_id: undefined })),
    }));
  }

  if (sections.includes("evidence_index")) {
    const { data: evidence } = await db
      .from("soc2_evidence_items")
      .select(
        "id, control_id, control_run_id, title, source, source_ref, capture_date, period_start, period_end, collected_by, reviewer_email, review_result, classification, content_sha256, file_mime, file_bytes, notes"
      )
      .gte("capture_date", p.starts_on)
      .lte("capture_date", p.ends_on)
      .order("capture_date");
    pack.evidence_index = (evidence ?? []).map((e) => ({
      ...e,
      // Restricted evidence: the index proves existence and integrity; its
      // free text stays inside the controlled system.
      notes: e.classification === "restricted" ? "[withheld — restricted classification]" : e.notes,
    }));
  }

  if (sections.includes("exceptions")) {
    const { data: exceptions } = await db
      .from("soc2_exceptions")
      .select(
        "ref, rule_key, title, detail, severity, severity_rationale, status, source, detected_at, owner_email, due_at, recommended_action, compensating_control, triage_decision, triaged_by, triaged_at, remediation_plan, resolution_note, resolved_by, resolved_at, verified_by, verified_at, verification_note, na_reason, created_at"
      )
      .order("detected_at");
    pack.exceptions = (exceptions ?? []).filter((e) =>
      overlapsPeriod(e.detected_at, e.resolved_at, p)
    );
  }

  if (sections.includes("vendors")) {
    const { data: vendors } = await db
      .from("soc2_vendors")
      .select(
        "name, service, subprocessor_id, data_access, service_dependency, owner_email, risk_level, security_docs, dpa_status, contract_status, transfer_note, status, approved_by, approved_at, last_review_at, review_due_at"
      )
      .order("name");
    pack.vendors = vendors ?? [];
  }

  if (sections.includes("risks")) {
    const { data: risks } = await db
      .from("soc2_risks")
      .select(
        "ref, title, description, category, likelihood, impact, treatment, treatment_plan, owner_email, residual_likelihood, residual_impact, status, accepted_by, accepted_at, review_due_at, created_at"
      )
      .order("ref");
    pack.risks = risks ?? [];
  }

  if (sections.includes("incidents")) {
    const { data: incidents } = await db
      .from("soc2_incidents")
      .select(
        "ref, title, classification, severity, status, detected_at, owner_email, acknowledged_at, impact_summary, containment_summary, notification_decision, notification_note, lessons_learned, post_review_due_at, post_review_done_at"
      )
      .order("detected_at");
    pack.incidents = (incidents ?? []).filter((i) =>
      overlapsPeriod(i.detected_at, i.post_review_done_at, p)
    );
  }

  if (sections.includes("management_reviews")) {
    const { data: reviews } = await db
      .from("soc2_management_reviews")
      .select("held_at, attendees, summary, decisions, next_due_at, recorded_by")
      .order("held_at");
    pack.management_reviews = (reviews ?? []).filter((r) => withinPeriod(r.held_at, p));
  }

  // Redact the ENTIRE pack by key and value shape — belt and braces on top of
  // the no-secrets-in-text rule enforced at capture time.
  const redacted = redactSecrets(pack);
  const body = JSON.stringify(redacted, null, 2);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const path = `audit-packs/${p.label.replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase()}-${Date.now()}.json`;

  const { error: uploadError } = await db.storage
    .from("soc2-evidence")
    .upload(path, new Blob([body], { type: "application/json" }), {
      contentType: "application/json",
      upsert: false,
    });
  if (uploadError) return { ok: false, error: `Pack storage failed: ${uploadError.message}` };

  const { data: row, error: insertError } = await db
    .from("soc2_audit_packs")
    .insert({
      review_period_id: p.id,
      scope_id: scope.id,
      generated_by: opts.generatedBy,
      sections: sections as never,
      file_path: path,
      content_sha256: sha256,
      recipient_note: opts.recipientNote ?? null,
    })
    .select("id")
    .single();
  if (insertError || !row) return { ok: false, error: insertError?.message ?? "Pack index insert failed." };

  await logSoc2Event({
    recordType: "audit_pack",
    recordId: row.id,
    type: "generated",
    summary: `Audit pack generated for ${p.label} (scope v${scope.version}): ${sections.join(", ")}.`,
    detail: { sha256, sections },
    actor: opts.generatedBy,
    asService: true,
  });

  return { ok: true, packId: row.id, path, sha256 };
}

/** Short-lived signed URL for a stored pack (default 10 minutes). */
export async function signedPackUrl(path: string, expiresInSeconds = 600): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db.storage.from("soc2-evidence").createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}
