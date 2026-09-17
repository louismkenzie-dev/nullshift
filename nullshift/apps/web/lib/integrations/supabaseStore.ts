/**
 * Supabase implementation of the ops store (service role, server only).
 * Behind `integrationWorkers`: the webhook and the ops-worker cron are the
 * only callers, and both check the flag before constructing it.
 *
 * Tables: integration_events / integration_operations (0063),
 * finance_exceptions (0065), mandates / service_activations (0064),
 * billing_obligations / provider_payments / payment_allocations (0062), and
 * the existing invoices / invoice_items / tenants / subscriptions /
 * service_arrangements / service_schedules. Nothing here runs unless the
 * flag is on, so a missing table is a loud error in a flagged environment
 * and a non-event everywhere else.
 */

import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { clientRef } from "@nullshift/ui/format";
import type {
  ActivationRecord,
  GateInput,
  MandateRecord,
} from "@/lib/billing/activation";
import type { MandateUpsert } from "@/lib/billing/mandates";
import type { AllocationRecord } from "@/lib/billing/obligations";
import { acceptedContent } from "@/lib/legal/acceptanceSnapshot";
import {
  arrangementFromRow,
  scheduleContentFromSnapshot,
  serviceScheduleFromRow,
  type ArrangementRow,
  type ServiceScheduleRow,
} from "@/lib/legal/arrangements";
import { recordCarePlanPayment } from "@/lib/carePlanInvoice";
import type {
  ActivationView,
  Environment,
  EventRow,
  LedgerStore,
  LegacyMirror,
  OperationRow,
  OpsStore,
  StoreError,
} from "./types";

type Service = ReturnType<typeof createServiceClient>;

const err = (
  e: { code?: string | null; message: string } | null | undefined,
  fallback = "database error"
): StoreError => ({
  code: e?.code ?? null,
  message: e?.message ?? fallback,
});

/** 0062 spells environments test | live; 0063/0064 spell sandbox | live. */
const paymentEnv = (e: Environment): "test" | "live" => (e === "live" ? "live" : "test");

const toMinor = (amount: unknown): number => Math.round(Number(amount ?? 0) * 100);

type EventDbRow = {
  id: string;
  provider: EventRow["provider"];
  environment: Environment;
  account_ref: string | null;
  event_ref: string;
  event_type: string;
  resource_type: string | null;
  resource_ref: string | null;
  payload: Record<string, unknown> | null;
  received_at: string;
  processed_at: string | null;
  status: EventRow["status"];
  error: string | null;
};

const eventFromRow = (r: EventDbRow): EventRow => ({
  id: r.id,
  provider: r.provider,
  environment: r.environment,
  accountRef: r.account_ref,
  eventRef: r.event_ref,
  eventType: r.event_type,
  resourceType: r.resource_type,
  resourceRef: r.resource_ref,
  payload: r.payload ?? {},
  receivedAt: r.received_at,
  status: r.status,
  processedAt: r.processed_at,
  error: r.error,
});

type OperationDbRow = {
  id: string;
  kind: string;
  idempotency_key: string;
  subject: OperationRow["subject"] | null;
  payload: Record<string, unknown> | null;
  state: OperationRow["state"];
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  leased_until: string | null;
  lease_owner: string | null;
  last_error: string | null;
  correlation_id: string | null;
  created_at: string;
  succeeded_at: string | null;
};

const operationFromRow = (r: OperationDbRow): OperationRow => ({
  id: r.id,
  kind: r.kind,
  idempotencyKey: r.idempotency_key,
  subject: r.subject ?? {},
  payload: r.payload ?? {},
  state: r.state,
  attempts: r.attempts,
  maxAttempts: r.max_attempts,
  nextAttemptAt: r.next_attempt_at,
  leasedUntil: r.leased_until,
  leaseOwner: r.lease_owner,
  lastError: r.last_error,
  correlationId: r.correlation_id,
  createdAt: r.created_at,
  succeededAt: r.succeeded_at,
});

