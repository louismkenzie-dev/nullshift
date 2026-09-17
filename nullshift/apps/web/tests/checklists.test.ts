import { describe, expect, it } from "vitest";
import {
  applyClientUpdate,
  clientTransition,
  completion,
  generateHandoverChecklist,
  generateInitialChecklist,
  generateLaterChecklist,
  handoverCanComplete,
  isDone,
  nextStep,
  TASK_STATES,
  type ChecklistTask,
  type InitialFacts,
} from "@/lib/delivery";
import {
  FIXTURE_HANDOVER_ORBIT,
  FIXTURE_IDS,
  FIXTURE_LATER_HARBOUR,
  FIXTURE_LATER_NORTHLINE,
  FIXTURE_LATER_ORBIT,
} from "@/lib/delivery/fixtures";

const P = FIXTURE_IDS.projects.northline;

const facts = (over: Partial<InitialFacts> = {}): InitialFacts => ({
  projectId: P,
  companyDetailsSubmitted: false,
  agreementAccepted: false,
  depositPaid: false,
  assetsProvided: false,
  kickoffConfirmed: false,
  ...over,
});

describe("initial checklist (brief §5.10)", () => {
  it("has the five steps in order, each with why, owner and requirement source", () => {
    const tasks = generateInitialChecklist(facts());
    expect(tasks.map((t) => t.key)).toEqual([
      "company",
      "agreement",
      "initial_payment",
      "assets",
      "kickoff",
    ]);
    for (const t of tasks) {
      expect(t.journey).toBe("initial");
      expect(t.why.length).toBeGreaterThan(20);
      expect(t.requirement_source.length).toBeGreaterThan(3);
      expect(["client", "nullshift"]).toContain(t.owner_kind);
      expect(TASK_STATES).toContain(t.state);
      expect(t.project_id).toBe(P);
    }
  });

  it("reads facts; it never infers payment or signature", () => {
    const none = generateInitialChecklist(facts());
    expect(none.find((t) => t.key === "agreement")?.state).toBe("blocked");
    expect(none.find((t) => t.key === "initial_payment")?.state).toBe("blocked");
    expect(completion(none).label).toBe("0 of 5 done");

    const some = generateInitialChecklist(
      facts({ companyDetailsSubmitted: true, agreementAccepted: true })
    );
    expect(some.find((t) => t.key === "agreement")?.state).toBe("complete");
    expect(some.find((t) => t.key === "initial_payment")?.state).toBe("not_started");
    expect(completion(some).label).toBe("2 of 5 done");
  });

  it("a waived deposit gate is waived — not paid, not done, not counted", () => {
    const tasks = generateInitialChecklist(
      facts({
        companyDetailsSubmitted: true,
        agreementAccepted: true,
        waivers: {
          initial_payment: {
            reason: "Deposit deferred to milestone 2 by agreement",
            approver: "approver-1",
          },
        },
      })
    );
    const pay = tasks.find((t) => t.key === "initial_payment")!;
    expect(pay.state).toBe("waived");
    expect(pay.waiver_reason).toMatch(/deferred/);
    expect(pay.waiver_approver).toBe("approver-1");
    expect(pay.completed_at).toBeNull();
    expect(isDone(pay)).toBe(false);
    // Required count drops to four; done stays two.
    expect(completion(tasks)).toEqual({ done: 2, total: 4, label: "2 of 4 done" });
  });

  it("a waiver never overrides an actual completion", () => {
    const tasks = generateInitialChecklist(
      facts({
        depositPaid: true,
        agreementAccepted: true,
        companyDetailsSubmitted: true,
        waivers: { initial_payment: { reason: "x", approver: "a" } },
      })
    );
    expect(tasks.find((t) => t.key === "initial_payment")?.state).toBe("complete");
  });

  it("the next step is the first open client-owned item", () => {
    const tasks = generateInitialChecklist(facts({ companyDetailsSubmitted: true }));
    const n = nextStep(tasks);
    expect(n?.task.key).toBe("agreement");
    expect(n?.mine).toBe(true);
    expect(nextStep(tasks.map((t) => ({ ...t, state: "complete" as const })))).toBeNull();
  });
});

