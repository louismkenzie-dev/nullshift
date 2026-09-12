import type { SupabaseClient } from "@supabase/supabase-js";
import { createConnectPaymentIntent } from "@nullshift/billing/stripe";
import { logAudit } from "@nullshift/db/audit";
import {
  CONNECT_GATE_MESSAGE,
  connectFeeGate,
  type ConnectGate,
  type GateOrder,
} from "@/lib/legal/applicationFee";

/**
 * THE entry point for taking a payment through a client's connected Stripe
 * account. There is deliberately no other: `createConnectPaymentIntent` needs
 * an explicit percentage, and the only place that percentage comes from is the
 * client's ACCEPTED Order Form via the gate below. No signed Order Form (which
 * incorporates the MSA), no application fee on it — no charge.
 */

export async function loadConnectGate(
  service: SupabaseClient,
  tenantId: string
): Promise<ConnectGate & { accountId: string | null }> {
  const [{ data: tenant }, { data: order }] = await Promise.all([
    service
      .from("tenants")
      .select("stripe_connect_account_id, stripe_connect_status")
      .eq("id", tenantId)
      .maybeSingle(),
    service
      .from("order_forms")
      .select("status, application_fee_enabled, application_fee_percent")
      .eq("tenant_id", tenantId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const gate = connectFeeGate({
    connectStatus: (tenant?.stripe_connect_status as string | null) ?? null,
    acceptedOrder: (order as GateOrder) ?? null,
  });
  return {
    ...gate,
    accountId: (tenant?.stripe_connect_account_id as string | null) ?? null,
  };
}

export type ConnectChargeResult =
  | { ok: true; paymentIntentId: string; clientSecret: string | null; feePercent: number }
  | { ok: false; reason: ConnectGate["reason"] | "stripe_unavailable"; message: string };

export async function chargeThroughConnect(
  service: SupabaseClient,
  input: {
    tenantId: string;
    amountPence: number;
    description?: string;
    currency?: string;
  }
): Promise<ConnectChargeResult> {
  const gate = await loadConnectGate(service, input.tenantId);
  if (!gate.canCharge || gate.percent === null || !gate.accountId) {
    await logAudit({
      action: "connect.charge_refused",
      target: `tenant:${input.tenantId}`,
      tenantId: input.tenantId,
      metadata: { reason: gate.reason, amountPence: input.amountPence },
    });
    return { ok: false, reason: gate.reason, message: CONNECT_GATE_MESSAGE[gate.reason] };
  }
  const pi = await createConnectPaymentIntent({
    amountPence: input.amountPence,
    connectedAccountId: gate.accountId,
    applicationFeePercent: gate.percent,
    currency: input.currency,
    description: input.description,
  });
  if (!pi) {
    return {
      ok: false,
      reason: "stripe_unavailable",
      message: "Stripe is not configured.",
    };
  }
  await logAudit({
    action: "connect.charge_created",
    target: `tenant:${input.tenantId}`,
    tenantId: input.tenantId,
    metadata: {
      paymentIntent: pi.id,
      amountPence: input.amountPence,
      feePercent: gate.percent,
    },
  });
  return {
    ok: true,
    paymentIntentId: pi.id,
    clientSecret: pi.client_secret ?? null,
    feePercent: gate.percent,
  };
}