type MandateDbRow = {
  id: string;
  tenant_id: string | null;
  provider: MandateRecord["provider"];
  environment: Environment;
  customer_ref: string | null;
  billing_request_ref: string | null;
  mandate_ref: string | null;
  status: MandateRecord["status"];
  consent_terms_version: string | null;
  consent_acceptance_ref: string | null;
  held_for_review: boolean;
  hold_reason: string | null;
  authorised_at: string | null;
  cancelled_at: string | null;
  replaced_by: string | null;
  raw_status: string | null;
  last_provider_sync_at: string | null;
};

const mandateFromRow = (r: MandateDbRow): MandateRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  provider: r.provider,
  environment: r.environment,
  customerRef: r.customer_ref,
  billingRequestRef: r.billing_request_ref,
  mandateRef: r.mandate_ref,
  status: r.status,
  consentTermsVersion: r.consent_terms_version,
  consentAcceptanceRef: r.consent_acceptance_ref,
  heldForReview: r.held_for_review,
  holdReason: r.hold_reason,
  authorisedAt: r.authorised_at,
  cancelledAt: r.cancelled_at,
  replacedBy: r.replaced_by,
  rawStatus: r.raw_status,
  lastProviderSyncAt: r.last_provider_sync_at,
});

const mandateToRow = (m: MandateUpsert) => ({
  tenant_id: m.tenantId,
  provider: m.provider,
  environment: m.environment,
  customer_ref: m.customerRef,
  billing_request_ref: m.billingRequestRef,
  mandate_ref: m.mandateRef,
  status: m.status,
  consent_terms_version: m.consentTermsVersion,
  consent_acceptance_ref: m.consentAcceptanceRef,
  held_for_review: m.heldForReview,
  hold_reason: m.holdReason,
  authorised_at: m.authorisedAt,
  cancelled_at: m.cancelledAt,
  replaced_by: m.replacedBy,
  raw_status: m.rawStatus,
  last_provider_sync_at: m.lastProviderSyncAt,
});

type ActivationDbRow = {
  id: string;
  arrangement_id: string;
  schedule_id: string;
  mandate_id: string | null;
  requested_by: string | null;
  approved_by: string | null;
  contractual_start_date: string;
  requested_charge_date: string | null;
  provider_confirmed_charge_date: string | null;
  provider_subscription_ref: string | null;
  environment: Environment;
  state: ActivationRecord["state"];
  failure_reason: string | null;
  arrangement?: { tenant_id: string } | { tenant_id: string }[] | null;
};

const ACTIVATION_SELECT = "*, arrangement:service_arrangements!inner(tenant_id)";

const activationFromRow = (r: ActivationDbRow): ActivationView => {
  const arr = Array.isArray(r.arrangement) ? r.arrangement[0] : r.arrangement;
  return {
    id: r.id,
    arrangementId: r.arrangement_id,
    scheduleId: r.schedule_id,
    mandateId: r.mandate_id,
    requestedBy: r.requested_by,
    approvedBy: r.approved_by,
    contractualStartDate: r.contractual_start_date,
    requestedChargeDate: r.requested_charge_date,
    providerConfirmedChargeDate: r.provider_confirmed_charge_date,
    providerSubscriptionRef: r.provider_subscription_ref,
    environment: r.environment,
    state: r.state,
    failureReason: r.failure_reason,
    tenantId: arr?.tenant_id ?? "",
  };
};

const LIVE_STATES = ["reserved", "scheduled", "active"];

