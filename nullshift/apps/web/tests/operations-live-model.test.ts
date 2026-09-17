import { describe, expect, it } from "vitest";
import {
  draftNotes,
  readDraftNotes,
  validateNewClient,
  operationsSummary,
  money,
  type NewClientInput,
  type OperationsData,
} from "@/lib/next/live-model";

const input: NewClientInput = {
  draftId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  businessName: "Example Studio",
  contactName: "Alex",
  email: "alex@example.com",
  phone: "",
  projectName: "Platform",
  brief: "",
  owner: "",
  serviceRoute: "managed",
};
const empty: OperationsData = {
  clients: [],
  projects: [],
  invoices: [],
  subscriptions: [],
  agreements: [],
  leads: [],
  unavailable: [],
  limited: [],
  loadedAt: "",
};

describe("Operations onboarding validation", () => {
  it("accepts an internal draft without any selected monthly plan", () =>
    expect(validateNewClient(input)).toBeNull());
  it.each([
    ["businessName", ""],
    ["businessName", "x".repeat(161)],
    ["contactName", ""],
    ["email", "not-an-email"],
    ["projectName", ""],
    ["phone", "1".repeat(61)],
    ["brief", "x".repeat(4001)],
    ["owner", "x".repeat(121)],
    ["serviceRoute", "max"],
    ["draftId", "invalid"],
    ["projectId", input.draftId],
  ])("rejects invalid %s", (key, value) =>
    expect(validateNewClient({ ...input, [key]: value })).not.toBeNull()
  );
  it("round-trips original draft metadata for safe retries", () => {
    expect(readDraftNotes(draftNotes(input, "staff-1"))).toMatchObject({
      actor: "staff-1",
      projectId: input.projectId,
      serviceRoute: "managed",
      projectName: "Platform",
    });
  });
  it.each([
    null,
    "Legacy notes",
    "Nullshift onboarding draft\nnot-json",
    "Nullshift onboarding draft\nnull",
    'Nullshift onboarding draft\n{"version":1,"actor":"staff-1","projectId":"x"}',
  ])("ignores malformed or legacy metadata", (notes) =>
    expect(readDraftNotes(notes)).toBeNull()
  );
});

describe("real-record financial summaries", () => {
  const subscriptions = [
    {
      id: "s",
      tenant_id: "c",
      status: "active",
      plan: "max",
      mrr: "180",
      provider: "stripe",
      created_at: "",
    },
    {
      id: "old",
      tenant_id: "c",
      status: "cancelled",
      plan: "core",
      mrr: 999,
      provider: "stripe",
      created_at: "",
    },
  ];
  it("uses stored GBP amounts without repricing legacy plans or dividing by 100", () => {
    expect(operationsSummary({ ...empty, subscriptions }).monthly).toBe(180);
    expect(money(180)).toBe("£180.00");
  });
  it("does not present unavailable subscriptions as zero", () =>
    expect(
      operationsSummary({ ...empty, unavailable: ["Subscriptions"] }).monthly
    ).toBeNull());
  it("does not sum an incomplete subscription list", () =>
    expect(
      operationsSummary({ ...empty, subscriptions, limited: ["Subscriptions"] }).monthly
    ).toBeNull());
  it("keeps unrecorded monthly fees unknown", () =>
    expect(
      operationsSummary({ ...empty, subscriptions: [{ ...subscriptions[0], mrr: null }] })
        .monthly
    ).toBeNull());
  it("does not present unavailable or truncated invoices as zero", () => {
    expect(
      operationsSummary({ ...empty, unavailable: ["Invoices"] }).openInvoices
    ).toBeNull();
    expect(
      operationsSummary({ ...empty, limited: ["Invoices"] }).openInvoices
    ).toBeNull();
  });
  it("only totals recorded open invoices, not paid or draft amounts", () => {
    const invoice = {
      id: "i",
      tenant_id: "c",
      project_id: null,
      amount: "250",
      type: "build",
      due_at: null,
      created_at: "",
    };
    expect(
      operationsSummary({
        ...empty,
        invoices: [
          { ...invoice, status: "open" },
          { ...invoice, id: "j", amount: 1000, status: "paid" },
        ],
      }).openInvoices
    ).toBe(250);
  });
});
