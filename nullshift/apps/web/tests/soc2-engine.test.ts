import { describe, it, expect } from "vitest";
import {
  DEFAULT_ENGINE_CONFIG,
  runRules,
  routeAlert,
  shouldRaise,
  EVER_DEDUPE_RULES,
  type SweepSnapshot,
} from "@/lib/soc2/rules";
import { controlHealth, rollupByCategory } from "@/lib/soc2/health";
import {
  addDays,
  isOverdue,
  nextDueAfter,
  runFireKey,
  withinLeadWindow,
  withinPeriod,
  overlapsPeriod,
} from "@/lib/soc2/schedule";
import type { ControlRow, ControlRunRow, ExceptionRow } from "@/lib/soc2/types";
import { WRITE_ROLES } from "@/lib/soc2/guard";
import { redactSecrets } from "@/lib/ai/impact";
import { CONTROL_LIBRARY } from "@/lib/soc2/library";
import { POLICY_TEMPLATES } from "@/lib/soc2/policyTemplates";

/**
 * The SOC 2 engine's pure logic, against the brief's required scenarios.
 * DB-enforced halves (closure trigger, access-review completion trigger,
 * RLS) are exercised end-to-end per docs/SOC2-OPERATIONS.md §Testing — these
 * tests cover everything decidable without a database.
 */

const TODAY = "2026-08-20";

/** An empty snapshot every test extends — keeps each case about ONE signal. */
const base = (): SweepSnapshot => ({
  today: TODAY,
  scopes: [{ id: "s1", version: 1, status: "approved" }],
  policies: [],
  staffEmails: [],
  acknowledgements: {},
  assets: [],
  risks: [],
  controls: [],
  controlRuns: [],
  runEvidenceCounts: {},
  vendors: [],
  activeIntegrations: [],
  accessReviews: [],
  accessReviewItems: [],
  breakGlassEvents: [],
  changeRecords: [],
  incidents: [],
  managementReviews: [{ id: "m1", held_at: TODAY }],
  sensitiveProjects: [],
  aiAgents: [],
  aiEscalations: [],
  aiDenials: [],
});

const findRule = (snapshot: SweepSnapshot, ruleKey: string) =>
  runRules(snapshot, DEFAULT_ENGINE_CONFIG).filter((c) => c.ruleKey === ruleKey);

describe("scenario 1 — privileged access without approval/MFA evidence", () => {
  it("flags a privileged account with MFA disabled as high severity", () => {
    const s = base();
    s.accessReviews = [{ id: "r1", ref: "ACR-2026-0001", status: "open", due_at: "2026-09-01", completed_at: null }];
    s.accessReviewItems = [
      {
        id: "i1",
        review_id: "r1",
        system_label: "Supabase (prod)",
        account_identifier: "root@nullshift.co.uk",
        person: "someone",
        privilege: "admin",
        is_shared: false,
        mfa_status: "disabled",
        decision: "pending",
        decided_at: null,
        action_completed_at: null,
      },
    ];
    const found = findRule(s, "iam.privileged_mfa_missing");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
    expect(found[0].controlKey).toBe("IAM-01");
  });

  it("routes it to the control owner immediately (not queue-only)", () => {
    const route = routeAlert("high", {
      programmeOwners: ["owner@nullshift.co.uk"],
      controlOwner: "iam@nullshift.co.uk",
    });
    expect(route.queueOnly).toBe(false);
    expect(route.notifyNow).toEqual(["iam@nullshift.co.uk"]);
  });

  it("treats an unactioned revoke past SLA as critical with an incident candidate (departed user)", () => {
    const s = base();
    s.accessReviewItems = [
      {
        id: "i2",
        review_id: "r1",
        system_label: "GitHub",
        account_identifier: "left@nullshift.co.uk",
        person: "left@nullshift.co.uk",
        privilege: "standard",
        is_shared: false,
        mfa_status: "enabled",
        decision: "revoke",
        decided_at: "2026-08-10T00:00:00Z",
        action_completed_at: null,
      },
    ];
    const found = findRule(s, "iam.revoke_unactioned");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("critical");
    expect(found[0].incidentCandidate).toBe(true);
  });
});

