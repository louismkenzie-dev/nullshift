import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { listLeads } from "@/lib/plan-embed/data";
import { setPlanLeadStatusAction } from "../actions";

export const dynamic = "force-dynamic";
const STATUSES = ["new", "contacted", "meeting", "won", "lost"] as const;

export default async function PlanLeadsPage() {
  const { workspace, entitlement } = await requireProduct("plans", "/app/plans/leads");
  if (!entitlement.entitled)
    return <ProductGate product="plans" entitlement={entitlement} />;
  const leads = await listLeads(workspace.tenantId);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="04"
        label="Nullshift Plans"
        title="Leads"
        lead="Everyone who asked for a plan, with the plan attached."
        actions={
          <>
            <Link href="/app/plans" className="kb kb-outline">
              Generators
            </Link>
            <a href="/app/plans/leads/export" className="kb kb-primary">
              Export CSV
            </a>
          </>
        }
      />
      <Panel pad={false}>
        {leads.length === 0 ? (
          <p className="p-6" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            No leads yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="k-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Business</th>
                  <th>Bottleneck</th>
                  <th>Budget</th>
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
                      <strong>{l.name}</strong>
                      <br />
                      <a href={`mailto:${l.email}`} style={{ color: "var(--k-accent)" }}>
                        {l.email}
                      </a>
                      {l.phone && (
                        <>
                          <br />
                          <span style={{ color: "var(--k-muted)" }}>{l.phone}</span>
                        </>
                      )}
                    </td>
                    <td>
                      {l.business_name}
                      <br />
                      <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                        {l.answers.sector} · {l.answers.teamSize}
                      </span>
                    </td>
                    <td
                      style={{
                        maxWidth: 260,
                        color: "var(--k-muted)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {l.answers.bottleneck}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{l.answers.budget}</td>
                    <td>
                      <Link
                        href={`/app/plans/leads/${l.id}`}
                        style={{ color: "var(--k-accent)" }}
                      >
                        {l.status === "ready" ? "Read" : l.status}
                      </Link>
                    </td>
                    <td>
                      <form
                        action={setPlanLeadStatusAction}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="id" value={l.id} />
                        <select
                          name="status"
                          defaultValue={l.lead_status}
                          className="k-select"
                          style={{ minHeight: 36, width: 130 }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="kb kb-outline kb-sm">
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
