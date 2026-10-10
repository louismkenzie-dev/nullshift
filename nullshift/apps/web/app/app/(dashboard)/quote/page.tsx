import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRODUCTS } from "@nullshift/content/products";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { countLeadsThisMonth, listLeads, listWidgets } from "@/lib/quote-widget/data";
import { TEMPLATES } from "@/lib/quote-widget/templates";
import { createWidgetAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function QuoteHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const { workspace, entitlement } = await requireProduct("quote");
  if (!entitlement.entitled)
    return <ProductGate product="quote" entitlement={entitlement} />;

  const [widgets, leads, monthCount] = await Promise.all([
    listWidgets(workspace.tenantId),
    listLeads(workspace.tenantId, 5),
    countLeadsThisMonth(workspace.tenantId),
  ]);
  const p = PRODUCTS.quote;

  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="quote" />
      <PageHeader
        index={p.index}
        label={p.title}
        title="Your quote widgets"
        lead="Set your rates once, paste one tag on your website, and every lead arrives with a price range attached."
        actions={
          <Link href="/app/quote/leads" className="kb kb-outline">
            All leads
          </Link>
        }
      />

      {sp.error === "limit" && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.warning }}>
            Your plan includes {p.limits.widgets} widgets. Delete one to add another.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard value={String(widgets.length)} label="Widgets" />
        <StatCard
          value={String(monthCount)}
          label="Leads this month"
          sub={`${p.limits.leadsPerMonth} included`}
          accent
        />
        <StatCard
          value={String(leads.filter((l) => l.status === "new").length)}
          label="New leads to call"
        />
      </div>

      {widgets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {widgets.map((w) => (
            <Panel
              key={w.id}
              label={w.config.trade}
              title={w.name}
              actions={
                <StatusChip tone={w.active ? "success" : "muted"}>
                  {w.active ? "Live" : "Paused"}
                </StatusChip>
              }
            >
              <p
                style={{
                  fontFamily: T.sans,
                  color: "var(--k-muted)",
                  fontSize: "0.9rem",
                }}
              >
                {w.config.services.length} services · {w.config.questions.length}{" "}
                questions · notifies {w.notify_email ?? "nobody"}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/app/quote/${w.id}`} className="kb kb-primary kb-sm">
                  Edit rates and embed
                </Link>
                <a
                  href={`/w/${w.public_key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="kb kb-outline kb-sm"
                >
                  Open live widget
                </a>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {widgets.length < p.limits.widgets && (
        <Panel
          label={widgets.length ? "Add another widget" : "Create your first widget"}
          title="Pick a starting rate card"
        >
          <form action={createWidgetAction} className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Business name shown to customers</span>
              <input
                name="businessName"
                defaultValue={workspace.tenantName}
                className="k-input"
                maxLength={80}
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(TEMPLATES).map(([key, t], i) => (
                <label
                  key={key}
                  className="k-kard k-kard-h flex cursor-pointer flex-col gap-2 p-4"
                  style={{ background: "var(--k-bg)" }}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="template"
                      value={key}
                      defaultChecked={i === 0}
                    />
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        color: "var(--k-fg)",
                      }}
                    >
                      {t.label}
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-muted)",
                    }}
                  >
                    {t.blurb}
                  </span>
                </label>
              ))}
            </div>
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              Starter prices are typical UK figures. You will edit every number on the
              next screen.
            </p>
            <button type="submit" className="kb kb-primary self-start">
              Create widget
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </button>
          </form>
        </Panel>
      )}

      {leads.length > 0 && (
        <Panel
          label="Latest leads"
          actions={
            <Link
              href="/app/quote/leads"
              className="k-label"
              style={{ color: "var(--k-accent)" }}
            >
              See all →
            </Link>
          }
          pad={false}
        >
          <table className="k-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Job</th>
                <th>Guide price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap", color: "var(--k-muted)" }}>
                    {new Date(l.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td>
                    {l.name}
                    <br />
                    <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                      {l.email}
                    </span>
                  </td>
                  <td>
                    {l.service_name}
                    {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    £{(l.low_pence / 100).toFixed(0)} – £{(l.high_pence / 100).toFixed(0)}
                  </td>
                  <td>
                    <StatusChip
                      tone={
                        l.status === "new"
                          ? "accent"
                          : l.status === "won"
                            ? "success"
                            : "muted"
                      }
                    >
                      {l.status}
                    </StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
