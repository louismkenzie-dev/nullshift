import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRODUCTS, formatMonthly, type ProductSlug } from "@nullshift/content/products";
import { PageHeader, Panel } from "@/components/app/AppKit";
import type { Entitlement } from "@/lib/products/entitlement";

/**
 * What a product console shows when the workspace is not entitled: a trial
 * that has not started, or one that has ended. Shared by every product.
 */
export function ProductGate({
  product,
  entitlement,
}: {
  product: ProductSlug;
  entitlement: Entitlement;
}) {
  const p = PRODUCTS[product];
  const ended =
    entitlement.status === "expired" ||
    entitlement.status === "canceled" ||
    entitlement.status === "unpaid";
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index={p.index}
        label={p.title}
        title={ended ? "Your trial has ended" : p.tagline}
        lead={
          ended
            ? `Add a card to pick up where you left off. Everything you set up is still here.`
            : p.audience
        }
      />
      <Panel>
        <p style={{ fontFamily: T.sans, color: "var(--k-muted)", lineHeight: 1.6 }}>
          {formatMonthly(p.pricePence)} · {p.trialDays}-day free trial · cancel any month.
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href={ended ? `/app/billing?product=${p.slug}` : `/app?start=${p.slug}`}
            className="kb kb-primary"
          >
            {ended ? "Add a card" : "Start free trial"}
            <span className="k-arrow" aria-hidden>
              →
            </span>
          </Link>
          <Link href={`/products/${p.slug}`} className="kb kb-outline" target="_blank">
            About {p.name}
          </Link>
        </div>
      </Panel>
    </div>
  );
}

/** Small amber strip reminding a trialing workspace how long is left. */
export function TrialStrip({
  entitlement,
  product,
}: {
  entitlement: Entitlement;
  product: ProductSlug;
}) {
  if (!entitlement.trialing) return null;
  const d = entitlement.trialDaysLeft ?? 0;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      style={{
        border: "1px solid rgba(245,213,71,0.35)",
        background: "rgba(245,213,71,0.08)",
        fontFamily: T.mono,
        fontSize: "0.68rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.warning,
      }}
    >
      <span>
        Free trial · {d} day{d === 1 ? "" : "s"} left
      </span>
      <Link
        href={`/app/billing?product=${product}`}
        style={{
          color: "var(--k-fg)",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        Add a card to keep it running
      </Link>
    </div>
  );
}
