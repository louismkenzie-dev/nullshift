import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { isStripeConfigured } from "@nullshift/billing/stripe";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import { reconcileApplicationFees } from "@/lib/billing/connectFeeSync";
import {
  breakdownByTenant,
  gbpFromPence,
  startOfMonth,
  testModeCount,
  totalFees,
  type FeeRow,
} from "@/lib/billing/connectFees";

/**
 * Application fees — what Nullshift has actually collected through Stripe
 * Connect, and from which clients. Stripe's own dashboard mixes this into the
 * platform balance with no per-client rollup; this page is the ledger
 * (connect_application_fees, migration 0054), kept current by the Stripe
 * webhook (application_fee.created / .refunded) and by the Sync button below,
 * which pages through the Stripe API directly as a backfill/safety net.
 */
export const dynamic = "force-dynamic";

const dateGB = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

async function syncNow() {
  "use server";
  if (!(await requireStaff()).ok) return;
  const service = createServiceClient();
  const result = await reconcileApplicationFees(service);
  revalidatePath("/admin/billing/fees");
  const q = result.error
    ? `err=${encodeURIComponent(result.error)}`
    : `synced=${result.upserted}&fetched=${result.fetched}`;
  redirect(`/admin/billing/fees?${q}`);
}

export default async function ApplicationFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; fetched?: string; err?: string }>;
}) {
  if (!(await requireStaff()).ok) return null;
  const sp = await searchParams;
  const service = createServiceClient();

  const [{ data: feeRows }, { data: tenantRows }] = await Promise.all([
    service
      .from("connect_application_fees")
      .select(
        "id, tenant_id, stripe_account_id, amount, amount_refunded, currency, livemode, stripe_created_at"
      )
      .order("stripe_created_at", { ascending: false }),
    service.from("tenants").select("id, name"),
  ]);

  const rows = (feeRows ?? []) as FeeRow[];
  const tenantNames = new Map(
    ((tenantRows ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
  );

  const lifetime = totalFees(rows);
  const thisMonth = totalFees(rows, { since: startOfMonth() });
  const testCount = testModeCount(rows);
  const breakdown = breakdownByTenant(rows, tenantNames);
  const configured = isStripeConfigured();

  return (
    <div>
      <PageHeader
        index="/06"
        label="Billing"
        title="Application fees"
        lead="What Nullshift has actually collected through Stripe Connect, and which clients it came from — Stripe's own dashboard doesn't show this rollup."
        actions={
          <Link
            href="/admin/billing"
            style={{ fontFamily: T.mono, fontSize: 11, color: "var(--k-accent)" }}
          >
            ← Billing
          </Link>
        }
      />

      {sp.err && (
        <Reveal className="block" delay={0.03}>
          <p
            role="alert"
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-danger)",
              border: "1px solid var(--k-danger)",
              padding: "10px 14px",
              margin: "16px 0 0",
            }}
          >
            {sp.err}
          </p>
        </Reveal>
      )}
      {sp.synced && !sp.err && (
        <Reveal className="block" delay={0.03}>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-fg)",
              border: "1px solid var(--k-border)",
              padding: "10px 14px",
              margin: "16px 0 0",
            }}
          >
            Synced with Stripe — checked {sp.fetched ?? "0"} fee
            {sp.fetched === "1" ? "" : "s"}, updated {sp.synced}.
          </p>
        </Reveal>
      )}

      <Reveal className="block" delay={0.05}>
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            margin: "18px 0 16px",
          }}
        >
          <StatCard
            value={gbpFromPence(lifetime.netPence)}
            label="Collected — lifetime"
            accent
          />
          <StatCard
            value={gbpFromPence(thisMonth.netPence)}
            label="Collected — this month"
          />
          <StatCard value={String(lifetime.count)} label="Fees collected" />
          <StatCard value={String(breakdown.length)} label="Clients paying a fee" />
        </div>
      </Reveal>

      {!configured && (
        <Reveal className="block" delay={0.06}>
          <Panel label="// NOT CONFIGURED" style={{ marginBottom: 16 }}>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: "var(--k-warning)",
                margin: 0,
              }}
            >
              Stripe is not configured on this deployment (STRIPE_SECRET_KEY unset) —
              nothing can be collected or synced.
            </p>
          </Panel>
        </Reveal>
      )}

      {testCount > 0 && (
        <Reveal className="block" delay={0.06}>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.8rem",
              color: "var(--k-faint)",
              margin: "0 0 16px",
            }}
          >
            {testCount} test-mode fee{testCount === 1 ? "" : "s"} recorded — excluded from
            every total above and from the breakdown below.
          </p>
        </Reveal>
      )}

      <Reveal className="block" delay={0.08}>
        <Panel
          label="// BY CLIENT"
          pad={false}
          style={{ marginBottom: 16 }}
          actions={
            <form action={syncNow}>
              <SubmitButton
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "7px 12px",
                  background: "transparent",
                  color: "var(--k-fg)",
                  border: "1px solid var(--k-border)",
                  borderRadius: 2,
                  cursor: "pointer",
                }}
                pendingLabel="Syncing with Stripe…"
                disabled={!configured}
              >
                Sync now
              </SubmitButton>
            </form>
          }
        >
          {breakdown.length === 0 ? (
            <p
              className="text-center py-8"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              Nothing collected yet. Fees appear here automatically as they're taken
              through a client's connected Stripe account, or press Sync now to check
              Stripe directly.
            </p>
          ) : (
            breakdown.map((g, i) => (
              <div
                key={g.tenantId ?? g.stripeAccountId}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
                style={{
                  padding: "12px 14px",
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                }}
              >
                <div className="min-w-0" style={{ flex: "1 1 220px" }}>
                  <div
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.92rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {g.tenantId ? (
                      <Link
                        href={`/admin/clients/${g.tenantId}/billing`}
                        style={{ color: "inherit" }}
                      >
                        {g.tenantName}
                      </Link>
                    ) : (
                      g.tenantName
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      color: "var(--k-faint)",
                      marginTop: 2,
                    }}
                  >
                    {g.totals.count} fee{g.totals.count === 1 ? "" : "s"} · last{" "}
                    {dateGB(g.lastCollectedAt)}
                    {g.totals.refundedPence > 0
                      ? ` · ${gbpFromPence(g.totals.refundedPence)} refunded`
                      : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "1rem",
                    color: "var(--k-accent)",
                  }}
                >
                  {gbpFromPence(g.totals.netPence)}
                </span>
                {!g.tenantId && <StatusChip tone="warning">Unmatched account</StatusChip>}
              </div>
            ))
          )}
        </Panel>
      </Reveal>

      <p style={{ fontFamily: T.sans, fontSize: "0.8rem", color: "var(--k-faint)" }}>
        Kept current automatically as fees are collected. If a client's total looks stale,
        press Sync now to page through Stripe directly — safe to run any time.
      </p>
    </div>
  );
}
