import type {
  Brand,
  ClientRow,
  InvoiceRow,
  ProfileRow,
  ProposalRow,
} from "@/lib/studio/data";
import { gbp, totals } from "@/lib/studio/money";

const font = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const fmt = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

export function ClientShell({
  brand,
  children,
  poweredBy,
}: {
  brand: Brand;
  children: React.ReactNode;
  poweredBy: boolean;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f6f4",
        fontFamily: font,
        color: "#1d1f24",
      }}
    >
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" style={{ height: 30 }} />
          ) : (
            <span
              style={{
                width: 10,
                height: 26,
                background: brand.colour,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
          )}
          <strong style={{ fontSize: 16 }}>{brand.name}</strong>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
            {brand.email}
          </span>
        </div>
      </header>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 64px" }}>
        {children}
      </main>
      <footer
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 20px 32px",
          fontSize: 12,
          color: "#9ca3af",
        }}
      >
        {brand.address && <span>{brand.address} · </span>}
        {brand.website && <span>{brand.website} · </span>}
        {poweredBy && (
          <a href="https://nullshift.co.uk/products/studio" style={{ color: "#9ca3af" }}>
            Powered by Nullshift Studio
          </a>
        )}
      </footer>
    </div>
  );
}

export function ItemsTable({
  items,
  vatPct,
  colour,
}: {
  items: ProposalRow["items"];
  vatPct: number;
  colour: string;
}) {
  const t = totals(items, vatPct);
  const td: React.CSSProperties = {
    padding: "10px 8px",
    borderBottom: "1px solid #e5e7eb",
    verticalAlign: "top",
  };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
      <thead>
        <tr
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#6b7280",
          }}
        >
          <th style={{ ...td, textAlign: "left" }}>Item</th>
          <th style={{ ...td, textAlign: "right" }}>Qty</th>
          <th style={{ ...td, textAlign: "right" }}>Unit</th>
          <th style={{ ...td, textAlign: "right" }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i, k) => (
          <tr key={k}>
            <td style={td}>{i.description}</td>
            <td style={{ ...td, textAlign: "right" }}>{i.qty}</td>
            <td style={{ ...td, textAlign: "right" }}>{gbp(i.unitPence)}</td>
            <td style={{ ...td, textAlign: "right" }}>
              {gbp(Math.round(i.qty * i.unitPence))}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        {vatPct > 0 && (
          <>
            <tr>
              <td colSpan={3} style={{ ...td, textAlign: "right", color: "#6b7280" }}>
                Subtotal
              </td>
              <td style={{ ...td, textAlign: "right" }}>{gbp(t.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} style={{ ...td, textAlign: "right", color: "#6b7280" }}>
                VAT {vatPct}%
              </td>
              <td style={{ ...td, textAlign: "right" }}>{gbp(t.vat)}</td>
            </tr>
          </>
        )}
        <tr>
          <td
            colSpan={3}
            style={{ ...td, textAlign: "right", fontWeight: 700, borderBottom: "none" }}
          >
            Total
          </td>
          <td
            style={{
              ...td,
              textAlign: "right",
              fontWeight: 700,
              color: colour,
              fontSize: 18,
              borderBottom: "none",
            }}
          >
            {gbp(t.total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

export function ProposalDocument({
  p,
  profile,
  client,
}: {
  p: ProposalRow;
  profile: ProfileRow;
  client: ClientRow;
}) {
  const vat = profile.vat.registered ? profile.vat.ratePct : 0;
  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
    marginTop: 16,
  };
  return (
    <article>
      <p
        style={{
          fontSize: 12,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: profile.brand.colour,
          fontWeight: 700,
          margin: 0,
        }}
      >
        Proposal {p.number}
      </p>
      <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: "6px 0 8px" }}>
        {p.title}
      </h1>
      <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
        Prepared for {client.name}
        {client.company ? `, ${client.company}` : ""} by {profile.brand.name}
        {p.valid_until ? ` · valid until ${fmt(p.valid_until)}` : ""}
      </p>
      {p.intro && (
        <div style={card}>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {p.intro}
          </p>
        </div>
      )}
      {p.scope && (
        <div style={card}>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6b7280",
            }}
          >
            Scope
          </h2>
          <p style={{ margin: 0, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{p.scope}</p>
        </div>
      )}
      <div style={card}>
        <h2
          style={{
            margin: "0 0 10px",
            fontSize: 13,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#6b7280",
          }}
        >
          Investment
        </h2>
        <ItemsTable items={p.items} vatPct={vat} colour={profile.brand.colour} />
        {profile.vat.registered && profile.vat.number && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9ca3af" }}>
            VAT no. {profile.vat.number}
          </p>
        )}
      </div>
      {p.terms && (
        <div style={card}>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6b7280",
            }}
          >
            Terms
          </h2>
          <p
            style={{
              margin: 0,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              fontSize: 14,
              color: "#374151",
            }}
          >
            {p.terms}
          </p>
        </div>
      )}
    </article>
  );
}

