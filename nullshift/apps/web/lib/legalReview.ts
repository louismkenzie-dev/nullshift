import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { recordDocumentEvent, type DocumentType } from "@/lib/documentEvents";
import {
  LEGAL_DOCUMENT_KINDS,
  REVIEW_BLOCKED,
  canApprove,
  reviewState,
  type LegalDocumentKind,
  type ReviewInput,
} from "@/lib/legal/review";

export {
  LEGAL_DOCUMENT_KINDS,
  LEGAL_DOCUMENT_LABEL,
  REVIEW_BLOCKED,
  REVIEW_REASON,
  blockedMessage,
  canApprove,
  reviewState,
  type LegalDocumentKind,
  type ReviewInput,
  type ReviewState,
} from "@/lib/legal/review";

/**
 * Second-person review gate for legal documents (migration 0049).
 *
 * The pure rule lives in lib/legal/review.ts (reviewState / canApprove). This
 * module is the I/O around it: the `approveDocument` server action the
 * ReviewGate component posts to, the loader the action uses, and the staff
 * name resolver the UI uses to print "Drafted by X · Approved by Y".
 *
 * Author columns: projects.proposal_drafted_by for the proposal (stamped by
 * the proposal save actions), created_by for order_forms and change_orders
 * (already stamped on create). Approval columns: projects.proposal_reviewed_by
 * / _at, order_forms.reviewed_by / _at, change_orders.reviewed_by / _at.
 */

type Service = ReturnType<typeof createServiceClient>;

/** Map a raw table row of the given kind onto the pure rule's input. */
export function reviewInputOf(
  kind: LegalDocumentKind,
  row: Record<string, unknown> | null | undefined
): ReviewInput {
  const r = (row ?? {}) as Record<string, string | null | undefined>;
  if (kind === "proposal") {
    return {
      author: r.proposal_drafted_by,
      reviewedBy: r.proposal_reviewed_by,
      reviewedAt: r.proposal_reviewed_at,
    };
  }
  return { author: r.created_by, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at };
}

export type LegalDocument = {
  kind: LegalDocumentKind;
  id: string;
  tenantId: string;
  /** Proposal → project name; Order Form / Change Order → reference. */
  reference: string;
  status: string;
  /** Still a draft nothing has been sent from. */
  draft: boolean;
  review: ReviewInput;
};

