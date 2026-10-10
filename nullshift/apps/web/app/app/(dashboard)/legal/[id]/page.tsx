import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { getSite, siteUrl } from "@/lib/legal-docs/data";
import { factsProblems, type LegalFacts } from "@/lib/legal-docs/facts";
import { DOC_TITLE, enabledDocs } from "@/lib/legal-docs/generate";
import { deleteSiteAction, saveSiteAction } from "../actions";

export const dynamic = "force-dynamic";

function Check({
  name,
  label,
  checked,
  help,
}: {
  name: keyof LegalFacts;
  label: string;
  checked: boolean;
  help?: string;
}) {
  return (
    <label
      className="flex items-start gap-3"
      style={{ fontFamily: T.sans, color: "var(--k-fg)", fontSize: "0.95rem" }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        style={{ marginTop: 4 }}
      />
      <span>
        {label}
        {help && (
          <span
            style={{ display: "block", color: "var(--k-muted)", fontSize: "0.82rem" }}
          >
            {help}
          </span>
        )}
      </span>
    </label>
  );
}
function Field({
  name,
  label,
  value,
  type = "text",
  placeholder,
  help,
}: {
  name: keyof LegalFacts;
  label: string;
  value: string | number;
  type?: string;
  placeholder?: string;
  help?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="k-label">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        className="k-input"
        placeholder={placeholder}
      />
      {help && (
        <span style={{ fontFamily: T.sans, color: "var(--k-faint)", fontSize: "0.8rem" }}>
          {help}
        </span>
      )}
    </label>
  );
}

export default async function LegalSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, entitlement } = await requireProduct("legal", `/app/legal/${id}`);
  if (!entitlement.entitled)
    return <ProductGate product="legal" entitlement={entitlement} />;
  const site = await getSite(workspace.tenantId, id);
  if (!site) notFound();
  const f = site.facts;
  const problems = factsProblems(f);
  const docs = enabledDocs(f);
  const base = siteUrl();

  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="legal" />
      <PageHeader
        index="02"
        label="Nullshift Legal"
        title={f.tradingName || f.legalName || "Your website"}
        lead="Plain questions. Tick what applies. The documents update the moment you save."
        actions={
          <Link href="/app/legal" className="kb kb-outline">
            All websites
          </Link>
        }
      />

      {sp.saved && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>
            {sp.saved === "changed"
              ? `Saved — documents regenerated as version ${site.version}.`
              : "Saved. Nothing in the documents changed."}
          </p>
        </Panel>
      )}
      {sp.error && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.danger }}>{sp.error}</p>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={saveSiteAction} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={site.id} />

          <Panel label="1" title="Who you are">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="legalName"
                label="Legal name"
                value={f.legalName}
                placeholder="Acme Plumbing Ltd"
              />
              <Field
                name="tradingName"
                label="Trading name (if different)"
                value={f.tradingName}
              />
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Legal form</span>
                <select name="legalForm" defaultValue={f.legalForm} className="k-select">
                  <option value="limited_company">Limited company</option>
                  <option value="sole_trader">Sole trader</option>
                  <option value="partnership">Partnership</option>
                  <option value="llp">LLP</option>
                  <option value="charity">Charity</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <Field
                name="companyNumber"
                label="Company number"
                value={f.companyNumber}
                help="Companies House number, if a company or LLP"
              />
              <div className="sm:col-span-2">
                <Field
                  name="registeredAddress"
                  label="Registered or trading address"
                  value={f.registeredAddress}
                />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Where you are based</span>
                <select
                  name="jurisdiction"
                  defaultValue={f.jurisdiction}
                  className="k-select"
                >
                  <option value="england_wales">England and Wales</option>
                  <option value="scotland">Scotland</option>
                  <option value="northern_ireland">Northern Ireland</option>
                </select>
              </label>
              <Field name="websiteUrl" label="Website address" value={f.websiteUrl} />
              <Field
                name="contactEmail"
                label="Contact email for privacy questions"
                value={f.contactEmail}
                type="email"
              />
              <Field
                name="contactPhone"
                label="Phone (optional)"
                value={f.contactPhone}
              />
              <Field
                name="icoRegistration"
                label="ICO registration number"
                value={f.icoRegistration}
                help="Most businesses handling personal data must register with the ICO (from £40 a year)."
              />
              <Field name="vatNumber" label="VAT number (optional)" value={f.vatNumber} />
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="k-label">One sentence on what the business does</span>
                <input
                  name="describeBusiness"
                  defaultValue={f.describeBusiness}
                  className="k-input"
                  placeholder="We are a family plumbing firm covering Norwich and Norfolk."
                  maxLength={300}
                />
              </label>
            </div>
          </Panel>

          <Panel label="2" title="What the website does">
            <div className="grid gap-4">
              <Check
                name="contactForms"
                label="Has a contact or enquiry form"
                checked={f.contactForms}
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-start">
                <Check
                  name="newsletter"
                  label="Collects email addresses for a newsletter"
                  checked={f.newsletter}
                />
                <input
                  name="newsletterTool"
                  defaultValue={f.newsletterTool}
                  className="k-input"
                  placeholder="Tool, e.g. Mailchimp"
                />
              </div>
              <Check
                name="userAccounts"
                label="Visitors can create an account or log in"
                checked={f.userAccounts}
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-start">
                <Check
                  name="onlineBookings"
                  label="Takes online bookings or appointments"
                  checked={f.onlineBookings}
                />
                <input
                  name="bookingTool"
                  defaultValue={f.bookingTool}
                  className="k-input"
                  placeholder="Tool, e.g. Calendly, Fresha"
                />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Online payments</span>
                <select
                  name="onlinePayments"
                  defaultValue={f.onlinePayments}
                  className="k-select"
                >
                  <option value="none">None</option>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="square">Square</option>
                  <option value="gocardless">GoCardless</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <Check
                name="sellsGoods"
                label="Sells physical goods for delivery"
                checked={f.sellsGoods}
              />
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Analytics</span>
                <select name="analytics" defaultValue={f.analytics} className="k-select">
                  <option value="none">None</option>
                  <option value="ga4">Google Analytics</option>
                  <option value="plausible">Plausible</option>
                  <option value="fathom">Fathom</option>
                  <option value="matomo">Matomo</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-start">
                <Check
                  name="marketingCookies"
                  label="Uses advertising pixels (Meta, Google Ads, TikTok…)"
                  checked={f.marketingCookies}
                />
                <input
                  name="marketingTools"
                  defaultValue={f.marketingTools}
                  className="k-input"
                  placeholder="Which ones"
                />
              </div>
              <Check
                name="embeddedMedia"
                label="Embeds YouTube / Vimeo videos or Google Maps"
                checked={f.embeddedMedia}
              />
              <div className="grid gap-3 sm:grid-cols-[1fr_260px] sm:items-start">
                <Check
                  name="liveChat"
                  label="Has a live chat widget"
                  checked={f.liveChat}
                />
                <input
                  name="liveChatTool"
                  defaultValue={f.liveChatTool}
                  className="k-input"
                  placeholder="Tool, e.g. Tawk, Intercom"
                />
              </div>
              <Field
                name="hosting"
                label="Who hosts the website (optional)"
                value={f.hosting}
                placeholder="e.g. Wix, Squarespace, WordPress on SiteGround"
              />
              <label className="flex flex-col gap-1.5">
                <span className="k-label">
                  Any other tools that see customer data (one per line)
                </span>
                <textarea
                  name="otherProcessors"
                  defaultValue={f.otherProcessors}
                  className="k-textarea"
                  rows={3}
                  placeholder="Xero — invoicing&#10;Jobber — job management"
                />
              </label>
            </div>
          </Panel>

          <Panel label="3" title="A few more things">
            <div className="grid gap-4">
              <Check
                name="under18s"
                label="Some customers or users are under 18"
                checked={f.under18s}
              />
              <Check
                name="healthData"
                label="You collect health information"
                checked={f.healthData}
                help="Clinics, therapists, personal trainers. We add a flagged clause a solicitor must confirm."
              />
              <Check
                name="internationalTransfers"
                label="You knowingly send customer data outside the UK"
                checked={f.internationalTransfers}
                help="Tick if unsure and you use US tools like Google or Meta."
              />
              <Check name="cctv" label="You run CCTV at your premises" checked={f.cctv} />
              <Field
                name="retentionMonths"
                label="How many months you keep customer records after last contact"
                value={f.retentionMonths}
                type="number"
                help="24 is a sensible default; tax records are kept six years regardless."
              />
            </div>
          </Panel>

          <Panel label="4" title="Publish">
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-6">
                <Check
                  name="includePrivacy"
                  label="Privacy Notice"
                  checked={f.includePrivacy}
                />
                <Check
                  name="includeCookies"
                  label="Cookie Policy"
                  checked={f.includeCookies}
                />
                <Check
                  name="includeTerms"
                  label="Website Terms"
                  checked={f.includeTerms}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Web address</span>
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.75rem",
                        color: "var(--k-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {base}/l/
                    </span>
                    <input
                      name="slug"
                      defaultValue={site.slug}
                      className="k-input"
                      pattern="[a-z0-9][a-z0-9-]{1,47}"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Accent colour</span>
                  <input
                    name="colour"
                    type="color"
                    defaultValue={site.brand.colour}
                    className="k-input"
                    style={{ padding: 4 }}
                  />
                </label>
              </div>
              <label
                className="flex items-center gap-3"
                style={{ fontFamily: T.sans, color: "var(--k-fg)" }}
              >
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={site.published}
                  disabled={problems.length > 0 && !site.published}
                />
                Published — the hosted pages are live
              </label>
              {problems.length > 0 && (
                <div
                  style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.warning }}
                >
                  Before publishing: {problems.join("; ")}.
                </div>
              )}
            </div>
          </Panel>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="kb kb-primary">
              Save and regenerate
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Panel
            label="Your documents"
            actions={
              <StatusChip tone={site.published ? "success" : "muted"}>
                {site.published ? `v${site.version} live` : "not published"}
              </StatusChip>
            }
          >
            <ul
              className="flex flex-col gap-3"
              style={{ listStyle: "none", padding: 0, margin: 0 }}
            >
              {docs.map((k) => (
                <li
                  key={k}
                  className="flex flex-wrap items-center justify-between gap-2"
                  style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
                >
                  {DOC_TITLE[k]}
                  <span className="flex gap-3">
                    {site.published ? (
                      <>
                        <a
                          href={`/l/${site.slug}/${k}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--k-accent)" }}
                        >
                          View
                        </a>
                        <a
                          href={`/l/${site.slug}/${k}/download`}
                          style={{ color: "var(--k-muted)" }}
                        >
                          HTML
                        </a>
                      </>
                    ) : (
                      <span style={{ color: "var(--k-faint)" }}>publish to view</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {site.published && (
              <p
                className="mt-4"
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.82rem",
                  color: "var(--k-muted)",
                  lineHeight: 1.6,
                }}
              >
                Put this in your website footer:{" "}
                <code style={{ fontFamily: T.mono, color: "var(--k-fg)" }}>
                  {base}/l/{site.slug}
                </code>
              </p>
            )}
          </Panel>
          <Panel label="Changelog">
            <ul
              className="flex flex-col gap-2"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontFamily: T.sans,
                fontSize: "0.82rem",
                color: "var(--k-muted)",
              }}
            >
              {site.history.slice(0, 8).map((h) => (
                <li key={`${h.version}-${h.at}`}>
                  <strong style={{ color: "var(--k-fg)" }}>v{h.version}</strong> ·{" "}
                  {new Date(h.at).toLocaleDateString("en-GB")} · {h.note}
                </li>
              ))}
            </ul>
          </Panel>
          <form action={deleteSiteAction}>
            <input type="hidden" name="id" value={site.id} />
            <button
              type="submit"
              className="kb kb-outline kb-sm"
              style={{ color: T.danger, borderColor: T.danger }}
            >
              Delete this website
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
