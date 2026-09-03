import type { createServiceClient } from "@nullshift/db";
import { isClientPreview } from "@/lib/clientPreview";
import { CARE_PLAN_TERMS_VERSION } from "@/lib/carePlanTerms";

/**
 * Document read receipts (migration 0048).
 *
 * Every document a client is asked to sign — the proposal, the DPA that goes
 * out with it, the Order Form, each Change Order, the care-plan terms, and the
 * contracts uploaded as deliverables — gets WhatsApp-style ticks: SENT when
 * staff release it, VIEWED the first time the real client opens it in the
 * portal, SIGNED when they accept it, and APPROVED when a second staff member
 * signs off the draft before it can be sent (the review gate).
 *
 * Two sources are merged to build a receipt. The `document_events` ledger is
 * the new, precise record; the sent/signed facts that already live on the
 * document rows (projects.proposal_sent_at, order_forms.accepted_at, ...) are
 * unioned in so documents that went out before the ledger existed still show
 * their ticks. The ledger is written ONLY through the service client and only
 * from trusted server code — a client can never mint their own tick.
 */

export const DOCUMENT_TYPES = [
  "proposal",
  "dpa",
  "order_form",
  "change_order",
  "care_plan_terms",
  "deliverable",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentEventKind = "sent" | "viewed" | "signed" | "approved";
export type DocumentActorKind = "client" | "staff" | "system";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  proposal: "Proposal",
  dpa: "Data Processing Agreement",
  order_form: "Order Form",
  change_order: "Change Order",
  care_plan_terms: "Care plan terms",
  deliverable: "Document",
};

type Service = ReturnType<typeof createServiceClient>;

export type DocumentEventInput = {
  tenantId: string;
  documentType: DocumentType;
  documentId: string;
  event: DocumentEventKind;
  actor: string | null;
  actorKind: DocumentActorKind;
  meta?: Record<string, unknown>;
};

/**
 * Append one event. Best-effort: a receipt must never break the action that
 * produced it, so every failure is logged and swallowed.
 *
 * - A client event is dropped when the request is a staff "view as client"
 *   preview (the ns_client_preview cookie): staff opening the client's portal
 *   is not the client reading their agreement.
 * - `viewed` records the FIRST view only. Later opens are not interesting
 *   for a receipt and would otherwise add a row per page load.
 */
export async function recordDocumentEvent(
  service: Service,
  input: DocumentEventInput
): Promise<void> {
  try {
    if (input.actorKind === "client" && (await previewRequest())) return;

    if (input.event === "viewed") {
      const { data: prior } = await service
        .from("document_events")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("document_type", input.documentType)
        .eq("document_id", input.documentId)
        .eq("event", "viewed")
        .limit(1);
      if (prior && prior.length > 0) return;
    }

    const { error } = await service.from("document_events").insert({
      tenant_id: input.tenantId,
      document_type: input.documentType,
      document_id: input.documentId,
      event: input.event,
      actor: input.actor,
      actor_kind: input.actorKind,
      meta: input.meta ?? {},
    });
    if (error) console.error("document_events insert failed:", error.message);
  } catch (e) {
    console.error("document_events insert threw:", e);
  }
}

/** Preview cookie present → true. Outside a request (no cookies) → false. */
async function previewRequest(): Promise<boolean> {
  try {
    return await isClientPreview();
  } catch {
    return false;
  }
}

/**
 * The portal pages' one-liner: "this signed-in user just rendered these
 * documents". Confirms the user really is a member of the tenant (a staff
 * account browsing /portal without the preview cookie is not the client)
 * before recording a first-view tick for each document.
 */
export async function recordClientViews(
  service: Service,
  input: {
    tenantId: string;
    userId: string;
    documents: Array<{ documentType: DocumentType; documentId: string }>;
  }
): Promise<void> {
  if (input.documents.length === 0) return;
  try {
    if (await previewRequest()) return;
    const { data: membership } = await service
      .from("memberships")
      .select("role")
      .eq("user_id", input.userId)
      .eq("tenant_id", input.tenantId)
      .in("role", ["client_admin", "client_member"])
      .limit(1)
      .maybeSingle();
    if (!membership) return;
    await Promise.all(
      input.documents.map((d) =>
        recordDocumentEvent(service, {
          tenantId: input.tenantId,
          documentType: d.documentType,
          documentId: d.documentId,
          event: "viewed",
          actor: input.userId,
          actorKind: "client",
        })
      )
    );
  } catch (e) {
    console.error("recordClientViews threw:", e);
  }
}

/* ── receipts ──────────────────────────────────────────────────── */