describe("scenario 2 — overdue access review", () => {
  it("raises an evidence-missing (high) exception for an overdue open review", () => {
    const s = base();
    s.accessReviews = [{ id: "r1", ref: "ACR-2026-0001", status: "open", due_at: "2026-08-01", completed_at: null }];
    const found = findRule(s, "iam.access_review_overdue");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
  });
  // The "cannot be silently marked complete" half is a database trigger
  // (enforce_access_review_completion, migration 0037) — exercised in the
  // documented end-to-end checks, not mockable here.
});

describe("scenario 3 — production deployment without linked review/test/approval", () => {
  it("flags the deployed change as a high-severity change-control exception", () => {
    const s = base();
    s.changeRecords = [
      {
        id: "c1",
        ref: "CHG-2026-0001",
        title: "Hotfix pushed straight to prod",
        status: "deployed",
        requested_by: "dev@nullshift.co.uk",
        reviewed_by: null,
        approved_by: null,
        test_evidence: null,
        rollback_plan: null,
        ticket_ref: null,
        deployed_at: "2026-08-19T10:00:00Z",
      },
    ];
    const found = findRule(s, "change.unlinked_production_change");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
    expect(found[0].controlKey).toBe("DEV-02");
  });

  it("flags a complete-but-self-approved change separately, at medium", () => {
    const s = base();
    s.changeRecords = [
      {
        id: "c2",
        ref: "CHG-2026-0002",
        title: "Self-approved release",
        status: "deployed",
        requested_by: "dev@nullshift.co.uk",
        reviewed_by: "dev@nullshift.co.uk",
        approved_by: "dev@nullshift.co.uk",
        test_evidence: "vitest run ref",
        rollback_plan: "vercel rollback",
        ticket_ref: "issues:123",
        deployed_at: "2026-08-19T10:00:00Z",
      },
    ];
    expect(findRule(s, "change.unlinked_production_change")).toHaveLength(0);
    const self = findRule(s, "change.self_approved");
    expect(self).toHaveLength(1);
    expect(self[0].severity).toBe("medium");
  });
});

describe("scenario 4 — critical vendor overdue for review", () => {
  it("raises high severity for a critical-dependency vendor past review", () => {
    const s = base();
    s.vendors = [
      {
        id: "v1",
        name: "Supabase",
        status: "approved",
        data_access: "personal",
        service_dependency: "critical",
        risk_level: "high",
        owner_email: "owner@nullshift.co.uk",
        review_due_at: "2026-08-01",
        dpa_status: "in_place",
        security_docs: [],
      },
    ];
    const found = findRule(s, "vendor.review_overdue");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
  });

  it("flags an integration configured in the environment but missing from the register", () => {
    const s = base();
    s.activeIntegrations = [{ key: "stripe", label: "Stripe (payments)" }];
    const found = findRule(s, "vendor.unregistered_integration");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
  });

  it("flags sensitive data at an unapproved vendor", () => {
    const s = base();
    s.vendors = [
      {
        id: "v2",
        name: "Anthropic",
        status: "proposed",
        data_access: "confidential",
        service_dependency: "high",
        risk_level: null,
        owner_email: null,
        review_due_at: null,
        dpa_status: "unknown",
        security_docs: [],
      },
    ];
    const keys = runRules(s).map((c) => c.ruleKey);
    expect(keys).toContain("vendor.sensitive_unapproved");
    expect(keys).toContain("vendor.dpa_unknown");
  });
});

