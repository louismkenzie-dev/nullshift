import { createServiceClient } from "@nullshift/db";
import { sendEmail } from "@/lib/sendEmail";
import { esc, wrap } from "@/lib/emailLayout";
import {
  DEFAULT_ENGINE_CONFIG,
  EVER_DEDUPE_RULES,
  runRules,
  routeAlert,
  shouldRaise,
  type EngineConfig,
  type SweepSnapshot,
} from "./rules";
import type { ExceptionSeverity } from "./types";
import { FREQUENCY_DAYS, addDays, runFireKey, toDateOnly, withinLeadWindow } from "./schedule";
import { logSoc2Event } from "./events";
import { detectActiveIntegrations } from "./seed";

/**
 * The readiness sweep — scheduled evidence requests + exception detection +
 * alert routing, in one idempotent pass. Runs daily from the cron route and
 * on demand from Settings ("Run sweep now").
 *
 * Idempotency, three ways (all DB-enforced or recorded):
 *  · control runs use deterministic fire keys + a unique index;
 *  · exceptions dedupe on fire keys (open ones block re-raising; a handful of
 *    one-shot rules dedupe against ALL history — closing "we reviewed this
 *    denial" must not resurrect it);
 *  · alert emails stamp `alerted_at` into the exception's detail so a re-run
 *    never re-sends.
 *
 * The sweep DOWNGRADES honestly too: a rule-raised exception whose condition
 * is no longer detected moves to resolved_pending_verification with a note —
 * a human still verifies and closes it. The sweep never closes anything: the
 * closure gate (owner remediation + independent verification) is a DB trigger
 * and applies to the machine as much as to people.
 */

const DUE_DAYS: Record<ExceptionSeverity, number> = {
  critical: 2,
  high: 7,
  medium: 30,
  low: 60,
};

export type SweepOutcome = {
  runsScheduled: number;
  exceptionsRaised: number;
  exceptionsAutoResolved: number;
  alertsSent: number;
  escalationsSent: number;
  candidates: number;
};

/* ── snapshot ──────────────────────────────────────────────────── */

/** PostgREST returns a joined relation as object or single-element array. */
function relationKey(rel: unknown): string | null {
  const one = Array.isArray(rel) ? rel[0] : rel;
  return (one as { key?: string } | null)?.key ?? null;
}

