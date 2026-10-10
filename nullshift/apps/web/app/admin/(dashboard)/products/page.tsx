import { createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import {
  PRODUCTS,
  PRODUCT_LIST,
  formatMonthly,
  type ProductSlug,
} from "@nullshift/content/products";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import {
  isEntitledStatus,
  toEntitlement,
  type ProductSubscriptionRow,
} from "@/lib/products/entitlement";

export const dynamic = "force-dynamic";

/**
 * Self-serve products overview: every workspace that started a trial or pays
 * for Quote / Legal / Watch / Plans / Studio, with status and MRR. Read-only;
 * the customer manages their own plan from /app/billing and Stripe.
 */
export default async function AdminProductsPage() {
  const db = createServiceClient();
  const { data } = await db
    .from("product_subscriptions")
    .select("*, tenants(name, contact_email, created_at)")
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = (data ?? []) as (ProductSubscriptionRow & {
    tenants: { name: string; contact_email: string | null; created_at: string } | null;
  })[];
  const ents = rows.map((r) => ({ r, e: toEntitlement(r.product, r) }));
  const paying = ents.filter(
    ({ r, e }) => e.entitled && r.stripe_subscription_id && e.status !== "trialing"
  );
  const trialing = ents.filter(({ e }) => e.trialing);
  const mrr = paying.reduce(
    (a, { r }) => a + (r.price_pence || PRODUCTS[r.product].pricePence),
    0
  );
  const byProduct = (slug: ProductSlug) => ents.filter(({ r }) => r.product === slug);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="P"
        label="Products"
        title="Self-serve products"
        lead="Trials and subscriptions for the off-the-shelf products. Customers manage their own cards in Stripe; this view is for the numbers."
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard value={formatMonthly(mrr)} label="Product MRR" accent />
        <StatCard value={String(paying.length)} label="Paying subscriptions" />
        <StatCard value={String(trialing.length)} label="Active trials" />
        <StatCard
          value={String(new Set(rows.map((r) => r.tenant_id)).size)}
          label="Workspaces"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {PRODUCT_LIST.map((p) => {
          const list = byProduct(p.slug);
          const pay = list.filter(
            ({ r, e }) => e.entitled && r.stripe_subscription_id && !e.trialing
          ).length;
          return (
            <StatCard
              key={p.slug}
              value={`${pay} / ${list.length}`}
              label={p.title}
              sub="paying / started"
            />
          );
        })}
      </div>
      <Panel label="All subscriptions" pad={false}>
        {rows.length === 0 ? (
          <p className="p-5" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            Nobody has started a trial yet.
          </p>
        ) : (
          <table className="k-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Product</th>
                <th>Status</th>
                <th>Price</th>
                <th>Trial ends / renews</th>
                <th>Card</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {ents.map(({ r, e }) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.tenants?.name ?? r.tenant_id}</strong>
                    <br />
                    <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                      {r.tenants?.contact_email ?? ""}
                    </span>
                  </td>
                  <td>{PRODUCTS[r.product].title}</td>
                  <td>
                    <StatusChip
                      tone={
                        e.trialing
                          ? "warning"
                          : isEntitledStatus(e.status)
                            ? "success"
                            : "danger"
                      }
                    >
                      {e.status}
                    </StatusChip>
                  </td>
                  <td>
                    {formatMonthly(r.price_pence || PRODUCTS[r.product].pricePence)}
                  </td>
                  <td style={{ color: "var(--k-muted)" }}>
                    {(e.trialing ? r.trial_ends_at : r.current_period_end)
                      ? new Date(
                          (e.trialing ? r.trial_ends_at : r.current_period_end)!
                        ).toLocaleDateString("en-GB")
                      : "—"}
                    {r.cancel_at_period_end ? " · cancels" : ""}
                  </td>
                  <td>{r.stripe_subscription_id ? "yes" : "no"}</td>
                  <td style={{ color: "var(--k-muted)", whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