function legacyMirror(db: Service): LegacyMirror {
  const legacyOnly = <T extends { is: (c: string, v: null) => T }>(q: T) =>
    q.is("arrangement_id", null);
  return {
    async findPendingByBillingRequest(ref) {
      const { data } = await legacyOnly(
        db
          .from("subscriptions")
          .select("id, tenant_id, plan, gc_subscription_id")
          .eq("gc_billing_request_id", ref)
      ).maybeSingle();
      if (!data || data.gc_subscription_id) return null;
      return { id: data.id, tenantId: data.tenant_id, plan: data.plan ?? null };
    },
    async replaceMandateRef(oldRef, newRef) {
      await legacyOnly(
        db
          .from("subscriptions")
          .update({ gc_mandate_id: newRef })
          .eq("gc_mandate_id", oldRef)
      );
    },
    async cancelByMandateRef(ref) {
      const { data } = await legacyOnly(
        db.from("subscriptions").update({ status: "canceled" }).eq("gc_mandate_id", ref)
      ).select("id, tenant_id");
      return (data ?? []).map((r: { id: string; tenant_id: string }) => ({
        id: r.id,
        tenantId: r.tenant_id,
      }));
    },
    async cancelBySubscriptionRef(ref) {
      const { data } = await legacyOnly(
        db
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("gc_subscription_id", ref)
      ).select("id, tenant_id");
      return (data ?? []).map((r: { id: string; tenant_id: string }) => ({
        id: r.id,
        tenantId: r.tenant_id,
      }));
    },
    async markPaymentOutcome(q) {
      const from = q.outcome === "failed" ? "active" : "past_due";
      const to = q.outcome === "failed" ? "past_due" : "active";
      if (!q.subscriptionRef && !q.mandateRef) return [];
      const base = legacyOnly(
        db.from("subscriptions").update({ status: to }).eq("status", from)
      );
      const scoped = q.subscriptionRef
        ? base.eq("gc_subscription_id", q.subscriptionRef)
        : base.eq("gc_mandate_id", q.mandateRef!);
      const { data } = await scoped.select("id, tenant_id, plan");
      return (data ?? []).map(
        (r: { id: string; tenant_id: string; plan: string | null }) => ({
          id: r.id,
          tenantId: r.tenant_id,
          plan: r.plan,
        })
      );
    },
    async findLegacySubscription(q) {
      if (!q.subscriptionRef && !q.mandateRef) return null;
      const base = legacyOnly(
        db.from("subscriptions").select("id, tenant_id, plan").limit(1)
      );
      const scoped = q.subscriptionRef
        ? base.eq("gc_subscription_id", q.subscriptionRef)
        : base.eq("gc_mandate_id", q.mandateRef!);
      const { data } = await scoped.maybeSingle();
      return data
        ? { id: data.id, tenantId: data.tenant_id, plan: data.plan ?? null }
        : null;
    },
    async recordCarePlanPayment(args) {
      await recordCarePlanPayment(db, args);
    },
  };
}

