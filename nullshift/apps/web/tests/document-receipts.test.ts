import { describe, expect, it } from "vitest";
import {
  documentFacts,
  earliest,
  latest,
  mergeReceipts,
  type DocumentEventRow,
  type DocumentFact,
} from "@/lib/documentEvents";

/**
 * Read receipts are a union of the new document_events ledger and the
 * sent/signed facts already on the document rows. These pins keep the
 * merge honest: a staff preview never counts as a view, the first client
 * view wins, an old document keeps its ticks without any ledger rows, and
 * "awaiting approval" means exactly draft + never sent + never approved.
 */

const T1 = "2026-09-01T09:00:00.000Z";
const T2 = "2026-09-02T09:00:00.000Z";
const T3 = "2026-09-03T09:00:00.000Z";
const T4 = "2026-09-04T09:00:00.000Z";

const ev = (
  document_type: string,
  document_id: string,
  event: string,
  at: string,
  actor_kind = "client"
): DocumentEventRow => ({ document_type, document_id, event, actor_kind, at });

const fact = (over: Partial<DocumentFact> = {}): DocumentFact => ({
  documentType: "proposal",
  documentId: "p1",
  title: "Proposal — Site",
  sentAt: null,
  signedAt: null,
  draft: true,
  ...over,
});

describe("earliest / latest", () => {
  it("ignore nulls and unparsable values", () => {
    expect(earliest(null, undefined, "nope", T2, T1)).toBe(T1);
    expect(latest(null, "nope", T2, T1)).toBe(T2);
    expect(earliest()).toBeNull();
    expect(latest(null, undefined)).toBeNull();
  });
});

