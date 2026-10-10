import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel } from "@/components/app/AppKit";
import { ProductGate } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { listLeads } from "@/lib/quote-widget/data";
import { setLeadStatusAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;

export default async function LeadsPage() {
  const { workspace, entitlement } = await requireProduct("quote", "/app/quote/leads");
  if (!entitlement.entitled)
    return <ProductGate product="quote" entitlement={entitlement} />;
  const leads = await listLeads(workspace.tenantId, 500);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="01"
        label="Nullshift Quote"
        title="Leads"
        lead="Every customer who asked for a price. Change the status as you call them; export the lot as a spreadsheet."
        actions={
          <>
            <Link href="/app/quote" className="kb kb-outline">
              Back to widgets
            </Link>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route-handler download; must not be prefetched */}
            <a href="/app/quote/leads/export" className="kb kb-primary">
              Export CSV
            </a>
          </>
        }
      />
      <Panel pad={false}>
        {leads.length === 0 ? (
          <p className="p-6" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
            No leads yet. Once the widget is on your site they will appear here within
            seconds.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="k-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Job and answers</th>
                  <th>Guide price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap", color: "var(--k-muted)" }}>
                      {new Date(l.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
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
                          <a href={`tel:${l.phone}`} style={{ color: "var(--k-muted)" }}>
                            {l.phone}
                          </a>
                        </>
                      )}
                      {l.postcode && (
                        <>
                          <br />
                          <span style={{ color: "var(--k-muted)" }}>{l.postcode}</span>
                        </>
                      )}
                    </td>
                    <td style={{ maxWidth: 360 }}>
                      {l.service_name}
                      {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                      {l.answers.length > 0 && (
                        <ul
                          style={{
                            margin: "6px 0 0",
                            paddingLeft: 16,
                            color: "var(--k-muted)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {l.answers.map((a, i) => (
                            <li key={i}>
                              {a.question}: {a.answer}
                            </li>
                          ))}
                        </ul>
                      )}
                      {l.message && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            color: "var(--k-muted)",
                            fontSize: "0.85rem",
                          }}
                        >
                          “{l.message}”
                        </p>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      £{(l.low_pence / 100).toFixed(0)} – £
                      {(l.high_pence / 100).toFixed(0)}
                    </td>
                    <td>
                      <form
                        action={setLeadStatusAction}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="id" value={l.id} />
                        <select
                          name="status"
                          defaultValue={l.status}
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
