import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRODUCT_LIST, formatMonthly } from "@nullshift/content/products";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { requireAppSession } from "@/lib/products/session";
import { entitlementsFor } from "@/lib/products/entitlement";
import { startTrialAction, renameWorkspaceAction } from "./actions";
import { startTrial } from "@/lib/products/entitlement";
import { isProductSlug } from "@nullshift/content/products";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireAppSession();
  // Arriving from a product page's "Start free trial" button: start it and go.
  if (sp.start && isProductSlug(sp.start)) {
    await startTrial(session.workspace.tenantId, sp.start);
    redirect(`/app/${sp.start}`);
  }
  const ent = await entitlementsFor(session.workspace.tenantId);
  const started = PRODUCT_LIST.filter((p) => ent[p.slug].row);
  const available = PRODUCT_LIST.filter((p) => !ent[p.slug].row);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        index="00"
        label="Nullshift Products"
        title={session.workspace.tenantName}
        lead="Every product runs on a fourteen-day free trial with no card. Add a card any time from Billing; cancel any month."
      />

      {started.length > 0 && (
        <section className="flex flex-col gap-4">
          <span style={mono}>Your products</span>
          <div className="grid gap-4 md:grid-cols-2">
            {started.map((p) => {
              const e = ent[p.slug];
              const tone = e.entitled ? (e.trialing ? "warning" : "success") : "danger";
              const label = e.trialing
                ? `Trial · ${e.trialDaysLeft ?? 0} day${e.trialDaysLeft === 1 ? "" : "s"} left`
                : e.status === "active"
                  ? "Active"
                  : e.status === "past_due"
                    ? "Payment overdue"
                    : e.status === "expired"
                      ? "Trial ended"
                      : e.status;
              return (
                <Panel
                  key={p.slug}
                  label={`${p.index} · ${p.title}`}
                  actions={<StatusChip tone={tone}>{label}</StatusChip>}
                >
                  <p
                    style={{
                      fontFamily: T.sans,
                      color: "var(--k-muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    {p.tagline}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {e.entitled ? (
                      <Link href={`/app/${p.slug}`} className="kb kb-primary">
                        Open {p.name}
                        <span className="k-arrow" aria-hidden>
                          →
                        </span>
                      </Link>
                    ) : (
                      <Link
                        href={`/app/billing?product=${p.slug}`}
                        className="kb kb-primary"
                      >
                        Add a card to continue
                        <span className="k-arrow" aria-hidden>
                          →
                        </span>
                      </Link>
                    )}
                    {e.trialing && (
                      <Link
                        href={`/app/billing?product=${p.slug}`}
                        className="kb kb-outline"
                      >
                        Add a card · {formatMonthly(p.pricePence)}
                      </Link>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section className="flex flex-col gap-4">
          <span style={mono}>
            {started.length ? "Add another product" : "Start a free trial"}
          </span>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {available.map((p) => (
              <Panel key={p.slug} label={`${p.index} · ${p.title}`}>
                <p
                  style={{
                    fontFamily: T.sans,
                    color: "var(--k-muted)",
                    lineHeight: 1.6,
                    minHeight: 72,
                  }}
                >
                  {p.tagline}
                </p>
                <p style={{ ...mono, marginTop: 14, color: "var(--k-fg)" }}>
                  {formatMonthly(p.pricePence)} · {p.trialDays}-day free trial
                </p>
                <form action={startTrialAction} className="mt-4 flex flex-wrap gap-3">
                  <input type="hidden" name="product" value={p.slug} />
                  <button type="submit" className="kb kb-primary">
                    Start trial
                    <span className="k-arrow" aria-hidden>
                      →
                    </span>
                  </button>
                  <Link
                    href={`/products/${p.slug}`}
                    className="kb kb-outline"
                    target="_blank"
                  >
                    Learn more
                  </Link>
                </form>
              </Panel>
            ))}
          </div>
        </section>
      )}

      <Panel label="Workspace">
        <form
          action={renameWorkspaceAction}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1.5">
            <span style={mono}>Business name (shown on your client-facing pages)</span>
            <input
              name="name"
              defaultValue={session.workspace.tenantName}
              className="k-input"
              maxLength={120}
              required
            />
          </label>
          <button type="submit" className="kb kb-outline">
            Save
          </button>
        </form>
      </Panel>
    </div>
  );
}
