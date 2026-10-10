import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel } from "@/components/app/AppKit";
import { ProductGate } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { getProfile } from "@/lib/studio/data";
import { saveProfileAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StudioSettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const { workspace, email, entitlement } = await requireProduct(
    "studio",
    "/app/studio/settings"
  );
  if (!entitlement.entitled)
    return <ProductGate product="studio" entitlement={entitlement} />;
  const p = await getProfile(workspace.tenantId, workspace.tenantName, email);
  const F = ({
    name,
    label,
    value,
    type = "text",
    span = false,
  }: {
    name: string;
    label: string;
    value: string | number | null | undefined;
    type?: string;
    span?: boolean;
  }) => (
    <label className={`flex flex-col gap-1.5 ${span ? "sm:col-span-2" : ""}`}>
      <span className="k-label">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        className="k-input"
        style={type === "color" ? { padding: 4 } : undefined}
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        index="05"
        label="Nullshift Studio"
        title="Brand, terms and payment"
        lead="Everything on this page appears on your client-facing proposals and invoices."
        actions={
          <Link href="/app/studio" className="kb kb-outline">
            Back
          </Link>
        }
      />
      {sp.saved && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>Saved.</p>
        </Panel>
      )}
      <form action={saveProfileAction} className="flex flex-col gap-5">
        <Panel label="1" title="Your brand">
          <div className="grid gap-4 sm:grid-cols-2">
            <F name="brandName" label="Business name" value={p.brand.name} />
            <F
              name="email"
              label="Email on documents"
              value={p.brand.email}
              type="email"
            />
            <F name="phone" label="Phone" value={p.brand.phone} />
            <F name="website" label="Website" value={p.brand.website} />
            <F name="address" label="Address" value={p.brand.address} span />
            <F name="logoUrl" label="Logo URL (https)" value={p.brand.logoUrl} />
            <F name="colour" label="Accent colour" value={p.brand.colour} type="color" />
          </div>
        </Panel>
        <Panel label="2" title="Getting paid">
          <div className="grid gap-4 sm:grid-cols-2">
            <F
              name="paymentLinkUrl"
              label="Online payment link (Stripe, GoCardless, PayPal…)"
              value={p.payment_link_url}
              span
            />
            <F name="accountName" label="Bank account name" value={p.bank.accountName} />
            <F name="sortCode" label="Sort code" value={p.bank.sortCode} />
            <F name="accountNumber" label="Account number" value={p.bank.accountNumber} />
            <F name="iban" label="IBAN (optional)" value={p.bank.iban} />
            <label
              className="flex items-center gap-2 sm:col-span-2"
              style={{ fontFamily: T.sans, color: "var(--k-fg)" }}
            >
              <input
                type="checkbox"
                name="vatRegistered"
                defaultChecked={p.vat.registered}
              />{" "}
              VAT registered
            </label>
            <F name="vatNumber" label="VAT number" value={p.vat.number} />
            <F name="vatRate" label="VAT rate %" value={p.vat.ratePct} type="number" />
            <F
              name="proposalPrefix"
              label="Proposal number prefix"
              value={p.proposal_prefix}
            />
            <F
              name="invoicePrefix"
              label="Invoice number prefix"
              value={p.invoice_prefix}
            />
          </div>
        </Panel>
        <Panel label="3" title="Default terms">
          <textarea
            name="defaultTerms"
            className="k-textarea"
            rows={8}
            defaultValue={p.default_terms ?? ""}
          />
          <p
            className="mt-2"
            style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}
          >
            Pre-filled on every new proposal; edit per proposal as needed. Not legal
            advice.
          </p>
        </Panel>
        <div>
          <button type="submit" className="kb kb-primary">
            Save
            <span className="k-arrow" aria-hidden>
              →
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