/** Load the one row the gate needs, whichever table it lives in. */
export async function loadLegalDocument(
  service: Service,
  kind: LegalDocumentKind,
  id: string
): Promise<LegalDocument | null> {
  if (kind === "proposal") {
    const { data } = await service
      .from("projects")
      .select(
        "id, tenant_id, name, proposal_status, proposal_drafted_by, proposal_reviewed_by, proposal_reviewed_at"
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const status = (data.proposal_status as string | null) ?? "draft";
    return {
      kind,
      id: data.id as string,
      tenantId: data.tenant_id as string,
      reference: (data.name as string | null) ?? "Proposal",
      status,
      draft: status === "draft",
      review: reviewInputOf(kind, data as Record<string, unknown>),
    };
  }
  const table = kind === "order_form" ? "order_forms" : "change_orders";
  const { data } = await service
    .from(table)
    .select("id, tenant_id, reference, status, created_by, reviewed_by, reviewed_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const status = data.status as string;
  return {
    kind,
    id: data.id as string,
    tenantId: data.tenant_id as string,
    reference: data.reference as string,
    status,
    draft: status === "draft",
    review: reviewInputOf(kind, data as Record<string, unknown>),
  };
}

/** Where an approve/send action lands the staff member afterwards. */
export function legalReturnPath(kind: LegalDocumentKind, tenantId: string): string {
  return kind === "proposal"
    ? `/admin/clients/${tenantId}/docs`
    : `/admin/clients/${tenantId}/agreement`;
}

/** Only ever bounce to an admin path we rendered ourselves. */
function safeReturnTo(raw: FormDataEntryValue | null, fallback: string): string {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/admin/") || s.startsWith("//") || /[\s\\]/.test(s)) return fallback;
  return s.split("?")[0] ?? fallback;
}

/** `path?blocked=code` — the pages read `blocked` and show the reason. */
export function blockedHref(path: string, code: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}blocked=${encodeURIComponent(code)}`;
}

const LEDGER_TYPES: Record<LegalDocumentKind, DocumentType[]> = {
  // The proposal and its DPA go out together and share the project id.
  proposal: ["proposal", "dpa"],
  order_form: ["order_form"],
  change_order: ["change_order"],
};

const AUDIT_TARGET: Record<LegalDocumentKind, string> = {
  proposal: "project",
  order_form: "order_form",
  change_order: "change_order",
};

/**
 * Approve a draft for sending. Form fields: kind, id, tenant_id, return_to.
 *
 * Refuses when the approver is the author (redirects back with
 * ?blocked=self_approval — the button is already disabled for them, this is
 * the server saying it too), and when the document is no longer a draft.
 * Stamps reviewed_by / reviewed_at, appends an `approved` row to the
 * document_events ledger and writes a `legal.approved` audit entry.
 */
export async function approveDocument(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;

  const kind = String(formData.get("kind") || "") as LegalDocumentKind;
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  if (!(LEGAL_DOCUMENT_KINDS as readonly string[]).includes(kind) || !id || !tenantId)
    return;
  const returnTo = safeReturnTo(
    formData.get("return_to"),
    legalReturnPath(kind, tenantId)
  );

  const service = createServiceClient();
  const doc = await loadLegalDocument(service, kind, id);
  if (!doc || doc.tenantId !== tenantId) return;

  if (!doc.draft) {
    console.warn(
      `legal review: ${kind} ${id} is '${doc.status}', not a draft — nothing to approve`
    );
    redirect(blockedHref(returnTo, REVIEW_BLOCKED.notDraft));
  }

  const gate = canApprove(doc.review, staff.userId);
  if (!gate.ok) {
    console.warn(`legal review: ${staff.email} tried to approve their own ${kind} ${id}`);
    await logAudit({
      action: "legal.approval_refused",
      target: `${AUDIT_TARGET[kind]}:${id}`,
      tenantId,
      metadata: { kind, reference: doc.reference, reason: "author" },
    });
    redirect(blockedHref(returnTo, REVIEW_BLOCKED.selfApproval));
  }

  const now = new Date().toISOString();
  if (kind === "proposal") {
    await service
      .from("projects")
      .update({ proposal_reviewed_by: staff.userId, proposal_reviewed_at: now })
      .eq("id", id)
      .eq("proposal_status", "draft");
  } else {
    await service
      .from(kind === "order_form" ? "order_forms" : "change_orders")
      .update({ reviewed_by: staff.userId, reviewed_at: now })
      .eq("id", id)
      .eq("status", "draft");
  }

  for (const documentType of LEDGER_TYPES[kind])
    await recordDocumentEvent(service, {
      tenantId,
      documentType,
      documentId: id,
      event: "approved",
      actor: staff.userId,
      actorKind: "staff",
      meta: { kind, reference: doc.reference, author: doc.review.author ?? null },
    });

  await logAudit({
    action: "legal.approved",
    target: `${AUDIT_TARGET[kind]}:${id}`,
    tenantId,
    metadata: { kind, reference: doc.reference, author: doc.review.author ?? null },
  });

  revalidatePath(returnTo);
  redirect(returnTo);
}

/**
 * The gate a SEND action calls. Returns the review state; when the document
 * cannot be sent it logs, audits and redirects back with ?blocked=review —
 * so the caller simply does `await assertSendable(...)` before flipping the
 * status. (`redirect` throws, which is what stops the send.)
 */
export async function assertSendable(input: {
  kind: LegalDocumentKind;
  id: string;
  tenantId: string;
  reference: string;
  review: ReviewInput;
  returnTo?: string;
}) {
  const state = reviewState(input.review);
  if (state.canSend) return state;
  console.warn(
    `legal review: refusing to send ${input.kind} ${input.id} (${input.reference}) — ${state.reason}`
  );
  await logAudit({
    action: `${input.kind}.send_blocked`,
    target: `${AUDIT_TARGET[input.kind]}:${input.id}`,
    tenantId: input.tenantId,
    metadata: { reason: "review", detail: state.reason, reference: input.reference },
  });
  redirect(
    blockedHref(
      input.returnTo ?? legalReturnPath(input.kind, input.tenantId),
      REVIEW_BLOCKED.review
    )
  );
}

/* ── staff names ───────────────────────────────────────────────── */

type StaffInfo = { label: string; email: string | null; role: string | null };

/**
 * Display names for staff user ids: the auth user's name (metadata) or email,
 * plus their role on the internal tenant when they hold one. Missing users
 * (deleted accounts) resolve to a short id so a receipt never prints blank.
 */
export async function staffInfo(
  userIds: Array<string | null | undefined>
): Promise<Record<string, StaffInfo>> {
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
  if (ids.length === 0) return {};
  const service = createServiceClient();

  const [{ data: memberships }, users] = await Promise.all([
    service
      .from("memberships")
      .select("user_id, role, tenants!inner(type)")
      .in("user_id", ids)
      .eq("tenants.type", "internal"),
    Promise.all(
      ids.map(async (id) => {
        try {
          const { data } = await service.auth.admin.getUserById(id);
          return [id, data.user ?? null] as const;
        } catch {
          return [id, null] as const;
        }
      })
    ),
  ]);

  const roleOf = new Map<string, string>();
  for (const m of (memberships ?? []) as Array<{ user_id: string; role: string }>)
    roleOf.set(m.user_id, m.role);

  const out: Record<string, StaffInfo> = {};
  for (const [id, user] of users) {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const name = [meta.full_name, meta.name, meta.display_name].find(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    );
    const email = user?.email ?? null;
    out[id] = {
      label: name?.trim() || email || `staff ${id.slice(0, 8)}`,
      email,
      role: roleOf.get(id) ?? null,
    };
  }
  return out;
}

/** `{ [userId]: "Name" | email | "staff 1a2b3c4d" }` */
export async function staffLabels(
  userIds: Array<string | null | undefined>
): Promise<Record<string, string>> {
  const info = await staffInfo(userIds);
  return Object.fromEntries(Object.entries(info).map(([id, i]) => [id, i.label]));
}

export async function staffLabel(userId: string | null | undefined): Promise<string> {
  if (!userId) return "—";
  const labels = await staffLabels([userId]);
  return labels[userId] ?? `staff ${userId.slice(0, 8)}`;
}
