import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@nullshift/billing/stripe";
import { logAuditAsService } from "@nullshift/db/audit";

/**
 * Ingest Stripe Application Fee objects into connect_application_fees
 * (migration 0054) — the ledger the fee dashboard reads. Two entry points:
 *
 *  · upsertApplicationFee — one fee, called from the webhook as
 *    application_fee.created / application_fee.refunded events arrive.
 *  · reconcileApplicationFees — pages through the Stripe API and upserts
 *    everything found, for the initial backfill and the admin "Sync now"
 *    button. Safe to re-run: keyed on the Stripe fee id.
 *
 * IMPORTANT — Stripe Dashboard setup this code cannot do for you: Application
 * Fee events belong to the connected account where the underlying charge was
 * made. The platform's webhook endpoint only receives them if "Listen to
 * events on Connected accounts" is turned on for that endpoint (Stripe
 * Dashboard → Developers → Webhooks → your endpoint → Connected accounts).
 * Without that, application_fee.created never arrives and this ledger only
 * ever fills via the manual Sync button.
 */

type Service = SupabaseClient;

async function resolveTenantId(
  service: Service,
  stripeAccountId: string
): Promise<string | null> {
  const { data } = await service
    .from("tenants")
    .select("id")
    .eq("stripe_connect_account_id", stripeAccountId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Upsert one Stripe Application Fee object. Never throws — logs and returns false. */
export async function upsertApplicationFee(
  service: Service,
  fee: Stripe.ApplicationFee,
  /** The connected account's own business label, when the caller has it. */
  accountName?: string | null
): Promise<boolean> {
  try {
    const accountId = typeof fee.account === "string" ? fee.account : fee.account?.id;
    if (!accountId) return false;
    const tenantId = await resolveTenantId(service, accountId);
    const chargeId =
      typeof fee.charge === "string" ? fee.charge : (fee.charge?.id ?? null);

    const { error } = await service.from("connect_application_fees").upsert(
      {
        id: fee.id,
        tenant_id: tenantId,
        stripe_account_id: accountId,
        stripe_charge_id: chargeId,
        amount: fee.amount,
        amount_refunded: fee.amount_refunded ?? 0,
        currency: fee.currency,
        livemode: fee.livemode,
        stripe_created_at: new Date(fee.created * 1000).toISOString(),
        // Only overwrite a cached label when we actually looked one up, so a
        // webhook (which has no name) can't blank what a sync resolved.
        ...(accountName ? { stripe_account_name: accountName } : {}),
      },
      { onConflict: "id" }
    );
    if (error) {
      console.error("[connect-fees] upsert failed:", error.message, fee.id);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[connect-fees] upsert threw:", e);
    return false;
  }
}

/**
 * The connected account's own label, for recognising it in the dashboard.
 * Best-effort: a platform can retrieve its connected accounts, but a revoked
 * or deleted one will 404 — not a reason to fail the whole sync.
 */
async function accountLabel(stripe: Stripe, accountId: string): Promise<string | null> {
  try {
    const acct = await stripe.accounts.retrieve(accountId);
    return (
      acct.business_profile?.name ||
      acct.settings?.dashboard?.display_name ||
      acct.email ||
      null
    );
  } catch {
    return null;
  }
}

export type ReconcileResult = {
  fetched: number;
  upserted: number;
  pages: number;
  error?: string;
};

/**
 * Page through every Application Fee on the platform account and upsert it.
 * Stripe's list endpoint has no per-account filter — each fee object carries
 * its own `.account`, so grouping by client happens after ingest, not here.
 * Capped at 20 pages (2,000 fees) per run so a runaway history can't hang the
 * admin action; re-running is safe and picks up where reality currently is
 * (every row is upserted by id regardless of how many times this runs).
 */
export async function reconcileApplicationFees(
  service: Service,
  opts: { maxPages?: number } = {}
): Promise<ReconcileResult> {
  const stripe = getStripe();
  if (!stripe)
    return { fetched: 0, upserted: 0, pages: 0, error: "Stripe is not configured." };

  const maxPages = opts.maxPages ?? 20;
  let fetched = 0;
  let upserted = 0;
  let pages = 0;
  let startingAfter: string | undefined;

  // One lookup per distinct connected account per run, not per fee.
  const labels = new Map<string, string | null>();

  try {
    do {
      const page = await stripe.applicationFees.list({
        limit: 100,
        starting_after: startingAfter,
      });
      pages += 1;
      fetched += page.data.length;
      for (const fee of page.data) {
        const accountId = typeof fee.account === "string" ? fee.account : fee.account?.id;
        if (accountId && !labels.has(accountId))
          labels.set(accountId, await accountLabel(stripe, accountId));
        const label = accountId ? labels.get(accountId) : null;
        if (await upsertApplicationFee(service, fee, label)) upserted += 1;
      }
      startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
    } while (startingAfter && pages < maxPages);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe list failed.";
    console.error("[connect-fees] reconcile failed:", message);
    return { fetched, upserted, pages, error: message };
  }

  await logAuditAsService({
    action: "connect_fees.reconciled",
    metadata: { fetched, upserted, pages },
  });
  return { fetched, upserted, pages };
}

export type AssignResult = { ok: true; relinked: number } | { ok: false; error: string };

/**
 * Point a connected Stripe account at a client.
 *
 * Needed because accounts connected directly in Stripe (rather than through
 * the OAuth flow in 0051) are unknown to us until someone says who they
 * belong to. Records the account on the tenant AND back-links every fee
 * already ingested under it — without that second half, assigning would fix
 * only future fees and leave the collected history sitting in "Unmatched".
 */
export async function assignAccountToTenant(
  service: Service,
  input: { stripeAccountId: string; tenantId: string }
): Promise<AssignResult> {
  const { stripeAccountId, tenantId } = input;
  if (!/^acct_[A-Za-z0-9]{8,}$/.test(stripeAccountId))
    return { ok: false, error: "That is not a Stripe account id." };

  // The account id is unique across tenants (0051) — refuse rather than steal
  // it from another client, which would silently re-attribute their revenue.
  const { data: clash } = await service
    .from("tenants")
    .select("id, name")
    .eq("stripe_connect_account_id", stripeAccountId)
    .neq("id", tenantId)
    .maybeSingle();
  if (clash)
    return {
      ok: false,
      error: `${stripeAccountId} is already assigned to ${clash.name}. Unassign it there first.`,
    };

  const { data: before } = await service
    .from("tenants")
    .select("stripe_connect_account_id")
    .eq("id", tenantId)
    .maybeSingle();

  const { error: tenantErr } = await service
    .from("tenants")
    .update({
      stripe_connect_account_id: stripeAccountId,
      stripe_connect_status: "connected",
      stripe_connected_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.message };

  const { data: relinked, error: feeErr } = await service
    .from("connect_application_fees")
    .update({ tenant_id: tenantId })
    .eq("stripe_account_id", stripeAccountId)
    .is("tenant_id", null)
    .select("id");
  if (feeErr) return { ok: false, error: feeErr.message };

  await logAuditAsService({
    action: "connect_fees.account_assigned",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: {
      stripe_account_id: stripeAccountId,
      previous: before?.stripe_connect_account_id ?? null,
      relinked: relinked?.length ?? 0,
    },
  });
  return { ok: true, relinked: relinked?.length ?? 0 };
}