describe("mergeReceipts", () => {
  it("keeps the facts' ticks when the ledger has nothing (pre-ledger documents)", () => {
    const out = mergeReceipts([], [fact({ sentAt: T1, signedAt: T3, draft: false })]);
    expect(out).toEqual([
      {
        documentType: "proposal",
        documentId: "p1",
        title: "Proposal — Site",
        sentAt: T1,
        viewedAt: null,
        signedAt: T3,
        approvedAt: null,
        awaitingApproval: false,
      },
    ]);
  });

  it("takes the FIRST client view and ignores staff/system views", () => {
    const out = mergeReceipts(
      [
        ev("proposal", "p1", "viewed", T1, "staff"),
        ev("proposal", "p1", "viewed", T3),
        ev("proposal", "p1", "viewed", T2),
        ev("proposal", "p1", "viewed", T4, "system"),
      ],
      [fact({ sentAt: T1, draft: false })]
    );
    expect(out[0].viewedAt).toBe(T2);
  });

  it("falls back to the fact's own view evidence when no client view was logged", () => {
    const out = mergeReceipts([], [fact({ sentAt: T1, viewedAt: T2, draft: false })]);
    expect(out[0].viewedAt).toBe(T2);
    const withEvent = mergeReceipts(
      [ev("proposal", "p1", "viewed", T3)],
      [fact({ sentAt: T1, viewedAt: T2, draft: false })]
    );
    expect(withEvent[0].viewedAt).toBe(T3);
  });

  it("unions sent/signed: the earliest of fact and ledger wins", () => {
    const out = mergeReceipts(
      [ev("proposal", "p1", "sent", T2, "staff"), ev("proposal", "p1", "signed", T3)],
      [fact({ sentAt: T1, signedAt: T4, draft: false })]
    );
    expect(out[0].sentAt).toBe(T1);
    expect(out[0].signedAt).toBe(T3);
  });

  it("reports the LATEST approval", () => {
    const out = mergeReceipts(
      [
        ev("proposal", "p1", "approved", T1, "staff"),
        ev("proposal", "p1", "approved", T3, "staff"),
      ],
      [fact()]
    );
    expect(out[0].approvedAt).toBe(T3);
    expect(out[0].awaitingApproval).toBe(false);
  });

  it("awaitingApproval = draft + never sent + never approved", () => {
    expect(mergeReceipts([], [fact({ draft: true })])[0].awaitingApproval).toBe(true);
    expect(mergeReceipts([], [fact({ draft: false })])[0].awaitingApproval).toBe(false);
    expect(
      mergeReceipts([], [fact({ draft: true, sentAt: T1 })])[0].awaitingApproval
    ).toBe(false);
    expect(
      mergeReceipts(
        [ev("proposal", "p1", "approved", T1, "staff")],
        [fact({ draft: true })]
      )[0].awaitingApproval
    ).toBe(false);
  });

  it("keeps ledger rows whose document no longer has a fact, titled by type", () => {
    const out = mergeReceipts(
      [ev("order_form", "0f2d1c3a-1111-2222-3333-444444444444", "sent", T1, "staff")],
      []
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Order Form 0f2d1c3a");
    expect(out[0].sentAt).toBe(T1);
    expect(out[0].awaitingApproval).toBe(false);
  });

  it("orders by document type, keeping the facts' order within a type", () => {
    const out = mergeReceipts(
      [],
      [
        fact({ documentType: "change_order", documentId: "c2", title: "CO 2" }),
        fact({ documentType: "proposal", documentId: "p1", title: "P" }),
        fact({ documentType: "change_order", documentId: "c1", title: "CO 1" }),
        fact({ documentType: "dpa", documentId: "p1", title: "D" }),
      ]
    );
    expect(out.map((r) => r.title)).toEqual(["P", "D", "CO 2", "CO 1"]);
  });
});

describe("documentFacts", () => {
  const base = {
    projects: [],
    dpaSignedAt: null,
    orderForms: [],
    acceptances: [],
    changeOrders: [],
    tenant: null,
    documents: [],
    audit: [],
    events: [],
  };

  it("builds a proposal and a DPA row per project sharing the proposal timestamps", () => {
    const facts = documentFacts({
      ...base,
      projects: [
        {
          id: "p1",
          name: "Site",
          proposal_status: "sent",
          proposal_sent_at: T1,
          accepted_at: null,
          client_entity_type: "limited",
          dpa_client_submitted_at: T2,
        },
      ],
    });
    expect(facts.map((f) => f.documentType)).toEqual(["proposal", "dpa"]);
    expect(facts[0]).toMatchObject({ sentAt: T1, signedAt: null, draft: false });
    // The client submitted their DPA declaration after it was sent → they opened it.
    expect(facts[1]).toMatchObject({ sentAt: T1, viewedAt: T2, draft: false });
  });

  it("does not treat a DPA declaration made BEFORE sending as a view", () => {
    const [, dpa] = documentFacts({
      ...base,
      projects: [
        {
          id: "p1",
          name: "Site",
          proposal_status: "sent",
          proposal_sent_at: T2,
          accepted_at: null,
          client_entity_type: "limited",
          dpa_client_submitted_at: T1,
        },
      ],
    });
    expect(dpa.viewedAt).toBeNull();
  });

  it("signs the DPA from a staff-recorded compliance record when the proposal was not accepted online", () => {
    const [, dpa] = documentFacts({
      ...base,
      dpaSignedAt: T3,
      projects: [
        {
          id: "p1",
          name: null,
          proposal_status: "draft",
          proposal_sent_at: null,
          accepted_at: null,
          client_entity_type: null,
          dpa_client_submitted_at: null,
        },
      ],
    });
    expect(dpa.signedAt).toBe(T3);
    expect(dpa.draft).toBe(true);
  });

  it("uses the contract_acceptances row when order_forms.accepted_at is missing, and drops superseded/withdrawn forms", () => {
    const facts = documentFacts({
      ...base,
      orderForms: [
        {
          id: "o1",
          reference: "OF-1",
          status: "accepted",
          sent_at: T1,
          accepted_at: null,
        },
        {
          id: "o2",
          reference: "OF-2",
          status: "superseded",
          sent_at: T1,
          accepted_at: T2,
        },
        {
          id: "o3",
          reference: "OF-3",
          status: "withdrawn",
          sent_at: null,
          accepted_at: null,
        },
        {
          id: "o4",
          reference: "OF-4",
          status: "draft",
          sent_at: null,
          accepted_at: null,
        },
      ],
      acceptances: [{ order_form_id: "o1", accepted_at: T3 }],
    });
    expect(facts.map((f) => f.documentId)).toEqual(["o1", "o4"]);
    expect(facts[0]).toMatchObject({
      title: "Order Form OF-1",
      sentAt: T1,
      signedAt: T3,
    });
    expect(facts[1].draft).toBe(true);
  });

  it("reads a Change Order's sent time from the client_review audit row", () => {
    const facts = documentFacts({
      ...base,
      changeOrders: [
        {
          id: "c1",
          reference: "CO-1",
          description: "Add exports",
          status: "accepted",
          accepted_at: T3,
        },
      ],
      audit: [
        {
          action: "change_order.client_review",
          target: "change_order:other",
          created_at: T1,
        },
        {
          action: "change_order.client_review",
          target: "change_order:c1",
          created_at: T2,
        },
      ],
    });
    expect(facts[0]).toMatchObject({
      documentType: "change_order",
      title: "Change Order CO-1 — Add exports",
      sentAt: T2,
      signedAt: T3,
      draft: false,
    });
  });

  it("lists the care-plan terms only once they were sent, signed or logged", () => {
    expect(documentFacts(base)).toEqual([]);
    const sent = documentFacts({
      ...base,
      audit: [{ action: "care_plan.plan_invite_sent", target: null, created_at: T1 }],
    });
    expect(sent[0]).toMatchObject({
      documentType: "care_plan_terms",
      sentAt: T1,
      draft: false,
    });
    const signed = documentFacts({
      ...base,
      tenant: { care_plan_terms_version: "V9", care_plan_terms_accepted_at: T2 },
    });
    expect(signed[0]).toMatchObject({ documentId: "V9", signedAt: T2 });
  });

  it("includes contract/consent uploads (available from upload), never assets or briefs", () => {
    const facts = documentFacts({
      ...base,
      documents: [
        {
          id: "d1",
          kind: "contract",
          storage_path: "t/p/v2-Signed_MSA.pdf",
          version: 2,
          created_at: T1,
        },
        {
          id: "d2",
          kind: "asset",
          storage_path: "t/p/v1-logo.png",
          version: 1,
          created_at: T1,
        },
      ],
    });
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      documentType: "deliverable",
      documentId: "d1",
      title: "Contract — Signed_MSA.pdf (v2)",
      sentAt: T1,
      signedAt: null,
    });
  });
});
