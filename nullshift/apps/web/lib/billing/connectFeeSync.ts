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
  fee: Stripe.ApplicationFee
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

  try {
    do {
      const page = await stripe.applicationFees.list({
        limit: 100,
        starting_after: startingAfter,
      });
      pages += 1;
      fetched += page.data.length;
      for (const fee of page.data) {
        if (await upsertApplicationFee(service, fee)) upserted += 1;
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