describe("later checklist (brief §5.10, §8.2–8.5)", () => {
  it("managed route: acceptance → package/schedule → Direct Debit → activation, and never the handover branch", () => {
    const keys = FIXTURE_LATER_NORTHLINE.map((t) => t.key);
    expect(keys).toEqual([
      "build_acceptance",
      "package_schedule",
      "direct_debit",
      "activation",
    ]);
    expect(keys).not.toContain("independent_handover");
  });

  it("independent route: acceptance → handover → transfer completion, and never the managed branch", () => {
    const keys = FIXTURE_LATER_ORBIT.map((t) => t.key);
    expect(keys).toEqual([
      "build_acceptance",
      "independent_handover",
      "transfer_completion",
    ]);
    expect(keys).not.toContain("package_schedule");
    expect(keys).not.toContain("direct_debit");
    const handover = FIXTURE_LATER_ORBIT.find((t) => t.key === "independent_handover")!;
    expect(handover.why).toMatch(/pending decision/);
    expect(handover.why).toMatch(/No ongoing Nullshift management subscription/);
  });

  it("unresolved route: acceptance plus a single 'route to be confirmed' item — acceptance does not wait for it", () => {
    const tasks = generateLaterChecklist({
      projectId: P,
      route: "unresolved",
      buildAccepted: false,
    });
    expect(tasks.map((t) => t.key)).toEqual(["build_acceptance", "route_election"]);
    expect(tasks[0].state).toBe("not_started");
    expect(tasks[0].owner_kind).toBe("client");
    expect(tasks[0].why).toMatch(/without choosing a package/);
  });

  it("package selection is blocked until the build is accepted, and Direct Debit until a schedule exists (§17.1 row 2)", () => {
    const before = generateLaterChecklist({
      projectId: P,
      route: "managed",
      buildAccepted: false,
    });
    expect(before.find((t) => t.key === "package_schedule")?.state).toBe("blocked");
    expect(before.find((t) => t.key === "direct_debit")?.state).toBe("blocked");
    const after = generateLaterChecklist({
      projectId: P,
      route: "managed",
      buildAccepted: true,
    });
    expect(after.find((t) => t.key === "build_acceptance")?.state).toBe("complete");
    expect(after.find((t) => t.key === "package_schedule")?.state).toBe("not_started");
    expect(after.find((t) => t.key === "direct_debit")?.state).toBe("blocked");
  });

  it("a mandate alone never activates (§17.1 row 3)", () => {
    const tasks = generateLaterChecklist({
      projectId: P,
      route: "managed",
      buildAccepted: true,
      scheduleAccepted: true,
      mandateAuthorised: true,
    });
    expect(tasks.find((t) => t.key === "direct_debit")?.state).toBe("complete");
    expect(tasks.find((t) => t.key === "activation")?.state).toBe("not_started");
    expect(FIXTURE_LATER_HARBOUR.find((t) => t.key === "activation")?.state).toBe(
      "not_started"
    );
  });

  it("partial and disputed acceptances are shown as such, not as done", () => {
    const partial = generateLaterChecklist({
      projectId: P,
      route: "managed",
      buildAccepted: false,
      buildAcceptedPartial: true,
    });
    expect(partial[0].state).toBe("in_progress");
    expect(partial[1].state).toBe("blocked");
    const disputed = generateLaterChecklist({
      projectId: P,
      route: "managed",
      buildAccepted: false,
      buildDisputed: true,
    });
    expect(disputed[0].state).toBe("blocked");
  });
});