export function InvoiceDocument({
  inv,
  profile,
  client,
}: {
  inv: InvoiceRow;
  profile: ProfileRow;
  client: ClientRow;
}) {
  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 24,
    marginTop: 16,
  };
  const b = profile.bank;
  const t = totals(inv.items, inv.vat_pct);
  return (
    <article>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: profile.brand.colour,
              fontWeight: 700,
              margin: 0,
            }}
          >
            Invoice
          </p>
          <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: "6px 0 8px" }}>
            {inv.number}
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            Issued {fmt(inv.issued_on)}
            {inv.due_on ? ` · due ${fmt(inv.due_on)}` : ""}
          </p>
        </div>
        <div style={{ textAlign: "right", fontSize: 14, color: "#374151" }}>
          <strong>{profile.brand.name}</strong>
          <br />
          {profile.brand.address && (
            <>
              {profile.brand.address}
              <br />
            </>
          )}
          {profile.brand.email}
          {profile.vat.registered && profile.vat.number && (
            <>
              <br />
              VAT {profile.vat.number}
            </>
          )}
        </div>
      </div>
      <div style={{ ...card, fontSize: 14 }}>
        <span style={{ color: "#6b7280" }}>Bill to</span>
        <br />
        <strong>{client.company || client.name}</strong>
        {client.company && (
          <>
            <br />
            {client.name}
          </>
        )}
        {client.address && (
          <>
            <br />
            {client.address}
          </>
        )}
        <br />
        {client.email}
      </div>
      <div style={card}>
        <ItemsTable
          items={inv.items}
          vatPct={inv.vat_pct}
          colour={profile.brand.colour}
        />
      </div>
      <div style={card}>
        <h2
          style={{
            margin: "0 0 10px",
            fontSize: 13,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#6b7280",
          }}
        >
          How to pay {gbp(t.total)}
        </h2>
        {inv.status === "paid" ? (
          <p style={{ margin: 0, color: "#059669", fontWeight: 600 }}>
            Paid — thank you.
          </p>
        ) : (
          <>
            {profile.payment_link_url && (
              <p style={{ margin: "0 0 14px" }}>
                <a
                  href={profile.payment_link_url}
                  style={{
                    display: "inline-block",
                    background: profile.brand.colour,
                    color: "#fff",
                    padding: "12px 20px",
                    borderRadius: 6,
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Pay online
                </a>
              </p>
            )}
            {(b.accountNumber || b.iban) && (
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "6px 12px",
                  margin: 0,
                  fontSize: 15,
                }}
              >
                {b.accountName && (
                  <>
                    <dt style={{ color: "#6b7280" }}>Account name</dt>
                    <dd style={{ margin: 0 }}>{b.accountName}</dd>
                  </>
                )}
                {b.sortCode && (
                  <>
                    <dt style={{ color: "#6b7280" }}>Sort code</dt>
                    <dd style={{ margin: 0 }}>{b.sortCode}</dd>
                  </>
                )}
                {b.accountNumber && (
                  <>
                    <dt style={{ color: "#6b7280" }}>Account number</dt>
                    <dd style={{ margin: 0 }}>{b.accountNumber}</dd>
                  </>
                )}
                {b.iban && (
                  <>
                    <dt style={{ color: "#6b7280" }}>IBAN</dt>
                    <dd style={{ margin: 0 }}>{b.iban}</dd>
                  </>
                )}
                <dt style={{ color: "#6b7280" }}>Reference</dt>
                <dd style={{ margin: 0 }}>{inv.number}</dd>
              </dl>
            )}
            {!profile.payment_link_url && !b.accountNumber && !b.iban && (
              <p style={{ margin: 0, color: "#6b7280" }}>
                Payment details to follow from {profile.brand.name}.
              </p>
            )}
          </>
        )}
        {inv.notes && (
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 14,
              color: "#374151",
              whiteSpace: "pre-wrap",
            }}
          >
            {inv.notes}
          </p>
        )}
      </div>
    </article>
  );
}
