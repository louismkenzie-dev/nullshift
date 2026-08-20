import { describe, it, expect } from "vitest";
import { projectBalance, tenantBalance } from "@/lib/billing/balance";

/**
 * The bug this guards against: the client portal reported "£0 outstanding —
 * nothing owed, all settled" to a client who had paid a £1,000 deposit against
 * a £2,000 build and had never been invoiced for the balance. The page was
 * faithfully summing invoices; the invoice simply did not exist.
 */

// The Dance Exclusive, exactly as the rows stand: a £2,000 build, a −£1,000
// deposit credit line, and one paid £1,000 deposit invoice. The project was
// agreed offline, so its proposal_status is still "sent".
const P = "proj-1";
const items = [
  { project_id: P, amount: "2000.00", status: "built" },
  { project_id: P, amount: "-1000.00", status: "accepted" },
];
const deposit = {
  project_id: P,
  amount: "1000.00",
  status: "paid",
  type: "one_off",
};
const project = { id: P, proposal_status: "sent" };

describe("what a client actually owes", () => {
  it("counts agreed work that has never been invoiced", () => {
    const b = projectBalance(items, [deposit]);
    expect(b.agreedTotal).toBe(1000);
    expect(b.invoicedTotal).toBe(0);
    expect(b.unbilledTotal).toBe(1000);
    expect(b.outstandingTotal).toBe(1000);
  });

  it("still reports the deposit as paid", () => {
    expect(projectBalance(items, [deposit]).paidTotal).toBe(1000);
  });

  it("stops counting it as unbilled once the invoice is raised", () => {
    const b = projectBalance(items, [
      deposit,
      { project_id: P, amount: "1000.00", status: "open", type: "build_milestone" },
    ]);
    expect(b.unbilledTotal).toBe(0);
    expect(b.openTotal).toBe(1000);
    // It moved from "to be invoiced" to "awaiting payment"; the headline the
    // client sees must not change when it does.
    expect(b.outstandingTotal).toBe(1000);
  });

  it("clears once that invoice is paid", () => {
    const b = projectBalance(items, [
      deposit,
      { project_id: P, amount: "1000.00", status: "paid", type: "build_milestone" },
    ]);
    expect(b.outstandingTotal).toBe(0);
    expect(b.paidTotal).toBe(2000);
  });

  it("ignores drafts and voided invoices", () => {
    const b = projectBalance(items, [
      { project_id: P, amount: "1000.00", status: "void", type: "build_milestone" },
      { project_id: P, amount: "1000.00", status: "draft", type: "build_milestone" },
    ]);
    // A voided invoice is not billed work — the balance is still owed.
    expect(b.unbilledTotal).toBe(1000);
    expect(b.paidTotal).toBe(0);
  });

  it("never shows over-invoicing as a credit the client can spend", () => {
    const b = projectBalance(
      [{ amount: "500.00", status: "built" }],
      [{ amount: "900.00", status: "open", type: "build_milestone" }]
    );
    expect(b.unbilledTotal).toBe(0);
    expect(b.outstandingTotal).toBe(900);
  });

  it("says nothing is owed when nothing is", () => {
    expect(projectBalance([], []).outstandingTotal).toBe(0);
  });
});

describe("quotes are not debts", () => {
  it("does not bill an unaccepted proposal", () => {
    const b = projectBalance([{ amount: "5000.00", status: "proposed" }], []);
    expect(b.agreedTotal).toBe(0);
    expect(b.outstandingTotal).toBe(0);
  });

  it("does count proposed lines once the PROJECT is accepted", () => {
    // Accepting a proposal snapshots the scope onto the project; it does not
    // rewrite each item's status. Reading item status alone would report £0
    // owed for every client who signed through the portal.
    const b = projectBalance([{ amount: "5000.00", status: "proposed" }], [], {
      projectAccepted: true,
    });
    expect(b.agreedTotal).toBe(5000);
    expect(b.outstandingTotal).toBe(5000);
  });
});

describe("a client with more than one project", () => {
  const accepted = { id: "p-accepted", proposal_status: "accepted" };
  const quote = { id: "p-quote", proposal_status: "sent" };

  it("keeps a live quote out of the balance while billing the signed build", () => {
    const b = tenantBalance(
      [accepted, quote],
      [
        { project_id: "p-accepted", amount: "3000.00", status: "proposed" },
        { project_id: "p-quote", amount: "9000.00", status: "proposed" },
      ],
      []
    );
    expect(b.outstandingTotal).toBe(3000);
  });

  it("folds The Dance Exclusive to the figure the portal must show", () => {
    const b = tenantBalance([project], items, [deposit]);
    expect(b.outstandingTotal).toBe(1000);
    expect(b.unbilledTotal).toBe(1000);
    expect(b.paidTotal).toBe(1000);
  });

  it("counts an ad-hoc invoice with no project behind it", () => {
    const b = tenantBalance(
      [project],
      items,
      [deposit, { project_id: null, amount: "250.00", status: "open", type: "one_off" }]
    );
    expect(b.openTotal).toBe(250);
    expect(b.outstandingTotal).toBe(1250);
  });

  it("does not double-count an invoice whose project was deleted", () => {
    const b = tenantBalance(
      [],
      [],
      [{ project_id: "gone", amount: "400.00", status: "open", type: "one_off" }]
    );
    expect(b.outstandingTotal).toBe(400);
  });
});
