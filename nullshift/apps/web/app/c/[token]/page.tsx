import { notFound } from "next/navigation";
import { listInvoices, listProposals, resolveClientByToken } from "@/lib/studio/data";
import { gbp, totals } from "@/lib/studio/money";
import { ClientShell } from "@/components/studio/Documents";

export const dynamic = "force-dynamic";

export default async function ClientHub({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hit = await resolveClientByToken(token);
  if (!hit) notFound();
  const { client, profile } = hit;
  const [proposals, invoices] = await Promise.all([
    listProposals(client.tenant_id, client.id),
    listInvoices(client.tenant_id, client.id),
  ]);
  const vat = profile.vat.registered ? profile.vat.ratePct : 0;
  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    color: "#111",
    textDecoration: "none",
    borderRadius: 6,
  };
  const tag = (s: string) => (
    <span
      style={{
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: s === "accepted" || s === "paid" ? "#059669" : "#6b7280",
      }}
    >
      {s}
    </span>
  );
  return (
    <ClientShell brand={profile.brand} poweredBy={hit.trialing}>
      <h1 style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>
        Hello {client.name.split(" ")[0]}
      </h1>
      <p style={{ color: "#6b7280", margin: "0 0 28px" }}>
        Your proposals and invoices from {profile.brand.name}.
      </p>
      <h2
        style={{
          fontSize: 13,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#6b7280",
        }}
      >
        Proposals
      </h2>
      <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
        {proposals
          .filter((p) => p.status !== "draft")
          .map((p) => (
            <a key={p.id} href={`/c/${token}/proposal/${p.id}`} style={row}>
              <span>
                <strong>{p.title}</strong>{" "}
                <span style={{ color: "#9ca3af" }}>{p.number}</span>
              </span>
              <span style={{ display: "flex", gap: 14 }}>
                {gbp(totals(p.items, vat).total)} {tag(p.status)}
              </span>
            </a>
          ))}
        {proposals.filter((p) => p.status !== "draft").length === 0 && (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Nothing yet.</p>
        )}
      </div>
      <h2
        style={{
          fontSize: 13,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#6b7280",
        }}
      >
        Invoices
      </h2>
      <div style={{ display: "grid", gap: 8 }}>
        {invoices
          .filter((i) => i.status !== "draft" && i.status !== "void")
          .map((i) => (
            <a key={i.id} href={`/c/${token}/invoice/${i.id}`} style={row}>
              <span>
                <strong>{i.number}</strong>
                {i.due_on && (
                  <span style={{ color: "#9ca3af" }}>
                    {" "}
                    · due {new Date(i.due_on).toLocaleDateString("en-GB")}
                  </span>
                )}
              </span>
              <span style={{ display: "flex", gap: 14 }}>
                {gbp(totals(i.items, i.vat_pct).total)} {tag(i.status)}
              </span>
            </a>
          ))}
        {invoices.filter((i) => i.status !== "draft" && i.status !== "void").length ===
          0 && <p style={{ color: "#9ca3af", fontSize: 14 }}>Nothing yet.</p>}
      </div>
    </ClientShell>
  );
}
