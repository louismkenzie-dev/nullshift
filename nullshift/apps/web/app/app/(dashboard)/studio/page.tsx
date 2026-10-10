import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRODUCTS } from "@nullshift/content/products";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { getProfile, listClients, listInvoices, listProposals } from "@/lib/studio/data";
import { gbp, totals } from "@/lib/studio/money";
import { createClientAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StudioHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const { workspace, email, entitlement } = await requireProduct("studio");
  if (!entitlement.entitled)
    return <ProductGate product="studio" entitlement={entitlement} />;
  const tid = workspace.tenantId;
  const [profile, clients, proposals, invoices] = await Promise.all([
    getProfile(tid, workspace.tenantName, email),
    listClients(tid),
    listProposals(tid),
    listInvoices(tid),
  ]);
  const p = PRODUCTS.studio;
  const open = proposals.filter((x) => x.status === "sent");
  const owed = invoices.filter((x) => x.status === "sent");
  const owedPence = owed.reduce((a, i) => a + totals(i.items, i.vat_pct).total, 0);
  const setupMissing =
    !profile.brand.address && !profile.bank.accountNumber && !profile.payment_link_url;
  const clientName = (id: string) =>
    clients.find((c) => c.id === id)?.company ||
    clients.find((c) => c.id === id)?.name ||
    "—";

  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="studio" />
      <PageHeader
        index={p.index}
        label={p.title}
        title={profile.brand.name}
        lead="Proposals, acceptance and invoices under your own name. Clients open a private link; no account, no app."
        actions={
          <Link href="/app/studio/settings" className="kb kb-outline">
            Brand, terms and bank
          </Link>
        }
      />
      {sp.error && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.danger }}>{sp.error}</p>
        </Panel>
      )}
      {setupMissing && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.warning }}>
            Add your address and how you get paid in{" "}
            <Link href="/app/studio/settings" style={{ textDecoration: "underline" }}>
              settings
            </Link>{" "}
            before sending an invoice.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          value={String(clients.length)}
          label="Active clients"
          sub={`${p.limits.clients} included`}
        />
        <StatCard value={String(open.length)} label="Proposals awaiting a decision" />
        <StatCard
          value={gbp(owedPence)}
          label="Invoiced, unpaid"
          sub={`${owed.length} invoice${owed.length === 1 ? "" : "s"}`}
          accent
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel label="Clients" pad={false}>
          {clients.length === 0 ? (
            <p className="p-5" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              No clients yet.
            </p>
          ) : (
            <table className="k-table">
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/app/studio/clients/${c.id}`}
                        style={{ color: "var(--k-fg)", fontWeight: 600 }}
                      >
                        {c.company || c.name}
                      </Link>
                      <br />
                      <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                        {c.company ? `${c.name} · ` : ""}
                        {c.email}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/app/studio/clients/${c.id}`}
                        className="kb kb-outline kb-sm"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel label={clients.length ? "Add a client" : "Add your first client"}>
          <form action={createClientAction} className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Contact name</span>
              <input name="name" className="k-input" required maxLength={120} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Company (optional)</span>
              <input name="company" className="k-input" maxLength={160} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Email</span>
              <input name="email" type="email" className="k-input" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Phone (optional)</span>
              <input name="phone" className="k-input" />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="k-label">Address (for invoices, optional)</span>
              <input name="address" className="k-input" maxLength={300} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="kb kb-primary">
                Add client
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel label="Recent proposals" pad={false}>
          {proposals.length === 0 ? (
            <p className="p-5" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              Open a client to write one.
            </p>
          ) : (
            <table className="k-table">
              <tbody>
                {proposals.slice(0, 8).map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link
                        href={`/app/studio/proposals/${x.id}`}
                        style={{ color: "var(--k-fg)" }}
                      >
                        {x.number} · {x.title}
                      </Link>
                      <br />
                      <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                        {clientName(x.client_id)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {gbp(
                        totals(x.items, profile.vat.registered ? profile.vat.ratePct : 0)
                          .total
                      )}
                    </td>
                    <td>
                      <StatusChip
                        tone={
                          x.status === "accepted"
                            ? "success"
                            : x.status === "sent"
                              ? "accent"
                              : x.status === "declined"
                                ? "danger"
                                : "muted"
                        }
                      >
                        {x.status}
                      </StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel label="Recent invoices" pad={false}>
          {invoices.length === 0 ? (
            <p className="p-5" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              Invoices come from accepted proposals, or by hand from a client page.
            </p>
          ) : (
            <table className="k-table">
              <tbody>
                {invoices.slice(0, 8).map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link
                        href={`/app/studio/invoices/${x.id}`}
                        style={{ color: "var(--k-fg)" }}
                      >
                        {x.number}
                      </Link>
                      <br />
                      <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                        {clientName(x.client_id)}
                        {x.due_on
                          ? ` · due ${new Date(x.due_on).toLocaleDateString("en-GB")}`
                          : ""}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {gbp(totals(x.items, x.vat_pct).total)}
                    </td>
                    <td>
                      <StatusChip
                        tone={
                          x.status === "paid"
                            ? "success"
                            : x.status === "sent"
                              ? "warning"
                              : x.status === "void"
                                ? "danger"
                                : "muted"
                        }
                      >
                        {x.status}
                      </StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
