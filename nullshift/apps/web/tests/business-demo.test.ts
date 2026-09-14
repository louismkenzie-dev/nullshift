import { describe, expect, it } from "vitest";
import { DEMO_TICKET, demoReducer, initialDemoState } from "../lib/businessDemo";

describe("isolated fictional business demo", () => {
  it("books once, scans once, and blocks duplicate admission", () => {
    const booked = demoReducer(initialDemoState(), { type: "book" });
    expect(booked.people).toHaveLength(4);
    expect(demoReducer(booked, { type: "book" })).toBe(booked);
    const scanned = demoReducer(booked, { type: "scan", id: DEMO_TICKET.toLowerCase() });
    expect(scanned.people.find((p) => p.id === DEMO_TICKET)?.present).toBe(true);
    const duplicate = demoReducer(scanned, { type: "scan", id: DEMO_TICKET });
    expect(duplicate.people).toBe(scanned.people);
    expect(duplicate.notice).toContain("Duplicate scan stopped");
  });
  it("rejects unpaid and unknown tickets without changing attendance", () => {
    const state = initialDemoState();
    for (const id of ["DEMO-103", "DEMO-999", DEMO_TICKET]) {
      expect(demoReducer(state, { type: "scan", id }).people).toBe(state.people);
    }
    expect(demoReducer(state, { type: "attendance", id: "DEMO-103" }).people).toBe(
      state.people
    );
  });
  it("supports manual attendance and fully resets the experience", () => {
    const present = demoReducer(initialDemoState(), {
      type: "attendance",
      id: "DEMO-101",
    });
    expect(present.people[0].present).toBe(true);
    expect(
      demoReducer(present, { type: "attendance", id: "DEMO-101" }).people[0].present
    ).toBe(false);
    expect(demoReducer(present, { type: "reset" })).toEqual(initialDemoState());
  });
});