export async function buildSnapshot(): Promise<SweepSnapshot> {
  const db = createServiceClient();
  const today = toDateOnly(new Date());
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [
    scopes,
    policies,
    staffRows,
    ackRows,
    versionRows,
    assets,
    risks,
    controls,
    controlRuns,
    evidence,
    vendors,
    accessReviews,
    accessReviewItems,
    breakGlassEvents,
    changeRecords,
    incidents,
    managementReviews,
    sensitiveProjectRows,
    aiAgents,
    aiEscalations,
    aiRefusals,
    aiPolicyDenials,
    allExceptionKeys,
  ] = await Promise.all([
    db.from("soc2_scopes").select("id, version, status"),
    db
      .from("soc2_policies")
      .select(
        "id, key, title, status, review_due_at, requires_acknowledgement, current_version, effective_date"
      ),
    db.from("memberships").select("user_id, role, tenants!inner(type)").eq("tenants.type", "internal"),
    db.from("soc2_policy_acknowledgements").select("policy_version_id, user_email"),
    db.from("soc2_policy_versions").select("id, policy_id, version"),
    db
      .from("soc2_assets")
      .select("id, name, kind, status, in_scope, owner_email, classification, criticality, review_due_at"),
    db.from("soc2_risks").select("id, ref, title, status, owner_email, treatment, review_due_at"),
    db
      .from("soc2_controls")
      .select("id, key, name, status, applicability, owner_email, frequency, next_due_at, tsc_category"),
    db.from("soc2_control_runs").select("id, control_id, due_at, status, performed_at"),
    db.from("soc2_evidence_items").select("id, control_run_id"),
    db
      .from("soc2_vendors")
      .select(
        "id, name, status, data_access, service_dependency, risk_level, owner_email, review_due_at, dpa_status, security_docs"
      ),
    db.from("soc2_access_reviews").select("id, ref, status, due_at, completed_at"),
    db
      .from("soc2_access_review_items")
      .select(
        "id, review_id, system_label, account_identifier, person, privilege, is_shared, mfa_status, decision, decided_at, action_completed_at"
      ),
    db
      .from("soc2_break_glass_events")
      .select("id, system_label, used_by, review_due_at, reviewed_at, expires_at, ended_at"),
    db
      .from("soc2_change_records")
      .select(
        "id, ref, title, status, requested_by, reviewed_by, approved_by, test_evidence, rollback_plan, ticket_ref, deployed_at"
      ),
    db
      .from("soc2_incidents")
      .select(
        "id, ref, severity, status, owner_email, acknowledged_at, containment_summary, detected_at, post_review_due_at, post_review_done_at"
      ),
    db.from("soc2_management_reviews").select("id, held_at"),
    db
      .from("projects")
      .select("id, tenant_id, name, dpa_special_category, dpa_special_category_detail")
      .eq("dpa_special_category", true),
    db.from("agents").select("id, key, name, lifecycle, owner_email, last_activity_at"),
    db.from("agent_escalations").select("id, agent_id, reason, severity, status"),
    db
      .from("ai_tool_invocations")
      .select("id, tool, outcome, started_at, agents(key)")
      .eq("outcome", "refused")
      .gte("started_at", sevenDaysAgo),
    db
      .from("agent_events")
      .select("id, type, created_at, agents(key)")
      .eq("type", "policy.denied")
      .gte("created_at", sevenDaysAgo),
    db.from("soc2_exceptions").select("fire_key, status").not("fire_key", "is", null),
  ]);

  // A failed query must ABORT the sweep, not read as an empty table: an
  // empty-looking snapshot would suppress every candidate and step 5 would
  // "auto-resolve" live exceptions off the back of a network blip.
  const sections: { name: string; error: { message: string } | null }[] = [
    { name: "soc2_scopes", error: scopes.error },
    { name: "soc2_policies", error: policies.error },
    { name: "memberships", error: staffRows.error },
    { name: "soc2_policy_acknowledgements", error: ackRows.error },
    { name: "soc2_policy_versions", error: versionRows.error },
    { name: "soc2_assets", error: assets.error },
    { name: "soc2_risks", error: risks.error },
    { name: "soc2_controls", error: controls.error },
    { name: "soc2_control_runs", error: controlRuns.error },
    { name: "soc2_evidence_items", error: evidence.error },
    { name: "soc2_vendors", error: vendors.error },
    { name: "soc2_access_reviews", error: accessReviews.error },
    { name: "soc2_access_review_items", error: accessReviewItems.error },
    { name: "soc2_break_glass_events", error: breakGlassEvents.error },
    { name: "soc2_change_records", error: changeRecords.error },
    { name: "soc2_incidents", error: incidents.error },
    { name: "soc2_management_reviews", error: managementReviews.error },
    { name: "projects", error: sensitiveProjectRows.error },
    { name: "agents", error: aiAgents.error },
    { name: "agent_escalations", error: aiEscalations.error },
    { name: "ai_tool_invocations", error: aiRefusals.error },
    { name: "agent_events", error: aiPolicyDenials.error },
    { name: "soc2_exceptions", error: allExceptionKeys.error },
  ];
  const failed = sections.filter((sec) => sec.error);
  if (failed.length > 0) {
    throw new Error(
      `SOC 2 sweep aborted — snapshot query failed for ${failed
        .map((sec) => `${sec.name} (${sec.error!.message})`)
        .join("; ")}. Nothing was detected, resolved or alerted.`
    );
  }

  // Staff emails via profiles (memberships drive access; profiles mirror email).
  const staffIds = (staffRows.data ?? [])
    .filter((m) => m.role === "staff" || m.role === "owner")
    .map((m) => m.user_id);
  let staffEmails: string[] = [];
  if (staffIds.length > 0) {
    const { data: profs, error: profsError } = await db
      .from("profiles")
      .select("id, email")
      .in("id", staffIds);
    if (profsError) {
      throw new Error(
        `SOC 2 sweep aborted — snapshot query failed for profiles (${profsError.message}). Nothing was detected, resolved or alerted.`
      );
    }
    staffEmails = (profs ?? []).map((p) => p.email).filter((e): e is string => !!e);
  }

  // policy key → acknowledger emails for the CURRENT version.
  const versionById = new Map((versionRows.data ?? []).map((v) => [v.id, v]));
  const policyByById = new Map((policies.data ?? []).map((p) => [p.id, p]));
  const acknowledgements: Record<string, string[]> = {};
  for (const ack of ackRows.data ?? []) {
    const v = versionById.get(ack.policy_version_id);
    if (!v) continue;
    const p = policyByById.get(v.policy_id);
    if (!p || v.version !== p.current_version) continue;
    (acknowledgements[p.key] ??= []).push(ack.user_email);
  }

  const runEvidenceCounts: Record<string, number> = {};
  for (const e of evidence.data ?? []) {
    if (e.control_run_id) {
      runEvidenceCounts[e.control_run_id] = (runEvidenceCounts[e.control_run_id] ?? 0) + 1;
    }
  }

  const everKeys = new Set((allExceptionKeys.data ?? []).map((e) => e.fire_key as string));

  return {
    today,
    scopes: scopes.data ?? [],
    policies: policies.data ?? [],
    staffEmails,
    acknowledgements,
    assets: assets.data ?? [],
    risks: risks.data ?? [],
    controls: controls.data ?? [],
    controlRuns: controlRuns.data ?? [],
    runEvidenceCounts,
    vendors: (vendors.data ?? []).map((v) => ({
      ...v,
      security_docs: (v.security_docs ?? []) as SweepSnapshot["vendors"][number]["security_docs"],
    })),
    activeIntegrations: detectActiveIntegrations(),
    accessReviews: accessReviews.data ?? [],
    accessReviewItems: accessReviewItems.data ?? [],
    breakGlassEvents: breakGlassEvents.data ?? [],
    changeRecords: changeRecords.data ?? [],
    incidents: incidents.data ?? [],
    managementReviews: managementReviews.data ?? [],
    sensitiveProjects: (sensitiveProjectRows.data ?? []).map((p) => ({
      id: p.id,
      tenant_id: p.tenant_id,
      name: p.name,
      detail: p.dpa_special_category_detail,
      reviewed: everKeys.has(`data.sensitive_project_review:${p.id}`),
    })),
    aiAgents: aiAgents.data ?? [],
    aiEscalations: (aiEscalations.data ?? []).map((e) => ({
      id: e.id,
      agent_id: e.agent_id,
      kind: `${e.severity}: ${e.reason}`.slice(0, 120),
      severity: e.severity,
      status: e.status,
    })),
    aiDenials: [
      ...(aiRefusals.data ?? []).map((r) => ({
        id: r.id,
        source: "tool_invocation" as const,
        agent_key: relationKey(r.agents),
        tool: r.tool,
        at: r.started_at,
      })),
      ...(aiPolicyDenials.data ?? []).map((r) => ({
        id: r.id,
        source: "policy" as const,
        agent_key: relationKey(r.agents),
        tool: null,
        at: r.created_at,
      })),
    ],
  };
}

