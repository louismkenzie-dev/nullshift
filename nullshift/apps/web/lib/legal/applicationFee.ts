/**
 * Stripe Connect application fee — pure rules.
 *
 * The fee is a commercial term the client signs on the Order Form, not a
 * platform constant. Everything that reads, shows or charges it goes through
 * here so the wording the client signed, the number on the invoice and the
 * `application_fee_amount` sent to Stripe can never disagree.
 */

export type ApplicationFee = { enabled: boolean; percent: number | null };

/** Fixed wording. Its hash is stored on the acceptance record at signature. */
export const APPLICATION_FEE_DISCLAIMER =
  "The application fee is charged by Nullshift on each payment taken through your connected Stripe account. " +
  "It is separate from, and in addition to, Stripe's own processing fees, which Stripe charges you directly " +
  "under your agreement with Stripe. Nullshift does not receive any part of Stripe's fees.";

export const APPLICATION_FEE_MIN = 0.01;
export const APPLICATION_FEE_MAX = 100;

export type ParsedFee = { ok: true; fee: ApplicationFee } | { ok: false; error: string };

/**
 * From the Order Form editor: the checkbox and the percentage box. A ticked
 * box with no number is refused rather than defaulted — the number is the
 * term the client is agreeing to.
 */
export function parseApplicationFee(input: {
  enabled: boolean;
  percent: string | null | undefined;
}): ParsedFee {
  if (!input.enabled) return { ok: true, fee: { enabled: false, percent: null } };
  const raw = (input.percent ?? "").trim().replace(/%$/, "");
  if (!raw) return { ok: false, error: "Enter the application fee percentage." };
  const n = Number(raw);
  if (!Number.isFinite(n))
    return { ok: false, error: "The application fee must be a number, e.g. 2 or 2.5." };
  const percent = Math.round(n * 100) / 100;
  if (percent < APPLICATION_FEE_MIN || percent > APPLICATION_FEE_MAX)
    return {
      ok: false,
      error: `The application fee must be between ${APPLICATION_FEE_MIN}% and ${APPLICATION_FEE_MAX}%.`,
    };
  return { ok: true, fee: { enabled: true, percent } };
}

/** "2%" / "2.5%" — never "2.50%". */
export const formatPercent = (percent: number): string =>
  `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0$/, "")}%`;

/**
 * The clause the client reads and signs. Null when no fee applies, so callers
 * render nothing rather than "no fee" boilerplate.
 */
export function applicationFeeClause(fee: ApplicationFee): string | null {
  if (!fee.enabled || fee.percent === null) return null;
  return (
    `Application fee: ${formatPercent(fee.percent)} of each payment taken through your connected Stripe account. ` +
    APPLICATION_FEE_DISCLAIMER
  );
}

/** Pence to hand Stripe as application_fee_amount, rounded to the penny. */
export function applicationFeePenceFor(amountPence: number, percent: number): number {
  if (!Number.isFinite(amountPence) || amountPence <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((amountPence * percent) / 100);
}

/* ── The gate: no money moves until the Order Form (and the MSA it
 *    incorporates) is signed with the fee on it ──────────────────────── */

export type ConnectGateReason =
  | "ok"
  | "not_connected"
  | "no_signed_order"
  | "fee_not_agreed";

export type ConnectGate = {
  canCharge: boolean;
  percent: number | null;
  reason: ConnectGateReason;
};

export type GateOrder = {
  status: string;
  application_fee_enabled: boolean;
  application_fee_percent: number | string | null;
} | null;

/**
 * `acceptedOrder` must be the ACCEPTED Order Form (status "accepted"); pass
 * the newest one the tenant has. Anything else is treated as unsigned.
 */
export function connectFeeGate(input: {
  connectStatus: string | null;
  acceptedOrder: GateOrder;
}): ConnectGate {
  if (input.connectStatus !== "connected")
    return { canCharge: false, percent: null, reason: "not_connected" };
  const o = input.acceptedOrder;
  if (!o || o.status !== "accepted")
    return { canCharge: false, percent: null, reason: "no_signed_order" };
  const percent =
    o.application_fee_percent === null ? null : Number(o.application_fee_percent);
  if (!o.application_fee_enabled || percent === null || !(percent > 0))
    return { canCharge: false, percent: null, reason: "fee_not_agreed" };
  return { canCharge: true, percent, reason: "ok" };
}

export const CONNECT_GATE_MESSAGE: Record<ConnectGateReason, string> = {
  ok: "Application fee agreed and signed — payments may run through Connect.",
  not_connected: "The client has not connected their Stripe account yet.",
  no_signed_order:
    "No signed Order Form. Send the Order Form and MSA for signature before any payment runs through Connect.",
  fee_not_agreed:
    "The signed Order Form has no application fee on it. Raise a new Order Form with the fee ticked and get it signed before any payment runs through Connect.",
};

/**
 * What the client hub should flag. Null = nothing to flag.
 *   danger  — Stripe is connected but nothing signed says a fee may be taken.
 *   warning — a fee is on a sent-but-unsigned Order Form, or agreed but Stripe
 *             is not connected yet.
 */
export function connectFeeFlag(input: {
  connectStatus: string | null;
  order: GateOrder;
}): { tone: "danger" | "warning"; label: string; sub: string } | null {
  const connected = input.connectStatus === "connected";
  const o = input.order;
  const feeOnForm = !!o?.application_fee_enabled;
  const signed = o?.status === "accepted";

  if (connected && !(signed && feeOnForm))
    return {
      tone: "danger",
      label: "Connect fee not signed",
      sub:
        o?.status === "client_review" && feeOnForm
          ? "Order Form + MSA sent — awaiting the client's signature"
          : "Send the Order Form + MSA with the fee before any payment",
    };
  if (!connected && signed && feeOnForm)
    return {
      tone: "warning",
      label: "Fee agreed · Stripe not connected",
      sub: "Send the client the Stripe Connect link",
    };
  if (!connected && !signed && feeOnForm && o?.status === "client_review")
    return {
      tone: "warning",
      label: "Application fee awaiting signature",
      sub: "Order Form + MSA sent to the client",
    };
  return null;
}