describe("scenario 5 — AI agent denied access outside its scope", () => {
  it("turns a refused tool invocation into a reviewable exception", () => {
    const s = base();
    s.aiDenials = [
      { id: "d1", source: "tool_invocation", agent_key: "classifier", tool: "run_sql", at: "2026-08-19T00:00:00Z" },
    ];
    const found = findRule(s, "ai.access_denied");
    expect(found).toHaveLength(1);
    expect(found[0].source).toBe("ai_workspace");
  });

  it("once reviewed and closed, the same denial is never re-raised", () => {
    const fireKey = "ai.access_denied:tool_invocation:d1";
    expect(EVER_DEDUPE_RULES.has("ai.access_denied")).toBe(true);
    // open → suppressed; closed (ever) → still suppressed
    expect(shouldRaise("ai.access_denied", fireKey, new Set([fireKey]), new Set([fireKey]))).toBe(false);
    expect(shouldRaise("ai.access_denied", fireKey, new Set(), new Set([fireKey]))).toBe(false);
    // a brand-new denial id → raised
    expect(shouldRaise("ai.access_denied", "ai.access_denied:tool_invocation:d2", new Set(), new Set([fireKey]))).toBe(true);
  });

  it("flags an active agent with no accountable owner", () => {
    const s = base();
    s.aiAgents = [{ id: "a1", key: "rogue", name: "Rogue", lifecycle: "active", owner_email: null, last_activity_at: TODAY }];
    const found = findRule(s, "ai.agent_unowned");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
  });
});

describe("scenario 6 — project handling children's/special-category data", () => {
  it("requires a compliance review and blocks a positive reading via an open exception", () => {
    const s = base();
    s.sensitiveProjects = [
      { id: "p1", tenant_id: "t1", name: "Nursery bookings", detail: "children's data", reviewed: false },
    ];
    const found = findRule(s, "data.sensitive_project_review");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
    expect(found[0].controlKey).toBe("DATA-07");

    // The open exception drives the control to exception_open — the
    // readiness rollup can never show Confidentiality positive past it.
    const control: ControlRow = {
      id: "c-data07",
      key: "DATA-07",
      tsc_category: "confidentiality",
      tsc_refs: [],
      name: "Sensitive-project compliance review",
      objective: "",
      owner_email: "owner@nullshift.co.uk",
      frequency: "event",
      policy_key: null,
      applicability: "applicable",
      status: "active",
      next_due_at: null,
    };
    const exception: ExceptionRow = {
      id: "e1",
      ref: "EXC-2026-0001",
      control_id: "c-data07",
      rule_key: "data.sensitive_project_review",
      fire_key: "data.sensitive_project_review:p1",
      title: found[0].title,
      severity: "high",
      status: "triage_required",
      owner_email: null,
      due_at: null,
      detected_at: TODAY,
      triaged_at: null,
      detail: null,
    };
    const health = controlHealth({ control, runs: [], evidence: [], exceptions: [exception], today: TODAY });
    expect(health.health).toBe("exception_open");

    const rollup = rollupByCategory([{ control, health: health.health }]);
    expect(rollup.find((r) => r.category === "confidentiality")?.counts.exception_open).toBe(1);
  });

  it("does not re-raise once the human review closed the exception", () => {
    const s = base();
    s.sensitiveProjects = [
      { id: "p1", tenant_id: "t1", name: "Nursery bookings", detail: null, reviewed: true },
    ];
    expect(findRule(s, "data.sensitive_project_review")).toHaveLength(0);
  });
});