export type DocumentReceipt = {
  documentType: string;
  documentId: string;
  title: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  approvedAt: string | null;
  awaitingApproval: boolean;
};

/** A ledger row, as read from document_events. */
export type DocumentEventRow = {
  document_type: string;
  document_id: string;
  event: string;
  actor_kind: string;
  at: string;
};

/**
 * What the document's own table already says about it. One per document the
 * client is (or was) asked to sign.
 */
export type DocumentFact = {
  documentType: DocumentType;
  documentId: string;
  title: string;
  sentAt: string | null;
  signedAt: string | null;
  /** Evidence of a first view that lives outside the ledger (optional). */
  viewedAt?: string | null;
  /** True while the document is a draft nothing has been sent from yet. */
  draft: boolean;
};

const ms = (iso: string | null | undefined) => {
  if (!iso) return NaN;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : NaN;
};

/** Earliest of the given timestamps (invalid/null ignored). */
export function earliest(...isos: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const iso of isos) {
    const t = ms(iso);
    if (Number.isNaN(t)) continue;
    if (best === null || t < ms(best)) best = iso as string;
  }
  return best;
}

/** Latest of the given timestamps (invalid/null ignored). */
export function latest(...isos: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const iso of isos) {
    const t = ms(iso);
    if (Number.isNaN(t)) continue;
    if (best === null || t > ms(best)) best = iso as string;
  }
  return best;
}

const keyOf = (type: string, id: string) => `${type}:${id}`;

/**
 * Pure merge of the ledger with the facts on the document rows.
 *
 * - sentAt / signedAt: the earliest of the fact and the ledger (a document
 *   is sent once; whichever record noticed first is right).
 * - viewedAt: the FIRST client `viewed` event; failing that, the fact's own
 *   view evidence. Staff and system views never count.
 * - approvedAt: the latest `approved` event (a re-drafted document is
 *   re-approved, and the newest approval is the one that matters).
 * - awaitingApproval: still a draft, never sent, never approved.
 *
 * Ledger rows for a document with no fact (the row was deleted or
 * re-drafted) still get a receipt, titled by type, so a receipt never
 * silently disappears.
 */
export function mergeReceipts(
  events: DocumentEventRow[],
  facts: DocumentFact[]
): DocumentReceipt[] {
  const byKey = new Map<
    string,
    {
      sent: string | null;
      viewed: string | null;
      signed: string | null;
      approved: string | null;
    }
  >();
  const bucket = (type: string, id: string) => {
    const k = keyOf(type, id);
    let b = byKey.get(k);
    if (!b) {
      b = { sent: null, viewed: null, signed: null, approved: null };
      byKey.set(k, b);
    }
    return b;
  };

  for (const e of events) {
    const b = bucket(e.document_type, e.document_id);
    switch (e.event) {
      case "sent":
        b.sent = earliest(b.sent, e.at);
        break;
      case "viewed":
        if (e.actor_kind === "client") b.viewed = earliest(b.viewed, e.at);
        break;
      case "signed":
        b.signed = earliest(b.signed, e.at);
        break;
      case "approved":
        b.approved = latest(b.approved, e.at);
        break;
    }
  }

  const seen = new Set<string>();
  const out: DocumentReceipt[] = [];

  for (const f of facts) {
    const k = keyOf(f.documentType, f.documentId);
    seen.add(k);
    const b = byKey.get(k);
    const sentAt = earliest(f.sentAt, b?.sent);
    const signedAt = earliest(f.signedAt, b?.signed);
    const viewedAt = b?.viewed ?? f.viewedAt ?? null;
    const approvedAt = b?.approved ?? null;
    out.push({
      documentType: f.documentType,
      documentId: f.documentId,
      title: f.title,
      sentAt,
      viewedAt,
      signedAt,
      approvedAt,
      awaitingApproval: f.draft && sentAt === null && approvedAt === null,
    });
  }

  for (const [k, b] of byKey) {
    if (seen.has(k)) continue;
    const idx = k.indexOf(":");
    const type = k.slice(0, idx);
    const id = k.slice(idx + 1);
    const label = DOCUMENT_TYPE_LABEL[type as DocumentType] ?? type;
    out.push({
      documentType: type,
      documentId: id,
      title: `${label} ${id.length > 12 ? id.slice(0, 8) : id}`,
      sentAt: b.sent,
      viewedAt: b.viewed,
      signedAt: b.signed,
      approvedAt: b.approved,
      awaitingApproval: false,
    });
  }

  const order = (t: string) => {
    const i = (DOCUMENT_TYPES as readonly string[]).indexOf(t);
    return i === -1 ? DOCUMENT_TYPES.length : i;
  };
  // Stable: facts arrive in the caller's order, so equal types keep it.
  return out
    .map((r, i) => ({ r, i }))
    .sort((a, b) => order(a.r.documentType) - order(b.r.documentType) || a.i - b.i)
    .map(({ r }) => r);
}