/* ── engine config from ops_settings ───────────────────────────── */

export async function loadEngineConfig(): Promise<EngineConfig> {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("ops_settings")
      .select("value")
      .eq("key", "soc2_engine")
      .maybeSingle();
    return { ...DEFAULT_ENGINE_CONFIG, ...((data?.value as Partial<EngineConfig>) ?? {}) };
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

/* ── the sweep ─────────────────────────────────────────────────── */

export async function runSweep(trigger: "cron" | "manual", actor: string): Promise<SweepOutcome> {
  const db = createServiceClient();
  const config = await loadEngineConfig();
  const snapshot = await buildSnapshot();
  const today = snapshot.today;
  const outcome: SweepOutcome = {
    runsScheduled: 0,
    exceptionsRaised: 0,
    exceptionsAutoResolved: 0,
    alertsSent: 0,
    escalationsSent: 0,
    candidates: 0,
  };

  /* 1 · Materialise evidence requests (scheduled control runs). Dedupe is the
     unique fire_key index — the upsert below is a no-op on a repeat. */
  for (const control of snapshot.controls) {
    if (control.status !== "active" || control.applicability !== "applicable") continue;
    if (!control.next_due_at) continue;
    if (FREQUENCY_DAYS[control.frequency as keyof typeof FREQUENCY_DAYS] === null) continue;
    if (!withinLeadWindow(control.next_due_at, today)) continue;
    const fireKey = runFireKey(control.key, control.next_due_at);
    const { data: inserted, error } = await db
      .from("soc2_control_runs")
      .upsert(
        {
          control_id: control.id,
          fire_key: fireKey,
          due_at: control.next_due_at,
          period_start: null,
          period_end: control.next_due_at,
        },
        { onConflict: "fire_key", ignoreDuplicates: true }
      )
      .select("id");
    if (!error && inserted && inserted.length > 0) outcome.runsScheduled += 1;
  }

  /* 2 · Run the rules. */
  const candidates = runRules(snapshot, config);
  outcome.candidates = candidates.length;

  const { data: existing } = await db
    .from("soc2_exceptions")
    .select("id, fire_key, status, detail")
    .not("fire_key", "is", null);
  const openByKey = new Map(
    (existing ?? [])
      .filter((e) => e.status !== "closed" && e.status !== "not_applicable")
      .map((e) => [e.fire_key as string, e])
  );
  const everKeys = new Set((existing ?? []).map((e) => e.fire_key as string));

  const controlByKey = new Map(snapshot.controls.map((c) => [c.key, c]));
  const programmeOwners = await ownersFromRoles(db);

  /* 3 · Raise what's new. */
  for (const cand of candidates) {
    if (!shouldRaise(cand.ruleKey, cand.fireKey, new Set(openByKey.keys()), everKeys)) continue;

    const control = cand.controlKey ? controlByKey.get(cand.controlKey) : undefined;
    const ownerEmail = control?.owner_email ?? programmeOwners[0] ?? null;
    const { data: ref } = await db.rpc("next_soc2_exception_ref");
    const { data: created, error } = await db
      .from("soc2_exceptions")
      .insert({
        ref: ref ?? `EXC-${today.slice(0, 4)}-X${Math.floor(Math.random() * 9000 + 1000)}`,
        control_id: control?.id ?? null,
        rule_key: cand.ruleKey,
        fire_key: cand.fireKey,
        title: cand.title,
        detail: cand.detail,
        severity: cand.severity,
        severity_rationale: cand.severityRationale,
        source: cand.source,
        trigger_ref: cand.triggerRef,
        affected: cand.affected as never,
        owner_email: ownerEmail,
        due_at: addDays(today, DUE_DAYS[cand.severity]),
        recommended_action: cand.recommendedAction,
        status: cand.severity === "critical" || cand.severity === "high" ? "triage_required" : "detected",
      })
      .select("id, ref")
      .single();
    if (error || !created) continue;
    outcome.exceptionsRaised += 1;
    openByKey.set(cand.fireKey, { id: created.id, fire_key: cand.fireKey, status: "detected", detail: null });
    everKeys.add(cand.fireKey);

    await logSoc2Event({
      recordType: "exception",
      recordId: created.id,
      type: "detected",
      summary: `${created.ref} raised by rule ${cand.ruleKey} (${cand.severity}).`,
      detail: { rule: cand.ruleKey, severity: cand.severity, trigger: cand.triggerRef },
      actor: `system:sweep(${trigger})`,
      asService: true,
    });

    /* 4 · Route the alert. */
    const route = routeAlert(cand.severity, {
      programmeOwners,
      controlOwner: control?.owner_email ?? null,
      incidentCandidate: cand.incidentCandidate,
    });
    if (route.notifyNow.length > 0) {
      const sent = await sendExceptionAlert(route.notifyNow, {
        ref: created.ref,
        title: cand.title,
        severity: cand.severity,
        recommendedAction: cand.recommendedAction,
        incidentCandidate: route.incidentCandidate,
      });
      if (sent) {
        outcome.alertsSent += 1;
        await db
          .from("soc2_exceptions")
          .update({
            detail: `${cand.detail}\n\n[alerted ${new Date().toISOString()} → ${route.notifyNow.join(", ")}]`,
          })
          .eq("id", created.id);
      }
    }
  }

  /* 5 · Downgrade honestly: open rule exceptions whose condition cleared. */
  const liveKeys = new Set(candidates.map((c) => c.fireKey));
  for (const [key, row] of openByKey) {
    if (liveKeys.has(key)) continue;
    if (row.status === "resolved_pending_verification") continue;
    // Only rule-raised rows auto-move; manual declarations stay human-owned.
    const { data: full } = await db
      .from("soc2_exceptions")
      .select("id, ref, rule_key, source, status, resolution_note")
      .eq("id", row.id)
      .maybeSingle();
    if (!full || !full.rule_key || full.status === "resolved_pending_verification") continue;
    // One-shot rules (EVER_DEDUPE) reference an immutable past fact — a denial,
    // a self-approved change. Their candidates naturally age out of the
    // detection window, which is NOT the condition clearing: they stay open
    // until a human works them.
    if (EVER_DEDUPE_RULES.has(full.rule_key)) continue;
    const { error } = await db
      .from("soc2_exceptions")
      .update({
        status: "resolved_pending_verification",
        resolution_note:
          (full.resolution_note ? full.resolution_note + "\n\n" : "") +
          `Condition no longer detected by rule re-run on ${today}. A reviewer must verify and close.`,
        resolved_by: "system:sweep",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", full.id);
    if (!error) {
      outcome.exceptionsAutoResolved += 1;
      await logSoc2Event({
        recordType: "exception",
        recordId: full.id,
        type: "auto_resolved",
        summary: `${full.ref}: condition cleared; awaiting reviewer verification.`,
        actor: `system:sweep(${trigger})`,
        asService: true,
      });
    }
  }

  /* 6 · Escalate high-severity exceptions unacknowledged past SLA. */
  const { data: stale } = await db
    .from("soc2_exceptions")
    .select("id, ref, title, severity, owner_email, detected_at, triaged_at, detail")
    .in("status", ["detected", "triage_required"])
    .in("severity", ["critical", "high"]);
  for (const e of stale ?? []) {
    const ageDays = (Date.now() - new Date(e.detected_at).getTime()) / 864e5;
    const slaDays = e.severity === "critical" ? 1 : 3;
    if (e.triaged_at || ageDays < slaDays) continue;
    if ((e.detail ?? "").includes("[escalated ")) continue;
    const to = [...new Set([...(e.owner_email ? [e.owner_email] : []), ...programmeOwners])];
    if (to.length === 0) continue;
    const sent = await sendEmail({
      to,
      subject: `[SOC 2 readiness] Unacknowledged ${e.severity} exception ${e.ref}`,
      purpose: "transactional",
      html: wrap(
        `<p><strong>${esc(e.ref)}</strong> — ${esc(e.title)}</p>
         <p>This ${esc(e.severity)} exception has had no triage decision for ${Math.floor(ageDays)} day(s).
         Review it under Security &amp; SOC 2 Readiness → Exceptions.</p>`,
        `Exception ${e.ref} awaiting triage`
      ),
    });
    if (sent) {
      outcome.escalationsSent += 1;
      await db
        .from("soc2_exceptions")
        .update({ detail: `${e.detail ?? ""}\n\n[escalated ${new Date().toISOString()}]` })
        .eq("id", e.id);
    }
  }

  await logSoc2Event({
    recordType: "settings",
    recordId: "00000000-0000-0000-0000-000000000000",
    type: "sweep.completed",
    summary: `Sweep (${trigger}): ${outcome.runsScheduled} evidence requests, ${outcome.exceptionsRaised} exceptions raised, ${outcome.exceptionsAutoResolved} auto-resolved pending verification, ${outcome.alertsSent} alerts, ${outcome.escalationsSent} escalations.`,
    detail: { ...outcome },
    actor: actor,
    asService: true,
  });

  return outcome;
}

async function ownersFromRoles(db: ReturnType<typeof createServiceClient>): Promise<string[]> {
  const { data } = await db
    .from("soc2_programme_roles")
    .select("user_email, role, expires_at")
    .eq("role", "programme_owner");
  const now = new Date().toISOString();
  return (data ?? [])
    .filter((r) => !r.expires_at || r.expires_at > now)
    .map((r) => r.user_email);
}

/**
 * Alert email. Deliberately terse: ref, title, severity, next step. No log
 * contents, no secrets, no client personal data — the record itself lives
 * behind the staff-gated area. Exported so human-declared critical/high
 * exceptions alert immediately too, not only rule-raised ones.
 */
export async function sendExceptionAlert(
  to: string[],
  e: {
    ref: string;
    title: string;
    severity: ExceptionSeverity;
    recommendedAction: string;
    incidentCandidate: boolean;
  }
): Promise<boolean> {
  return sendEmail({
    to,
    subject: `[SOC 2 readiness] ${e.severity.toUpperCase()} exception ${e.ref}`,
    purpose: "transactional",
    html: wrap(
      `<p><strong>${esc(e.ref)}</strong> — ${esc(e.title)}</p>
       <p>Severity: ${esc(e.severity)}.${e.incidentCandidate ? " This looks like an incident candidate — consider opening an incident record." : ""}</p>
       <p>Recommended action: ${esc(e.recommendedAction)}</p>
       <p>Triage it under Security &amp; SOC 2 Readiness → Exceptions. An exception means a configured control may not have been performed, may have failed, or needs review — it is not a compliance verdict.</p>`,
      `Control exception ${e.ref} detected`
    ),
  });
}