describe("scenario 7 — backup/restore test not performed by policy date", () => {
  it("flags an overdue scheduled run for an availability control as high", () => {
    const s = base();
    s.controls = [
      {
        id: "avl3",
        key: "AVL-03",
        name: "Restore test performed",
        status: "active",
        applicability: "applicable",
        owner_email: "infra@nullshift.co.uk",
        frequency: "semiannual",
        next_due_at: "2026-08-01",
        tsc_category: "availability",
      },
    ];
    s.controlRuns = [
      { id: "run1", control_id: "avl3", due_at: "2026-08-01", status: "scheduled", performed_at: null },
    ];
    const found = findRule(s, "evidence.run_overdue");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
  });

  it("shows the control as evidence_missing on the dashboard", () => {
    const control: ControlRow = {
      id: "avl3",
      key: "AVL-03",
      tsc_category: "availability",
      tsc_refs: [],
      name: "Restore test performed",
      objective: "",
      owner_email: null,
      frequency: "semiannual",
      policy_key: "backup_recovery",
      applicability: "applicable",
      status: "active",
      next_due_at: "2026-08-01",
    };
    const overdueRun: ControlRunRow = {
      id: "run1",
      control_id: "avl3",
      fire_key: "AVL-03:2026-08-01",
      due_at: "2026-08-01",
      status: "scheduled",
      result: null,
      performed_by: null,
      performed_at: null,
      reviewer_email: null,
      review_result: null,
    };
    const health = controlHealth({ control, runs: [overdueRun], evidence: [], exceptions: [], today: TODAY });
    expect(health.health).toBe("evidence_missing");
  });
});

describe("scenario 8 — access control on the readiness area", () => {
  it("keeps auditors out of every write path (WRITE_ROLES excludes auditor)", () => {
    expect(WRITE_ROLES).not.toContain("auditor");
  });
  // The full check (no programme role → no page, no API read; client users
  // blocked by staff-only RLS with no is_member_of path) is DB/session-bound
  // and covered by the documented end-to-end checks + packages/db RLS test.
});

describe("scenario 9 — export scoping and redaction", () => {
  it("keeps only records inside the selected review period", () => {
    const p = { starts_on: "2026-07-01", ends_on: "2026-09-30" };
    expect(withinPeriod("2026-08-15", p)).toBe(true);
    expect(withinPeriod("2026-06-30", p)).toBe(false);
    expect(withinPeriod(null, p)).toBe(false);
    // An exception opened before the period but still open during it belongs
    // in the pack; one closed before the period starts does not.
    expect(overlapsPeriod("2026-05-01", null, p)).toBe(true);
    expect(overlapsPeriod("2026-05-01", "2026-06-01", p)).toBe(false);
    expect(overlapsPeriod("2026-08-01", "2026-08-10", p)).toBe(true);
  });

  it("strips secret-shaped values from a pack-like object", () => {
    const pack = {
      vendors: [{ name: "Stripe", notes: "key sk_live_51HcatastropheXYZ123456 was seen in a doc" }],
      cover: { api_key: "whatever-this-is" },
    };
    const redacted = redactSecrets(pack) as typeof pack;
    expect(JSON.stringify(redacted)).not.toContain("sk_live_51Hcatastrophe");
    expect(redacted.cover.api_key).toBe("[redacted]");
  });
});

describe("scenario 10 — closure requires remediation + independent verification", () => {
  // The gate itself is the enforce_exception_closure trigger (migration
  // 0037): closed requires resolution_note + resolved_by + verified_by, and
  // verified_by <> resolved_by. Here we pin the engine-side contract around
  // it: the sweep only ever moves cleared exceptions to
  // resolved_pending_verification (see sweep.ts), and re-raising honesty:
  it("re-raises a state-gap exception if it was closed without the condition actually clearing", () => {
    const fireKey = "governance.asset_ungoverned:a1";
    // closed (present in ever, absent from open) + condition still true → raise again
    expect(shouldRaise("governance.asset_ungoverned", fireKey, new Set(), new Set([fireKey]))).toBe(true);
    // still open → no duplicate
    expect(shouldRaise("governance.asset_ungoverned", fireKey, new Set([fireKey]), new Set([fireKey]))).toBe(false);
  });
});

