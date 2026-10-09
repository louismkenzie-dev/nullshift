import { createServiceClient } from "@nullshift/db";
import {
  ENTITLED_STATUSES,
  PRODUCTS,
  type ProductSlug,
  type ProductSubscriptionStatus,
} from "@nullshift/content/products";

export type ProductSubscriptionRow = {
  id: string;
  tenant_id: string;
  product: ProductSlug;
  status: ProductSubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  price_pence: number;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
};

export type Entitlement = {
  product: ProductSlug;
  entitled: boolean;
  status: ProductSubscriptionStatus | "none";
  /** True while a trial is running and no card is on file. */
  trialing: boolean;
  trialDaysLeft: number | null;
  row: ProductSubscriptionRow | null;
};

export function isEntitledStatus(status: string | null | undefined): boolean {
  return !!status && (ENTITLED_STATUSES as readonly string[]).includes(status);
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function toEntitlement(
  product: ProductSlug,
  row: ProductSubscriptionRow | null
): Entitlement {
  if (!row)
    return {
      product,
      entitled: false,
      status: "none",
      trialing: false,
      trialDaysLeft: null,
      row: null,
    };
  // A trial that has run out without a card becomes 'expired' lazily here, so a
  // missed webhook can never leave a free product running forever.
  let status = row.status;
  if (status === "trialing" && !row.stripe_subscription_id && row.trial_ends_at) {
    if (new Date(row.trial_ends_at).getTime() < Date.now()) status = "expired";
  }
  return {
    product,
    entitled: isEntitledStatus(status),
    status,
    trialing: status === "trialing",
    trialDaysLeft: status === "trialing" ? daysLeft(row.trial_ends_at) : null,
    row,
  };
}

/** Every product's entitlement for a tenant, in catalogue order. */
export async function entitlementsFor(
  tenantId: string
): Promise<Record<ProductSlug, Entitlement>> {
  const service = createServiceClient();
  const { data } = await service
    .from("product_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId);
  const rows = (data ?? []) as ProductSubscriptionRow[];
  const out = {} as Record<ProductSlug, Entitlement>;
  for (const slug of Object.keys(PRODUCTS) as ProductSlug[]) {
    out[slug] = toEntitlement(slug, rows.find((r) => r.product === slug) ?? null);
  }
  return out;
}

export async function entitlementFor(
  tenantId: string,
  product: ProductSlug
): Promise<Entitlement> {
  const service = createServiceClient();
  const { data } = await service
    .from("product_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("product", product)
    .maybeSingle();
  return toEntitlement(product, (data as ProductSubscriptionRow | null) ?? null);
}

/**
 * Start a free trial without a card. Idempotent: an existing row is returned
 * untouched so a refresh cannot restart a trial.
 */
export async function startTrial(
  tenantId: string,
  product: ProductSlug
): Promise<Entitlement> {
  const service = createServiceClient();
  const existing = await entitlementFor(tenantId, product);
  if (existing.row) return existing;
  const p = PRODUCTS[product];
  const trialEnds = new Date(Date.now() + p.trialDays * 86_400_000).toISOString();
  const { data } = await service
    .from("product_subscriptions")
    .upsert(
      {
        tenant_id: tenantId,
        product,
        status: "trialing",
        price_pence: p.pricePence,
        trial_ends_at: trialEnds,
      },
      { onConflict: "tenant_id,product", ignoreDuplicates: true }
    )
    .select("*")
    .maybeSingle();
  if (data) return toEntitlement(product, data as ProductSubscriptionRow);
  return entitlementFor(tenantId, product);
}

/**
 * Public surfaces (widget, legal pages, plan embeds, client links) call this
 * with the OWNER tenant of the record they are about to serve. A lapsed
 * subscription takes the public surface down too — that is the product.
 */
export async function publicSurfaceEnabled(
  tenantId: string,
  product: ProductSlug
): Promise<boolean> {
  const e = await entitlementFor(tenantId, product);
  return e.entitled;
}
