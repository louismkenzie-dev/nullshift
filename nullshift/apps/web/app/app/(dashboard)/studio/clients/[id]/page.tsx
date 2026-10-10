import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import {
  getClient,
  getProfile,
  listInvoices,
  listNotes,
  listProposals,
} from "@/lib/studio/data";
import { gbp, totals } from "@/lib/studio/money";
import {
  addNoteAction,
  createInvoiceAction,
  createProposalAction,
  rotateTokenAction,
  updateClientAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, email, entitlement } = await requireProduct(
    "studio",
    `/app/studio/clients/${id}`
  );
  if (!entitlement.entitled)
    return <ProductGate product="studio" entitlement={entitlement} />;
  const tid = workspace.tenantId;
  const c = await getClient(tid, id);
  if (!c) notFound();
  const [profile, proposals, invoices, notes] = await Promise.all([
    getProfile(tid, workspace.tenantName, email),
    listProposals(tid, id),
    listInvoices(tid, id),
    listNotes(id),
  ]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  const link = `${site}/c/${c.token}`;
  const vat = profile.vat.registered ? profile.vat.ratePct : 0;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="05"
        label="Nullshift Studio"
        title={c.company || c.name}
        lead={
          <>
            <a href={`mailto:${c.email}`} style={{ color: "var(--k-accent)" }}>
              {c.email}
            </a>
            {c.phone ? ` · ${c.phone}` : ""}
          </>
        }
        actions={
          <>
            <Link href="/app/studio" className="kb kb-outline">
              All clients
            </Link>
            <form action={createProposalAction}>
              <input type="hidden" name="clientId" value={c.id} />
              <button type="submit" className="kb kb-primary">
                New proposal
              </button>
            </form>
            <form action={createInvoiceAction}>
              <input type="hidden" name="clientId" value={c.id} />
              <button type="submit" className="kb kb-outline">
                New invoice
              </button>
            </form>
          </>
        }
      />
      {sp.saved && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>Saved.</p>
        </Panel>
      )}

      <Panel
        label="Private client link"
        actions={
          <StatusChip tone={c.archived ? "muted" : "success"}>
            {c.archived ? "archived" : "active"}
          </StatusChip>
        }
      >
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "0.8rem",
            color: "var(--k-fg)",
            wordBreak: "break-all",
          }}
        >
          {link}
        </p>
        <p
          className="mt-2"
          style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
        >
          Every proposal and invoice you send them is at this link. Emails include it
          automatically. Regenerating revokes the old one.
        </p>
        <form action={rotateTokenAction} className="mt-3">
          <input type="hidden" name="id" value={c.id} />
          <button type="submit" className="kb kb-outline kb-sm">
            Regenerate link
          </button>
        </form>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel label="Proposals" pad={false}>
          {proposals.length === 0 ? (
            <p className="p-5" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              None yet.
            </p>
          ) : (
            <table className="k-table">
              <tbody>
                {proposals.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link
                        href={`/app/studio/proposals/${x.id}`}
                        style={{ color: "var(--k-fg)" }}
                      >
                        {x.number} · {x.title}
                      </Link>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {gbp(totals(x.items, vat).total)}
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
        <Panel label="Invoices" pad={false}>
          {invoices.length === 0 ? (
            <p className="p-5" style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              None yet.
            </p>
          ) : (
            <table className="k-table">
              <tbody>
                {invoices.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link
                        href={`/app/studio/invoices/${x.id}`}
                        style={{ color: "var(--k-fg)" }}
                      >
                        {x.number}
                      </Link>
                      {x.due_on && (
                        <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                          {" "}
                          · due {new Date(x.due_on).toLocaleDateString("en-GB")}
                        </span>
                      )}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel label="Private notes">
          <form action={addNoteAction} className="flex flex-col gap-3">
            <input type="hidden" name="clientId" value={c.id} />
            <textarea
              name="body"
              className="k-textarea"
              rows={3}
              placeholder="Only you see these."
              required
            />
            <button type="submit" className="kb kb-outline kb-sm self-start">
              Add note
            </button>
          </form>
          <ul
            className="mt-4 flex flex-col gap-3"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {notes.map((n) => (
              <li
                key={n.id}
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9rem",
                  color: "var(--k-fg)",
                  borderTop: "1px solid var(--k-border)",
                  paddingTop: 10,
                }}
              >
                <span style={{ color: "var(--k-faint)", fontSize: "0.75rem" }}>
                  {new Date(n.created_at).toLocaleString("en-GB")}
                </span>
                <br />
                <span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel label="Details">
          <form action={updateClientAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={c.id} />
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Contact name</span>
              <input name="name" className="k-input" defaultValue={c.name} required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Company</span>
              <input name="company" className="k-input" defaultValue={c.company ?? ""} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Email</span>
              <input
                name="email"
                type="email"
                className="k-input"
                defaultValue={c.email}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Phone</span>
              <input name="phone" className="k-input" defaultValue={c.phone ?? ""} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="k-label">Address</span>
              <input name="address" className="k-input" defaultValue={c.address ?? ""} />
            </label>
            <label
              className="flex items-center gap-2"
              style={{ fontFamily: T.sans, color: "var(--k-fg)" }}
            >
              <input type="checkbox" name="archived" defaultChecked={c.archived} />{" "}
              Archived (link stops working)
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="kb kb-outline kb-sm">
                Save details
              </button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
