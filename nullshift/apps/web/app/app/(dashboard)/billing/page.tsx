import { T } from "@nullshift/ui/tokens";
import { PRODUCT_LIST, formatMonthly, isProductSlug } from "@nullshift/content/products";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { requireAppSession } from "@/lib/products/session";
import { entitlementsFor } from "@/lib/products/entitlement";
import { stripeReady } from "@/lib/products/billing";
import { billingPortalAction, checkoutAction } from "../actions";

export const dynamic = "force-dynamic";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; product?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireAppSession("/app/billing");
  const ent = await entitlementsFor(session.workspace.tenantId);
  const rows = PRODUCT_LIST.filter((p) => ent[p.slug].row);
  const highlight = sp.product && isProductSlug(sp.product) ? sp.product : null;
  const hasCard = rows.some((p) => ent[p.slug].row?.stripe_subscription_id);
  const ready = stripeReady();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="99"
        label="Billing"
        title="Plans and payment"
        lead="Each product is its own monthly plan. Add a card to keep a product after its trial; cancel any month from the billing portal."
        actions={
          hasCard ? (
            <form action={billingPortalAction}>
              <button type="submit" className="kb kb-outline">
                Manage card and invoices
              </button>
            </form>
          ) : undefined
        }
      />

      {sp.checkout === "success" && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>
            Card added. Stripe is confirming the subscription; this page updates within a
            minute.
          </p>
        </Panel>
      )}
      {sp.checkout === "cancelled" && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            Checkout cancelled. Nothing was charged.
          </p>
        </Panel>
      )}
      {sp.error && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.danger }}>{sp.error}</p>
        </Panel>
      )}
      {!ready && (
        <Panel label="Card payments">
          <p style={{ fontFamily: T.sans, color: "var(--k-muted)", lineHeight: 1.6 }}>
            Card payments are not switched on in this environment. Trials still work;
            email hello@nullshift.co.uk to pay by invoice.
          </p>
        </Panel>
      )}

      {rows.length === 0 ? (
        <Panel>
          <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            No products started yet. Start a trial from the home page.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((p) => {
            const e = ent[p.slug];
            const r = e.row!;
            const tone = e.entitled ? (e.trialing ? "warning" : "success") : "danger";
            return (
              <Panel
                key={p.slug}
                label={`${p.index} · ${p.title}`}
                actions={
                  <StatusChip tone={tone}>{e.status.replace("_", " ")}</StatusChip>
                }
                style={
                  highlight === p.slug ? { borderColor: "var(--k-accent)" } : undefined
                }
              >
                <dl
                  className="grid grid-cols-2 gap-y-3"
                  style={{ fontFamily: T.sans, fontSize: "0.9rem" }}
                >
                  <dt style={mono}>Price</dt>
                  <dd style={{ color: "var(--k-fg)" }}>
                    {formatMonthly(r.price_pence || p.pricePence)}
                  </dd>
                  <dt style={mono}>{e.trialing ? "Trial ends" : "Renews"}</dt>
                  <dd style={{ color: "var(--k-fg)" }}>
                    {e.trialing
                      ? fmtDate(r.trial_ends_at)
                      : fmtDate(r.current_period_end)}
                    {r.cancel_at_period_end ? " · cancels" : ""}
                  </dd>
                  <dt style={mono}>Card</dt>
                  <dd style={{ color: "var(--k-fg)" }}>
                    {r.stripe_subscription_id ? "On file" : "Not yet"}
                  </dd>
                </dl>
                {!r.stripe_subscription_id && ready && (
                  <form action={checkoutAction} className="mt-5">
                    <input type="hidden" name="product" value={p.slug} />
                    <button type="submit" className="kb kb-primary">
                      Add a card · {formatMonthly(p.pricePence)}
                      <span className="k-arrow" aria-hidden>
                        →
                      </span>
                    </button>
                  </form>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
