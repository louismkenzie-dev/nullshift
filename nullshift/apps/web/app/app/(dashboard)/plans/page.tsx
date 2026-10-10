import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRODUCTS } from "@nullshift/content/products";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { listEmbeds, listLeads, plansThisMonth } from "@/lib/plan-embed/data";
import { createEmbedAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlansHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const { workspace, entitlement } = await requireProduct("plans");
  if (!entitlement.entitled)
    return <ProductGate product="plans" entitlement={entitlement} />;
  const [embeds, leads, used] = await Promise.all([
    listEmbeds(workspace.tenantId),
    listLeads(workspace.tenantId, 6),
    plansThisMonth(workspace.tenantId),
  ]);
  const p = PRODUCTS.plans;
  const over = Math.max(0, used - p.limits.plansPerMonth);
  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="plans" />
      <PageHeader
        index={p.index}
        label={p.title}
        title="Plan generators"
        lead="A six-question form that writes a tailored systems plan in your voice, recommends your services, and hands you the lead."
        actions={
          <Link href="/app/plans/leads" className="kb kb-outline">
            All leads
          </Link>
        }
      />
      {sp.error === "limit" && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.warning }}>
            Your plan includes {p.limits.embeds} generators.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          value={String(used)}
          label="Plans this month"
          sub={`${p.limits.plansPerMonth} included${over ? ` · ${over} extra at £1` : ""}`}
          accent
        />
        <StatCard
          value={String(leads.filter((l) => l.lead_status === "new").length)}
          label="New leads"
        />
        <StatCard value={String(embeds.length)} label="Generators" />
      </div>

      {embeds.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {embeds.map((e) => (
            <Panel
              key={e.id}
              label={e.brand.name}
              title={e.name}
              actions={
                <StatusChip tone={e.active ? "success" : "muted"}>
                  {e.active ? "Live" : "Paused"}
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
                {e.brand.services.length} services · notifies {e.notify_email ?? "nobody"}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/app/plans/${e.id}`} className="kb kb-primary kb-sm">
                  Brand, services and embed
                </Link>
                <a
                  href={`/p/${e.public_key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="kb kb-outline kb-sm"
                >
                  Open hosted form
                </a>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {embeds.length < p.limits.embeds && (
        <Panel
          label={embeds.length ? "Add another" : "Create your generator"}
          title="Whose name goes on the plan?"
        >
          <form
            action={createEmbedAction}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="k-label">Your brand name</span>
              <input
                name="brandName"
                className="k-input"
                defaultValue={workspace.tenantName}
                maxLength={80}
                required
              />
            </label>
            <button type="submit" className="kb kb-primary">
              Create
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
          pad={false}
          actions={
            <Link
              href="/app/plans/leads"
              className="k-label"
              style={{ color: "var(--k-accent)" }}
            >
              See all →
            </Link>
          }
        >
          <table className="k-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Business</th>
                <th>Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td style={{ color: "var(--k-muted)", whiteSpace: "nowrap" }}>
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
                    {l.business_name}
                    <br />
                    <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                      {l.answers.sector}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/app/plans/leads/${l.id}`}
                      style={{ color: "var(--k-accent)" }}
                    >
                      {l.status === "ready" ? "Read plan" : l.status}
                    </Link>
                  </td>
                  <td>
                    <StatusChip
                      tone={
                        l.lead_status === "new"
                          ? "accent"
                          : l.lead_status === "won"
                            ? "success"
                            : "muted"
                      }
                    >
                      {l.lead_status}
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
