import type { createServiceClient } from "@nullshift/db";

/**
 * finance_exceptions (0065) from service-role code paths — the GoCardless
 * webhook, the Direct Debit sweep, the bank-feed reconciler — where there is
 * no staff session and the flag-gated staff actions in ./exceptions.ts do not
 * apply. Same row shape, same "one OPEN row per (kind, subject)" rule: the
 * partial unique index turns a redelivered webhook or a repeated sweep into
 * `created: false` on the existing row, which callers use to send an alert
 * only once.
 */

type Service = ReturnType<typeof createServiceClient>;

export type OpenExceptionInput = {
  tenantId: string | null;
  kind: string;
  severity: "normal" | "urgent";
  title: string;
  detail: string;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  obligationId?: string | null;
  externalRef?: string | null;
  owner?: string | null;
};

export type OpenExceptionResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string };

export async function openExceptionAsService(
  service: Service,
  input: OpenExceptionInput
): Promise<OpenExceptionResult> {
  const row = {
    tenant_id: input.tenantId,
    kind: input.kind,
    severity: input.severity,
    title: input.title.slice(0, 200),
    detail: input.detail,
    subscription_id: input.subscriptionId ?? null,
    invoice_id: input.invoiceId ?? null,
    obligation_id: input.obligationId ?? null,
    external_ref: input.externalRef ?? null,
    owner: input.owner ?? null,
    state: "open",
  };
  const { data, error } = await service.from("finance_exceptions").insert(row).select("id").single();
  if (!error && data) return { ok: true, id: data.id as string, created: true };
  if (error && (error.code === "23505" || /duplicate key|unique/i.test(error.message))) {
    let q = service.from("finance_exceptions").select("id").eq("kind", row.kind).neq("state", "resolved");
    q = row.obligation_id ? q.eq("obligation_id", row.obligation_id) : q.is("obligation_id", null);
    q = row.invoice_id ? q.eq("invoice_id", row.invoice_id) : q.is("invoice_id", null);
    q = row.subscription_id ? q.eq("subscription_id", row.subscription_id) : q.is("subscription_id", null);
    q = q.is("activation_id", null);
    q = row.external_ref ? q.eq("external_ref", row.external_ref) : q.is("external_ref", null);
    const { data: existing } = await q.limit(1).maybeSingle();
    if (existing) return { ok: true, id: existing.id as string, created: false };
  }
  return { ok: false, error: error?.message ?? "finance_exceptions insert failed" };
}

export type ResolutionEvidence = {
  kind: string;
  note: string;
  ref?: string | null;
  by?: string | null;
};

/**
 * Resolve every OPEN exception of a kind for a subject, appending the
 * evidence the 0065 guard trigger requires. Returns how many were closed.
 */
export async function resolveExceptionsAsService(
  service: Service,
  q: {
    kind: string;
    subscriptionId?: string | null;
    externalRef?: string | null;
    evidence: ResolutionEvidence;
  }
): Promise<number> {
  let sel = service
    .from("finance_exceptions")
    .select("id, resolution_evidence")
    .eq("kind", q.kind)
    .neq("state", "resolved");
  if (q.subscriptionId) sel = sel.eq("subscription_id", q.subscriptionId);
  if (q.externalRef) sel = sel.eq("external_ref", q.externalRef);
  const { data } = await sel.limit(50);
  const rows = (data ?? []) as { id: string; resolution_evidence: unknown }[];
  const now = new Date().toISOString();
  let n = 0;
  for (const r of rows) {
    const prior = Array.isArray(r.resolution_evidence) ? (r.resolution_evidence as unknown[]) : [];
    const { data: updated } = await service
      .from("finance_exceptions")
      .update({
        state: "resolved",
        resolved_at: now,
        resolution_evidence: [
          ...prior,
          { at: now, by: q.evidence.by ?? "system", kind: q.evidence.kind, ref: q.evidence.ref ?? null, note: q.evidence.note },
        ],
      })
      .eq("id", r.id)
      .neq("state", "resolved")
      .select("id");
    if (updated?.length) n += 1;
  }
  return n;
}