/* ── facts from the document tables ────────────────────────────── */

type ProjectRow = {
  id: string;
  name: string | null;
  proposal_status: string | null;
  proposal_sent_at: string | null;
  accepted_at: string | null;
  client_entity_type: string | null;
  dpa_client_submitted_at: string | null;
};
type OrderFormRow = {
  id: string;
  reference: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
};
type ChangeOrderRow = {
  id: string;
  reference: string;
  description: string | null;
  status: string;
  accepted_at: string | null;
};
type DocumentRow = {
  id: string;
  kind: string;
  storage_path: string;
  version: number;
  created_at: string;
};
type AuditRow = { action: string; target: string | null; created_at: string };

const DELIVERABLE_KIND_LABEL: Record<string, string> = {
  contract: "Contract",
  consent: "Consent form",
  dpa: "Data Processing Agreement",
};

/** `<tenant>/<project>/v3-Signed_MSA.pdf` → `Signed_MSA.pdf`. */
function deliverableName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^v\d+-/, "");
}

/**
 * Build the fact list for a tenant from the tables that hold the documents.
 * Exported for the merge test and so the review-gate UI can reuse it.
 */
export function documentFacts(input: {
  projects: ProjectRow[];
  dpaSignedAt: string | null;
  orderForms: OrderFormRow[];
  acceptances: Array<{ order_form_id: string; accepted_at: string | null }>;
  changeOrders: ChangeOrderRow[];
  tenant: {
    care_plan_terms_version: string | null;
    care_plan_terms_accepted_at: string | null;
  } | null;
  documents: DocumentRow[];
  audit: AuditRow[];
  events: DocumentEventRow[];
}): DocumentFact[] {
  const facts: DocumentFact[] = [];

  // The proposal and the DPA go out together and are signed with one
  // signature, so they share the project's timestamps; the DPA additionally
  // counts a compliance_records dpa_signed row (an offline signature recorded
  // by staff) and the client's own DPA declaration as proof they opened it.
  for (const p of input.projects) {
    const draft = (p.proposal_status ?? "draft") === "draft";
    const name = p.name ? ` — ${p.name}` : "";
    facts.push({
      documentType: "proposal",
      documentId: p.id,
      title: `Proposal${name}`,
      sentAt: p.proposal_sent_at,
      signedAt: p.accepted_at,
      draft,
    });
    const submitted = p.dpa_client_submitted_at;
    const dpaViewed =
      submitted && p.proposal_sent_at && ms(submitted) >= ms(p.proposal_sent_at)
        ? submitted
        : null;
    facts.push({
      documentType: "dpa",
      documentId: p.id,
      title:
        p.client_entity_type === "sole_trader"
          ? `Service terms & data processing${name}`
          : `Data Processing Agreement${name}`,
      sentAt: p.proposal_sent_at,
      signedAt: p.accepted_at ?? input.dpaSignedAt,
      viewedAt: dpaViewed,
      draft,
    });
  }

  for (const o of input.orderForms) {
    if (o.status === "superseded" || o.status === "withdrawn") continue;
    const acceptance = input.acceptances.find((a) => a.order_form_id === o.id);
    facts.push({
      documentType: "order_form",
      documentId: o.id,
      title: `Order Form ${o.reference}`,
      sentAt: o.sent_at,
      signedAt: o.accepted_at ?? acceptance?.accepted_at ?? null,
      draft: o.status === "draft",
    });
  }

  // change_orders has no sent_at column: the audit row written when staff
  // moved it to client_review is the existing sent fact.
  for (const c of input.changeOrders) {
    if (c.status === "superseded" || c.status === "withdrawn") continue;
    const sentAudit = input.audit
      .filter(
        (a) =>
          a.action === "change_order.client_review" && a.target === `change_order:${c.id}`
      )
      .map((a) => a.created_at);
    const desc = (c.description ?? "").trim();
    facts.push({
      documentType: "change_order",
      documentId: c.id,
      title: `Change Order ${c.reference}${desc ? ` — ${desc.length > 60 ? desc.slice(0, 57) + "…" : desc}` : ""}`,
      sentAt: earliest(...sentAudit),
      signedAt: c.accepted_at,
      draft: c.status === "draft",
    });
  }

  // Care-plan terms: fixed text, versioned. "Sent" when the plan options went
  // out (audit care_plan.plan_invite_sent); "signed" on the tenant row. Only
  // listed once there is something to show — a client whose system is still
  // in build has not been asked to sign them yet.
  const termsVersion = input.tenant?.care_plan_terms_version ?? CARE_PLAN_TERMS_VERSION;
  const inviteSent = earliest(
    ...input.audit
      .filter((a) => a.action === "care_plan.plan_invite_sent")
      .map((a) => a.created_at)
  );
  const termsAccepted = input.tenant?.care_plan_terms_accepted_at ?? null;
  const termsEvents = input.events.some(
    (e) => e.document_type === "care_plan_terms" && e.document_id === termsVersion
  );
  if (inviteSent || termsAccepted || termsEvents) {
    facts.push({
      documentType: "care_plan_terms",
      documentId: termsVersion,
      title: `Care plan terms (${termsVersion})`,
      sentAt: inviteSent,
      signedAt: termsAccepted,
      draft: false,
    });
  }

  // Uploaded legal artefacts (contracts, consent forms). Available to the
  // client from the moment of upload; a signature on an upload is only known
  // through the ledger (a staff-recorded `signed` event).
  for (const d of input.documents) {
    if (d.kind !== "contract" && d.kind !== "consent") continue;
    facts.push({
      documentType: "deliverable",
      documentId: d.id,
      title: `${DELIVERABLE_KIND_LABEL[d.kind] ?? "Document"} — ${deliverableName(d.storage_path)} (v${d.version})`,
      sentAt: d.created_at,
      signedAt: null,
      draft: false,
    });
  }

  return facts;
}