function ledgerStore(db: Service): LedgerStore {
  return {
    async getInvoiceForXero(invoiceId) {
      const { data: inv } = await db
        .from("invoices")
        .select(
          "id, tenant_id, type, amount, status, created_at, due_at, xero_invoice_id"
        )
        .eq("id", invoiceId)
        .maybeSingle();
      if (!inv) return null;
      const { data: tenant } = await db
        .from("tenants")
        .select("id, name, contact_email, xero_contact_id")
        .eq("id", inv.tenant_id)
        .maybeSingle();
      const { data: lines } = await db
        .from("invoice_items")
        .select("name, amount, quantity")
        .eq("invoice_id", inv.id);
      const lineItems =
        lines && lines.length > 0
          ? (lines as { name: string; amount: number; quantity: number }[]).map((l) => ({
              description: l.name,
              amountMinor: toMinor(Number(l.amount) * (l.quantity || 1)),
            }))
          : [
              {
                description:
                  inv.type === "care_plan"
                    ? "Care plan"
                    : inv.type === "build_milestone"
                      ? "System build"
                      : "Nullshift invoice",
                amountMinor: toMinor(inv.amount),
              },
            ];
      return {
        id: inv.id,
        tenantId: inv.tenant_id,
        // Same format as lib/xeroSync.ts so the recovery lookup also finds
        // invoices the legacy sync created.
        reference: `${clientRef(inv.tenant_id)} · ${String(inv.id).slice(0, 8)}`,
        status: inv.status,
        dateISO: inv.created_at,
        dueDateISO: inv.due_at ?? inv.created_at,
        xeroInvoiceId: inv.xero_invoice_id,
        lineItems,
        currency: "GBP",
        tenant: {
          name: tenant?.name ?? "Unknown client",
          email: tenant?.contact_email ?? null,
          xeroContactId: tenant?.xero_contact_id ?? null,
        },
      };
    },
    async setInvoiceXeroId(invoiceId, xeroInvoiceId, onlineUrl) {
      const { data } = await db
        .from("invoices")
        .update({ xero_invoice_id: xeroInvoiceId })
        .eq("id", invoiceId)
        .is("xero_invoice_id", null)
        .select("id");
      if (data && data.length > 0) {
        if (onlineUrl)
          await db
            .from("invoices")
            .update({ hosted_invoice_url: onlineUrl })
            .eq("id", invoiceId)
            .is("hosted_invoice_url", null);
        return "saved";
      }
      const { data: existing } = await db
        .from("invoices")
        .select("id")
        .eq("id", invoiceId)
        .maybeSingle();
      return existing ? "already_set" : "not_found";
    },
    async setTenantXeroContact(tenantId, contactId) {
      await db.from("tenants").update({ xero_contact_id: contactId }).eq("id", tenantId);
    },
    async getAllocationForXero(allocationId) {
      const { data: a } = await db
        .from("payment_allocations")
        .select("*")
        .eq("id", allocationId)
        .maybeSingle();
      if (!a) return null;
      const inv = a.invoice_id
        ? (
            await db
              .from("invoices")
              .select("xero_invoice_id")
              .eq("id", a.invoice_id)
              .maybeSingle()
          ).data
        : null;
      const { data: siblings } = a.invoice_id
        ? await db
            .from("payment_allocations")
            .select("id, evidence")
            .eq("invoice_id", a.invoice_id)
            .neq("id", a.id)
        : { data: [] as { id: string; evidence: Record<string, unknown> | null }[] };
      const ev = (a.evidence ?? {}) as Record<string, unknown>;
      return {
        id: a.id,
        tenantId: a.tenant_id,
        obligationId: a.obligation_id,
        invoiceId: a.invoice_id,
        xeroInvoiceId: inv?.xero_invoice_id ?? null,
        kind: a.kind,
        provider: a.provider,
        providerPaymentRef: a.provider_payment_id,
        amountMinor: a.amount_minor,
        currency: a.currency,
        allocatedAt: a.allocated_at,
        xeroRecorded: typeof ev.xero_recorded_at === "string",
        siblingXeroPaymentIds: (siblings ?? [])
          .map(
            (s: { evidence: Record<string, unknown> | null }) =>
              s.evidence?.xero_payment_id
          )
          .filter((x: unknown): x is string => typeof x === "string"),
      };
    },
    async markAllocationRecordedInXero(allocationId, evidence) {
      const { data } = await db
        .from("payment_allocations")
        .select("evidence")
        .eq("id", allocationId)
        .maybeSingle();
      await db
        .from("payment_allocations")
        .update({
          evidence: {
            ...((data?.evidence as Record<string, unknown>) ?? {}),
            ...evidence,
          },
        })
        .eq("id", allocationId);
    },
    async findMandate(q) {
      let query = db
        .from("mandates")
        .select("*")
        .eq("provider", q.provider)
        .eq("environment", q.environment)
        .limit(1);
      if (q.mandateRef) query = query.eq("mandate_ref", q.mandateRef);
      else if (q.billingRequestRef)
        query = query.eq("billing_request_ref", q.billingRequestRef);
      else return null;
      const { data } = await query.maybeSingle();
      return data ? mandateFromRow(data as MandateDbRow) : null;
    },
    async saveMandate(row) {
      if (row.id) {
        await db.from("mandates").update(mandateToRow(row)).eq("id", row.id);
        return { id: row.id };
      }
      const { data, error } = await db
        .from("mandates")
        .insert(mandateToRow(row))
        .select("id")
        .single();
      if (error || !data)
        throw new Error(`mandates insert failed: ${error?.message ?? "no row"}`);
      return { id: data.id };
    },
    async resolveMandateOwner(q) {
      // Our records only: an earlier mandates row for the same setup request,
      // else a legacy pending row (identifies the client, carries no consent).
      if (q.billingRequestRef) {
        const { data: m } = await db
          .from("mandates")
          .select("tenant_id, consent_terms_version, consent_acceptance_ref")
          .eq("provider", "gocardless")
          .eq("environment", q.environment)
          .eq("billing_request_ref", q.billingRequestRef)
          .maybeSingle();
        if (m?.tenant_id)
          return {
            tenantId: m.tenant_id,
            consent: {
              termsVersion: m.consent_terms_version,
              acceptanceRef: m.consent_acceptance_ref,
            },
          };
        const { data: s } = await db
          .from("subscriptions")
          .select("tenant_id")
          .eq("gc_billing_request_id", q.billingRequestRef)
          .maybeSingle();
        if (s?.tenant_id) return { tenantId: s.tenant_id, consent: null };
      }
      if (q.mandateRef) {
        const { data: s } = await db
          .from("subscriptions")
          .select("tenant_id")
          .eq("gc_mandate_id", q.mandateRef)
          .maybeSingle();
        if (s?.tenant_id) return { tenantId: s.tenant_id, consent: null };
      }
      return { tenantId: null, consent: null };
    },
    async getActivation(id) {
      const { data } = await db
        .from("service_activations")
        .select(ACTIVATION_SELECT)
        .eq("id", id)
        .maybeSingle();
      return data ? activationFromRow(data as unknown as ActivationDbRow) : null;
    },
    async findActivationByProviderRef(environment, ref) {
      const { data } = await db
        .from("service_activations")
        .select(ACTIVATION_SELECT)
        .eq("environment", environment)
        .eq("provider_subscription_ref", ref)
        .maybeSingle();
      return data ? activationFromRow(data as unknown as ActivationDbRow) : null;
    },
    async findLiveActivationByMandate(mandateId) {
      const { data } = await db
        .from("service_activations")
        .select(ACTIVATION_SELECT)
        .eq("mandate_id", mandateId)
        .in("state", LIVE_STATES)
        .limit(1)
        .maybeSingle();
      return data ? activationFromRow(data as unknown as ActivationDbRow) : null;
    },
    async loadGateInput(activationId, asOf): Promise<GateInput | null> {
      const { data: act } = await db
        .from("service_activations")
        .select("*")
        .eq("id", activationId)
        .maybeSingle();
      if (!act) return null;
      const { data: arr } = await db
        .from("service_arrangements")
        .select("*")
        .eq("id", act.arrangement_id)
        .maybeSingle();
      const { data: sch } = await db
        .from("service_schedules")
        .select("*")
        .eq("id", act.schedule_id)
        .maybeSingle();
      if (!arr || !sch) return null;
      const mandate = act.mandate_id
        ? (await db.from("mandates").select("*").eq("id", act.mandate_id).maybeSingle())
            .data
        : null;
      const schedule = serviceScheduleFromRow(sch as ServiceScheduleRow);
      const snapshot = acceptedContent(
        (sch as ServiceScheduleRow).document_snapshot as never,
        schedule.documentHash
      );
      const accepted = snapshot
        ? scheduleContentFromSnapshot(
            (snapshot as { content?: unknown }).content ?? snapshot
          )
        : null;
      // Other rails bound to this arrangement: any other live subscription
      // row for it (legacy rows have no arrangement and are not counted;
      // Xero-native rails are recorded on the obligation's orchestrator).
      const { data: subs } = await db
        .from("subscriptions")
        .select(
          "id, status, environment, gc_subscription_id, stripe_subscription_id, activation_id"
        )
        .eq("arrangement_id", act.arrangement_id)
        .in("status", ["active", "trialing", "past_due"]);
      const { data: xeroNative } = await db
        .from("billing_obligations")
        .select("id")
        .eq("arrangement_id", act.arrangement_id)
        .eq("orchestrator", "xero_native")
        .neq("state", "void")
        .limit(1);
      const existingRails: GateInput["existingRails"] = [
        ...(subs ?? [])
          .filter(
            (s: { activation_id: string | null }) => s.activation_id !== activationId
          )
          .map(
            (s: {
              status: string;
              environment: Environment | null;
              gc_subscription_id: string | null;
              stripe_subscription_id: string | null;
            }) => ({
              kind: (s.stripe_subscription_id
                ? "stripe_subscription"
                : "app_subscription") as "stripe_subscription" | "app_subscription",
              environment: s.environment,
              status: "active" as const,
              ref: s.gc_subscription_id ?? s.stripe_subscription_id ?? null,
            })
          ),
        ...((xeroNative ?? []).length > 0
          ? [
              {
                kind: "xero_native" as const,
                environment: null,
                status: "unknown" as const,
                ref: null,
              },
            ]
          : []),
      ];
      return {
        arrangement: arrangementFromRow(arr as ArrangementRow),
        schedule,
        accepted,
        approval: {
          approvedBy: act.approved_by ?? null,
          approvedAt: act.created_at ?? null,
        },
        environment: act.environment,
        mandate: mandate ? mandateFromRow(mandate as MandateDbRow) : null,
        providerLeadDays: Number(process.env.GOCARDLESS_LEAD_DAYS ?? 5),
        existingRails,
        asOf,
      };
    },
    async updateActivation(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.state !== undefined) row.state = patch.state;
      if (patch.requestedChargeDate !== undefined)
        row.requested_charge_date = patch.requestedChargeDate;
      if (patch.providerConfirmedChargeDate !== undefined)
        row.provider_confirmed_charge_date = patch.providerConfirmedChargeDate;
      if (patch.providerSubscriptionRef !== undefined)
        row.provider_subscription_ref = patch.providerSubscriptionRef;
      if (patch.failureReason !== undefined) row.failure_reason = patch.failureReason;
      if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt;
      if (patch.activatedAt !== undefined) row.activated_at = patch.activatedAt;
      if (patch.cancelledAt !== undefined) row.cancelled_at = patch.cancelledAt;
      if (Object.keys(row).length === 0) return;
      const { error } = await db.from("service_activations").update(row).eq("id", id);
      if (error) throw new Error(`service_activations update failed: ${error.message}`);
    },
    async findObligationForCollection({ activation, chargeDate }) {
      let q = db
        .from("billing_obligations")
        .select("id, tenant_id, currency, amount_gross_minor, period_start, period_end")
        .eq("arrangement_id", activation.arrangementId)
        .eq("kind", "service_period")
        .neq("state", "void")
        .order("period_start", { ascending: true });
      if (chargeDate) q = q.lte("period_start", chargeDate).gt("period_end", chargeDate);
      const { data } = await q.limit(1).maybeSingle();
      if (!data) return null;
      const { data: inv } = await db
        .from("invoices")
        .select("id, xero_invoice_id")
        .eq("obligation_id", data.id)
        .neq("status", "void")
        .limit(1)
        .maybeSingle();
      return {
        id: data.id,
        tenantId: data.tenant_id,
        currency: data.currency,
        amountGrossMinor: data.amount_gross_minor,
        invoiceId: inv?.id ?? null,
        xeroInvoiceId: inv?.xero_invoice_id ?? null,
      };
    },
    async recordProviderPayment(row) {
      const { data, error } = await db
        .from("provider_payments")
        .insert({
          tenant_id: row.tenantId,
          provider: row.provider,
          provider_payment_id: row.providerPaymentRef,
          kind: row.kind,
          amount_minor: row.amountMinor,
          currency: row.currency,
          environment: paymentEnv(row.environment),
          received_at: row.receivedAt,
          evidence: row.evidence,
        })
        .select("id")
        .single();
      if (!error && data) return { ok: true, id: data.id, created: true };
      if (
        error &&
        (error.code === "23505" || /duplicate key|unique/i.test(error.message))
      ) {
        const { data: existing } = await db
          .from("provider_payments")
          .select("id, environment")
          .eq("provider", row.provider)
          .eq("provider_payment_id", row.providerPaymentRef)
          .maybeSingle();
        // A sandbox ref can never adopt a live row (or the reverse).
        if (existing && existing.environment !== paymentEnv(row.environment))
          return {
            ok: false,
            error: {
              code: "environment_mismatch",
              message: `provider payment ${row.providerPaymentRef} exists in ${existing.environment}; refusing to touch it from ${row.environment}`,
            },
          };
        if (existing) return { ok: true, id: existing.id, created: false };
      }
      return { ok: false, error: err(error, "provider_payments insert failed") };
    },
    async recordAllocation(row) {
      const { data, error } = await db
        .from("payment_allocations")
        .insert({
          tenant_id: row.tenantId,
          invoice_id: row.invoiceId,
          obligation_id: row.obligationId,
          provider: row.provider,
          provider_payment_id: row.providerPaymentRef,
          kind: row.kind,
          amount_minor: row.amountMinor,
          currency: row.currency,
          allocated_at: row.allocatedAt,
          evidence: row.evidence,
        })
        .select("id")
        .single();
      if (!error && data) return { ok: true, id: data.id, created: true };
      if (
        error &&
        (error.code === "23505" || /duplicate key|unique/i.test(error.message))
      ) {
        const { data: existing } = await db
          .from("payment_allocations")
          .select("id")
          .eq("provider", row.provider)
          .eq("provider_payment_id", row.providerPaymentRef)
          .eq("kind", row.kind)
          .eq("obligation_id", row.obligationId)
          .maybeSingle();
        if (existing) return { ok: true, id: existing.id, created: false };
      }
      return { ok: false, error: err(error, "payment_allocations insert failed") };
    },
    async listAllocations(provider, ref): Promise<AllocationRecord[]> {
      const { data } = await db
        .from("payment_allocations")
        .select("*")
        .eq("provider", provider)
        .eq("provider_payment_id", ref);
      return (data ?? []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        obligationId: a.obligation_id as string,
        invoiceId: (a.invoice_id as string | null) ?? null,
        provider: a.provider as AllocationRecord["provider"],
        providerPaymentId: a.provider_payment_id as string,
        kind: a.kind as AllocationRecord["kind"],
        amountMinor: a.amount_minor as number,
        currency: a.currency as string,
        allocatedAt: a.allocated_at as string,
      }));
    },
    legacy: legacyMirror(db),
  };
}