describe("governance rules", () => {
  it("demands an approved scope before anything else", () => {
    const s = base();
    s.scopes = [{ id: "s1", version: 1, status: "draft" }];
    const found = findRule(s, "governance.scope_unapproved");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
  });

  it("flags approved policies past review and outstanding acknowledgements past grace", () => {
    const s = base();
    s.policies = [
      { id: "p1", key: "information_security", title: "Information Security Policy", status: "approved", review_due_at: "2026-08-01", requires_acknowledgement: true, current_version: 2, effective_date: "2026-07-01" },
    ];
    s.staffEmails = ["a@nullshift.co.uk", "b@nullshift.co.uk"];
    s.acknowledgements = { information_security: ["a@nullshift.co.uk"] };
    const keys = runRules(s).map((c) => c.ruleKey);
    expect(keys).toContain("governance.policy_review_overdue");
    const acks = findRule(s, "governance.policy_ack_overdue");
    expect(acks).toHaveLength(1);
    expect(acks[0].affected.users).toEqual(["b@nullshift.co.uk"]);
  });

  it("gives staff the acknowledgement grace window before flagging", () => {
    const s = base();
    s.policies = [
      { id: "p1", key: "acceptable_use", title: "Acceptable Use Policy", status: "approved", review_due_at: null, requires_acknowledgement: true, current_version: 1, effective_date: "2026-08-15" },
    ];
    s.staffEmails = ["a@nullshift.co.uk"];
    s.acknowledgements = {};
    // Effective 5 days ago; default grace is 14 days — no finding yet.
    expect(findRule(s, "governance.policy_ack_overdue")).toHaveLength(0);
  });

  it("flags unowned in-scope assets and unowned controls", () => {
    const s = base();
    s.assets = [
      { id: "a1", name: "Prod DB", kind: "database", status: "active", in_scope: true, owner_email: null, classification: null, criticality: "critical", review_due_at: null },
    ];
    s.controls = [
      { id: "c1", key: "GOV-01", name: "Policy control", status: "active", applicability: "applicable", owner_email: null, frequency: "annual", next_due_at: null, tsc_category: "security" },
    ];
    const assetFlags = findRule(s, "governance.asset_ungoverned");
    expect(assetFlags).toHaveLength(1);
    expect(assetFlags[0].severity).toBe("high"); // critical asset
    const controlFlags = findRule(s, "governance.control_unowned");
    expect(controlFlags).toHaveLength(1);
    expect(controlFlags[0].title).toContain("no owner and no scheduled evidence collection");
  });
});

describe("alert routing", () => {
  it("critical: immediate to programme owner + control owner, incident candidate by default", () => {
    const route = routeAlert("critical", {
      programmeOwners: ["po@nullshift.co.uk"],
      controlOwner: "co@nullshift.co.uk",
    });
    expect(route.notifyNow).toEqual(["co@nullshift.co.uk", "po@nullshift.co.uk"]);
    expect(route.incidentCandidate).toBe(true);
  });

  it("medium/low: queue only — no notification blast", () => {
    for (const sev of ["medium", "low"] as const) {
      const route = routeAlert(sev, { programmeOwners: ["po@x"], controlOwner: "co@x" });
      expect(route.queueOnly).toBe(true);
      expect(route.notifyNow).toEqual([]);
    }
  });
});