/**
 * One receipt per document the client is asked to sign, for the Docs and
 * Legal tile. Reads through the service client (staff-only surface — the
 * ledger has no client policy).
 */
export async function documentReceipts(
  service: Service,
  tenantId: string
): Promise<
  Array<{
    documentType: string;
    documentId: string;
    title: string;
    sentAt: string | null;
    viewedAt: string | null;
    signedAt: string | null;
    approvedAt: string | null;
    awaitingApproval: boolean;
  }>
> {
  const [
    { data: projects },
    { data: dpaRecords },
    { data: orderForms },
    { data: acceptances },
    { data: changeOrders },
    { data: tenant },
    { data: documents },
    { data: audit },
    { data: events },
  ] = await Promise.all([
    service
      .from("projects")
      .select(
        "id, name, proposal_status, proposal_sent_at, accepted_at, client_entity_type, dpa_client_submitted_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    service
      .from("compliance_records")
      .select("recorded_at")
      .eq("tenant_id", tenantId)
      .eq("kind", "dpa_signed")
      .order("recorded_at", { ascending: true })
      .limit(1),
    service
      .from("order_forms")
      .select("id, reference, status, sent_at, accepted_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    service
      .from("contract_acceptances")
      .select("order_form_id, accepted_at")
      .eq("tenant_id", tenantId),
    service
      .from("change_orders")
      .select("id, reference, description, status, accepted_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    service
      .from("tenants")
      .select("care_plan_terms_version, care_plan_terms_accepted_at")
      .eq("id", tenantId)
      .maybeSingle(),
    service
      .from("documents")
      .select("id, kind, storage_path, version, created_at")
      .eq("tenant_id", tenantId)
      .in("kind", ["contract", "consent"])
      .order("created_at", { ascending: false }),
    service
      .from("audit_log")
      .select("action, target, created_at")
      .eq("tenant_id", tenantId)
      .in("action", ["change_order.client_review", "care_plan.plan_invite_sent"])
      .order("created_at", { ascending: true }),
    service
      .from("document_events")
      .select("document_type, document_id, event, actor_kind, at")
      .eq("tenant_id", tenantId)
      .order("at", { ascending: true }),
  ]);

  const eventRows = (events ?? []) as DocumentEventRow[];
  const facts = documentFacts({
    projects: (projects ?? []) as ProjectRow[],
    dpaSignedAt:
      ((dpaRecords ?? [])[0] as { recorded_at: string } | undefined)?.recorded_at ?? null,
    orderForms: (orderForms ?? []) as OrderFormRow[],
    acceptances: (acceptances ?? []) as Array<{
      order_form_id: string;
      accepted_at: string | null;
    }>,
    changeOrders: (changeOrders ?? []) as ChangeOrderRow[],
    tenant: (tenant ?? null) as {
      care_plan_terms_version: string | null;
      care_plan_terms_accepted_at: string | null;
    } | null,
    documents: (documents ?? []) as DocumentRow[],
    audit: (audit ?? []) as AuditRow[],
    events: eventRows,
  });

  return mergeReceipts(eventRows, facts);
}