export function supabaseOpsStore(db: Service = createServiceClient()): OpsStore {
  return {
    async insertEvent(e) {
      const { data, error } = await db
        .from("integration_events")
        .insert({
          provider: e.provider,
          environment: e.environment,
          account_ref: e.accountRef,
          event_ref: e.eventRef,
          event_type: e.eventType,
          resource_type: e.resourceType,
          resource_ref: e.resourceRef,
          payload: e.payload,
          received_at: e.receivedAt,
          status: "received",
        })
        .select("id")
        .single();
      if (error || !data)
        return { ok: false, error: err(error, "integration_events insert failed") };
      return { ok: true, id: data.id };
    },
    async getEvent(id) {
      const { data } = await db
        .from("integration_events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data ? eventFromRow(data as EventDbRow) : null;
    },
    async setEventStatus(id, status, error, processedAt) {
      await db
        .from("integration_events")
        .update({ status, error, processed_at: processedAt })
        .eq("id", id);
    },
    async listUnprocessedEvents(q) {
      const { data } = await db
        .from("integration_events")
        .select("*")
        .in("status", ["received", "failed"])
        .lte("received_at", q.receivedBefore)
        .gte("received_at", q.receivedAfter)
        .order("received_at", { ascending: true })
        .limit(Math.max(1, Math.min(100, q.limit)));
      return (data ?? []).map((r: EventDbRow) => eventFromRow(r));
    },
    async insertOperation(op, now) {
      const { data, error } = await db
        .from("integration_operations")
        .insert({
          kind: op.kind,
          idempotency_key: op.idempotencyKey,
          subject: op.subject,
          payload: op.payload,
          state: "queued",
          attempts: 0,
          max_attempts: op.maxAttempts ?? 8,
          next_attempt_at: op.nextAttemptAt ?? now,
          correlation_id: op.correlationId ?? null,
        })
        .select("id")
        .single();
      if (error || !data)
        return { ok: false, error: err(error, "integration_operations insert failed") };
      return { ok: true, id: data.id };
    },
    async findOperationByKey(key) {
      const { data } = await db
        .from("integration_operations")
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      return data ? operationFromRow(data as OperationDbRow) : null;
    },
    async claimOperations({ owner, limit, now, leaseUntil }) {
      const leaseSeconds = Math.max(
        30,
        Math.round((new Date(leaseUntil).getTime() - new Date(now).getTime()) / 1000)
      );
      const { data, error } = await db.rpc("integration_operations_claim", {
        p_owner: owner,
        p_limit: limit,
        p_now: now,
        p_lease_seconds: leaseSeconds,
      });
      if (error) throw new Error(`integration_operations_claim failed: ${error.message}`);
      return ((data ?? []) as OperationDbRow[]).map(operationFromRow);
    },
    async completeOperation(id, owner, patch) {
      const row: Record<string, unknown> = {
        state: patch.state,
        last_error: patch.lastError,
        lease_owner: null,
        leased_until: null,
      };
      if (patch.state === "succeeded") row.succeeded_at = patch.succeededAt;
      if (patch.state === "queued") row.next_attempt_at = patch.nextAttemptAt;
      const { data, error } = await db
        .from("integration_operations")
        .update(row)
        .eq("id", id)
        .eq("state", "leased")
        .eq("lease_owner", owner)
        .select("id");
      if (error)
        throw new Error(`integration_operations update failed: ${error.message}`);
      return (data ?? []).length > 0;
    },
    async openException(row) {
      const { data, error } = await db
        .from("finance_exceptions")
        .insert(row)
        .select("id")
        .single();
      if (!error && data) return { ok: true, id: data.id, created: true };
      if (
        error &&
        (error.code === "23505" || /duplicate key|unique/i.test(error.message))
      ) {
        let q = db
          .from("finance_exceptions")
          .select("id")
          .eq("kind", row.kind)
          .neq("state", "resolved");
        q = row.obligation_id
          ? q.eq("obligation_id", row.obligation_id)
          : q.is("obligation_id", null);
        q = row.invoice_id
          ? q.eq("invoice_id", row.invoice_id)
          : q.is("invoice_id", null);
        q = row.subscription_id
          ? q.eq("subscription_id", row.subscription_id)
          : q.is("subscription_id", null);
        q = row.activation_id
          ? q.eq("activation_id", row.activation_id)
          : q.is("activation_id", null);
        q = row.external_ref
          ? q.eq("external_ref", row.external_ref)
          : q.is("external_ref", null);
        const { data: existing } = await q.limit(1).maybeSingle();
        if (existing) return { ok: true, id: existing.id, created: false };
      }
      return { ok: false, error: err(error, "finance_exceptions insert failed") };
    },
    async audit(entry) {
      await logAuditAsService({
        action: entry.action,
        target: entry.target,
        tenantId: entry.tenantId,
        metadata: entry.metadata,
      });
    },
    ledger: ledgerStore(db),
  };
}
