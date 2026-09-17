import { describe, expect, it } from "vitest";
import {
  applySetPlan,
  isOverdue,
  isSameAction,
  openActionFor,
  planCompleteNextAction,
  planSetNextAction,
  validateNextActionInput,
  type NextActionRow,
  type ValidatedNextAction,
} from "@/lib/nextActions";
import { FIXTURE_TENANT_IDS, NEXT_ACTION_FIXTURES } from "@/lib/work/intakeFixtures";

const TENANT = FIXTURE_TENANT_IDS.cedar;
const OTHER = FIXTURE_TENANT_IDS.harbour;
const NOW = "2026-09-17T10:00:00Z";

const value = (over: Partial<ValidatedNextAction> = {}): ValidatedNextAction => ({
  tenantId: TENANT,
  projectId: null,
  text: "Send the discount-code quote",
  owner: "Louis",
  ownerUser: null,
  dueAt: "2026-09-19",
  source: "manual",
  ...over,
});

const openRow = (over: Partial<NextActionRow> = {}): NextActionRow => ({
  id: "na-1",
  tenant_id: TENANT,
  project_id: null,
  text: "Send the discount-code quote",
  owner: "Louis",
  owner_user: null,
  due_at: "2026-09-19",
  state: "open",
  source: "manual",
  created_by: null,
  completed_at: null,
  superseded_by_id: null,
  created_at: "2026-09-15T11:00:00Z",
  updated_at: "2026-09-15T11:00:00Z",
  ...over,
});

describe("validateNextActionInput", () => {
  it("requires a uuid tenant, non-empty text and owner, and a calendar due date", () => {
    expect(validateNextActionInput({ tenantId: "cedar", text: "x", owner: "L" }).ok).toBe(
      false
    );
    expect(
      validateNextActionInput({ tenantId: TENANT, text: "   ", owner: "L" }).ok
    ).toBe(false);
    expect(validateNextActionInput({ tenantId: TENANT, text: "x", owner: "" }).ok).toBe(
      false
    );
    expect(
      validateNextActionInput({
        tenantId: TENANT,
        text: "x",
        owner: "L",
        dueAt: "19/09/2026",
      }).ok
    ).toBe(false);
    expect(
      validateNextActionInput({
        tenantId: TENANT,
        text: "x",
        owner: "L",
        projectId: "proj",
      }).ok
    ).toBe(false);
    const ok = validateNextActionInput({
      tenantId: TENANT,
      text: "  Chase   signed DPA ",
      owner: " Louis ",
      dueAt: "2026-09-19",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.text).toBe("Chase signed DPA");
      expect(ok.value.owner).toBe("Louis");
      expect(ok.value.source).toBe("manual");
      expect(ok.value.projectId).toBeNull();
    }
  });

  it("rejects text over the limit", () => {
    expect(
      validateNextActionInput({ tenantId: TENANT, text: "x".repeat(281), owner: "L" }).ok
    ).toBe(false);
  });
});

describe("planSetNextAction — supersede, never duplicate", () => {
  it("inserts when the client has no open action", () => {
    const plan = planSetNextAction(null, value());
    expect(plan.kind).toBe("insert");
  });

  it("is a no-op when the open action already says exactly this", () => {
    const plan = planSetNextAction(openRow(), value());
    expect(plan.kind).toBe("noop");
    expect(
      isSameAction(openRow({ text: "Send the  discount-code quote " }), value())
    ).toBe(true);
  });

  it("supersedes the open action when anything material differs", () => {
    expect(
      planSetNextAction(openRow(), value({ text: "Release the VAT fix" })).kind
    ).toBe("supersede");
    expect(planSetNextAction(openRow(), value({ owner: "Sam" })).kind).toBe("supersede");
    expect(planSetNextAction(openRow(), value({ dueAt: "2026-09-25" })).kind).toBe(
      "supersede"
    );
    expect(planSetNextAction(openRow(), value({ dueAt: null })).kind).toBe("supersede");
  });

  it("treats a non-open row as no open action and refuses a foreign tenant's row", () => {
    expect(planSetNextAction(openRow({ state: "done" }), value()).kind).toBe("insert");
    expect(() => planSetNextAction(openRow({ tenant_id: OTHER }), value())).toThrow(
      /tenant/
    );
  });

  it("applying a supersede leaves exactly one open row and keeps lineage", () => {
    const rows = [openRow()];
    const plan = planSetNextAction(rows[0], value({ text: "Release the VAT fix" }));
    const next = applySetPlan(rows, plan, { newId: "na-2", now: NOW, createdBy: "u1" });
    expect(next).toHaveLength(2);
    expect(openActionFor(next, TENANT)?.id).toBe("na-2");
    const old = next.find((r) => r.id === "na-1");
    expect(old?.state).toBe("superseded");
    expect(old?.superseded_by_id).toBe("na-2");
    expect(old?.text).toBe("Send the discount-code quote"); // never edited
  });

  it("applying the same action twice never creates a second open row", () => {
    let rows: NextActionRow[] = [];
    const p1 = planSetNextAction(openActionFor(rows, TENANT), value());
    rows = applySetPlan(rows, p1, { newId: "na-1", now: NOW, createdBy: null });
    const p2 = planSetNextAction(openActionFor(rows, TENANT), value());
    rows = applySetPlan(rows, p2, { newId: "na-2", now: NOW, createdBy: null });
    expect(p2.kind).toBe("noop");
    expect(rows).toHaveLength(1);
    expect(rows.filter((r) => r.state === "open")).toHaveLength(1);
  });

  it("openActionFor throws if the one-open invariant is ever broken", () => {
    expect(() => openActionFor([openRow(), openRow({ id: "na-9" })], TENANT)).toThrow(
      /invariant/
    );
  });
});

describe("planCompleteNextAction", () => {
  it("completes only an open row belonging to the given tenant", () => {
    expect(planCompleteNextAction(null, TENANT)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(planCompleteNextAction(openRow({ tenant_id: OTHER }), TENANT)).toEqual({
      ok: false,
      reason: "wrong_tenant",
    });
    expect(planCompleteNextAction(openRow({ state: "superseded" }), TENANT)).toEqual({
      ok: false,
      reason: "not_open",
    });
    expect(planCompleteNextAction(openRow(), TENANT).ok).toBe(true);
  });
});

describe("fixtures and overdue", () => {
  it("fixture history holds one open row per tenant with lineage intact", () => {
    expect(openActionFor(NEXT_ACTION_FIXTURES, TENANT)?.id).toBe("na-cedar-3");
    const superseded = NEXT_ACTION_FIXTURES.find((r) => r.id === "na-cedar-2");
    expect(superseded?.state).toBe("superseded");
    expect(superseded?.superseded_by_id).toBe("na-cedar-3");
    expect(openActionFor(NEXT_ACTION_FIXTURES, OTHER)?.owner).toBe("Unassigned");
  });

  it("is overdue only when open and past the due date", () => {
    expect(isOverdue({ due_at: "2026-09-15", state: "open" }, "2026-09-17")).toBe(true);
    expect(isOverdue({ due_at: "2026-09-17", state: "open" }, "2026-09-17")).toBe(false);
    expect(isOverdue({ due_at: "2026-09-15", state: "done" }, "2026-09-17")).toBe(false);
    expect(isOverdue({ due_at: null, state: "open" }, "2026-09-17")).toBe(false);
  });
});