describe("control health precedence and scheduling", () => {
  const control = (over: Partial<ControlRow>): ControlRow => ({
    id: "c1",
    key: "IAM-05",
    tsc_category: "security",
    tsc_refs: [],
    name: "Periodic access review",
    objective: "",
    owner_email: "x@y",
    frequency: "quarterly",
    policy_key: null,
    applicability: "applicable",
    status: "active",
    next_due_at: null,
    ...over,
  });

  it("not_applicable beats everything; open exception beats missing evidence", () => {
    const na = controlHealth({ control: control({ applicability: "not_applicable" }), runs: [], evidence: [], exceptions: [], today: TODAY });
    expect(na.health).toBe("not_applicable");

    const exc: ExceptionRow = {
      id: "e1", ref: "EXC-2026-0002", control_id: "c1", rule_key: null, fire_key: null,
      title: "t", severity: "medium", status: "in_remediation", owner_email: null,
      due_at: null, detected_at: TODAY, triaged_at: null, detail: null,
    };
    const withBoth = controlHealth({
      control: control({}),
      runs: [{ id: "r1", control_id: "c1", fire_key: null, due_at: "2026-07-01", status: "scheduled", result: null, performed_by: null, performed_at: null, reviewer_email: null, review_result: null }],
      evidence: [],
      exceptions: [exc],
      today: TODAY,
    });
    expect(withBoth.health).toBe("exception_open");
  });

  it("a completed run with no evidence is evidence_missing, not operating", () => {
    const h = controlHealth({
      control: control({}),
      runs: [{ id: "r1", control_id: "c1", fire_key: null, due_at: "2026-08-01", status: "complete", result: "pass", performed_by: "x@y", performed_at: "2026-08-01T00:00:00Z", reviewer_email: null, review_result: null }],
      evidence: [],
      exceptions: [],
      today: TODAY,
    });
    expect(h.health).toBe("evidence_missing");
  });

  it("performed + evidenced = operating; never-run + not-yet-due = untested", () => {
    const done = controlHealth({
      control: control({ next_due_at: "2026-11-01" }),
      runs: [{ id: "r1", control_id: "c1", fire_key: null, due_at: "2026-08-01", status: "complete", result: "pass", performed_by: "x@y", performed_at: "2026-08-01T00:00:00Z", reviewer_email: null, review_result: null }],
      evidence: [{ id: "ev1", control_id: "c1", control_run_id: "r1", source: "access_review", capture_date: "2026-08-01", review_result: "accepted", classification: "confidential" }],
      exceptions: [],
      today: TODAY,
    });
    expect(done.health).toBe("operating");

    const fresh = controlHealth({ control: control({ next_due_at: "2026-09-15" }), runs: [], evidence: [], exceptions: [], today: TODAY });
    expect(fresh.health).toBe("untested");

    const neverAndLate = controlHealth({ control: control({ next_due_at: "2026-08-01" }), runs: [], evidence: [], exceptions: [], today: TODAY });
    expect(neverAndLate.health).toBe("evidence_missing");
  });

  it("schedule maths: fire keys deterministic, lead window, next due", () => {
    expect(runFireKey("IAM-05", "2026-09-01")).toBe("IAM-05:2026-09-01");
    expect(withinLeadWindow("2026-09-01", TODAY)).toBe(true); // 12 days out
    expect(withinLeadWindow("2026-09-20", TODAY)).toBe(false); // 31 days out
    expect(isOverdue("2026-08-19", TODAY)).toBe(true);
    expect(isOverdue(TODAY, TODAY)).toBe(false);
    expect(nextDueAfter("quarterly", TODAY)).toBe(addDays(TODAY, 92));
    expect(nextDueAfter("per_change", TODAY)).toBeNull();
  });
});

describe("seed catalogues", () => {
  it("ships the full policy set (12) and a control library with every TSC-facing section", () => {
    expect(POLICY_TEMPLATES).toHaveLength(12);
    const keys = new Set(POLICY_TEMPLATES.map((p) => p.key));
    expect(keys.size).toBe(12);
    // every control's policy_key resolves to a real template
    for (const c of CONTROL_LIBRARY) {
      if (c.policyKey) expect(keys.has(c.policyKey)).toBe(true);
    }
    // control keys unique
    const controlKeys = CONTROL_LIBRARY.map((c) => c.key);
    expect(new Set(controlKeys).size).toBe(controlKeys.length);
  });

  it("never phrases seeds as certification claims", () => {
    const banned = /certified|audit-ready|fully compliant|guarantees? compliance/i;
    for (const c of CONTROL_LIBRARY) {
      expect(banned.test(c.name)).toBe(false);
      expect(banned.test(c.objective)).toBe(false);
      expect(banned.test(c.description)).toBe(false);
    }
    for (const p of POLICY_TEMPLATES) {
      expect(banned.test(p.title)).toBe(false);
    }
  });
});