describe("independent handover checklist (brief §8.5, §17.1 row 12)", () => {
  it("covers every §8.5 bullet with a requirement source", () => {
    const keys = FIXTURE_HANDOVER_ORBIT.map((t) => t.key);
    expect(keys).toEqual([
      "receiving_owner",
      "obligations_resolved",
      "client_accounts",
      "ownership_transfer",
      "data_transfer",
      "licences_secrets",
      "continuity_checks",
      "application_fee",
      "walkthrough",
      "access_revoked",
      "handover_complete",
    ]);
    for (const t of FIXTURE_HANDOVER_ORBIT) {
      expect(t.requirement_source).toMatch(/handover|Order Form/);
      expect(t.arrangement_id).toBe(FIXTURE_IDS.arrangements.orbit);
    }
  });

  it("access revocation and completion start blocked", () => {
    expect(FIXTURE_HANDOVER_ORBIT.find((t) => t.key === "access_revoked")?.state).toBe(
      "blocked"
    );
    expect(FIXTURE_HANDOVER_ORBIT.find((t) => t.key === "handover_complete")?.state).toBe(
      "blocked"
    );
  });

  it("cannot complete with open tasks; a waived task does not count; the fee disposition needs evidence", () => {
    const fresh = handoverCanComplete(FIXTURE_HANDOVER_ORBIT);
    expect(fresh.ok).toBe(false);
    if (!fresh.ok) expect(fresh.missing).toContain("application_fee");

    const allDone = FIXTURE_HANDOVER_ORBIT.map((t) =>
      t.key === "handover_complete"
        ? t
        : {
            ...t,
            state: "complete" as const,
            completed_at: "2026-09-20T10:00:00Z",
            evidence: [{ kind: "note" as const, note: "done" }],
          }
    );
    expect(handoverCanComplete(allDone)).toEqual({ ok: true });

    const waivedFee = allDone.map((t) =>
      t.key === "application_fee"
        ? {
            ...t,
            state: "waived" as const,
            evidence: [],
            completed_at: null,
            waiver_reason: "n/a",
            waiver_approver: "a",
          }
        : t
    );
    const r = handoverCanComplete(waivedFee);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["application_fee"]);
  });

  it("explains the application-fee item either way", () => {
    const withFee = generateHandoverChecklist({
      arrangementId: null,
      hasApplicationFee: true,
    });
    expect(withFee.find((t) => t.key === "application_fee")?.why).toMatch(
      /Stripe Connect/
    );
    expect(FIXTURE_HANDOVER_ORBIT.find((t) => t.key === "application_fee")?.why).toMatch(
      /no fee applies/
    );
  });
});

describe("client task updates mirror the SQL function", () => {
  const client: ChecklistTask = {
    journey: "initial",
    key: "assets",
    label: "Assets and access",
    why: "w",
    owner_kind: "client",
    state: "not_started",
    evidence: [],
    requirement_source: "s",
    project_id: P,
  };

  it("allows not_started / in_progress / complete on a client-owned task", () => {
    for (const s of ["not_started", "in_progress", "complete"])
      expect(clientTransition(client, s).ok).toBe(true);
  });

  it("forbids waiving, not-applicable, blocked and awaiting_client", () => {
    for (const s of [
      "waived",
      "not_applicable",
      "blocked",
      "awaiting_client",
      "anything",
    ]) {
      const r = clientTransition(client, s);
      expect(r.ok).toBe(false);
    }
  });

  it("forbids touching a Nullshift-owned or locked task", () => {
    expect(clientTransition({ ...client, owner_kind: "nullshift" }, "complete").ok).toBe(
      false
    );
    expect(clientTransition({ ...client, state: "waived" }, "in_progress").ok).toBe(
      false
    );
    expect(clientTransition({ ...client, state: "blocked" }, "in_progress").ok).toBe(
      false
    );
    expect(clientTransition({ ...client, state: "not_applicable" }, "complete").ok).toBe(
      false
    );
  });

  it("completing needs evidence; evidence is appended; completed_at is set on complete and cleared otherwise", () => {
    const now = "2026-09-17T12:00:00Z";
    const noEvidence = applyClientUpdate(client, "complete", null, now);
    expect(noEvidence.ok).toBe(false);

    const done = applyClientUpdate(
      client,
      "complete",
      [{ kind: "note", note: "Logo pack uploaded" }],
      now
    );
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.task.state).toBe("complete");
      expect(done.task.completed_at).toBe(now);
      expect(done.task.evidence).toHaveLength(1);
      const reopened = applyClientUpdate(
        done.task,
        "in_progress",
        [{ kind: "note", note: "one more file" }],
        now
      );
      expect(reopened.ok).toBe(true);
      if (reopened.ok) {
        expect(reopened.task.completed_at).toBeNull();
        expect(reopened.task.evidence).toHaveLength(2);
      }
    }
  });
});
