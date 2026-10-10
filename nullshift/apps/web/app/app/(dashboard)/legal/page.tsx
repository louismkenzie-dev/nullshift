import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRODUCTS } from "@nullshift/content/products";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { listSites } from "@/lib/legal-docs/data";
import { factsProblems } from "@/lib/legal-docs/facts";
import { createSiteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LegalHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const { workspace, email, entitlement } = await requireProduct("legal");
  if (!entitlement.entitled)
    return <ProductGate product="legal" entitlement={entitlement} />;
  const sites = await listSites(workspace.tenantId);
  const p = PRODUCTS.legal;
  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="legal" />
      <PageHeader
        index={p.index}
        label={p.title}
        title="Your legal pages"
        lead="Answer a short form about your business and website. We generate a Privacy Notice, Cookie Policy and Website Terms, host them at a link you can put in your footer, and keep them current."
      />
      {sp.error === "limit" && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.warning }}>
            Your plan covers {p.limits.sites} websites.
          </p>
        </Panel>
      )}

      {sites.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {sites.map((s) => {
            const problems = factsProblems(s.facts);
            return (
              <Panel
                key={s.id}
                label={`/l/${s.slug}`}
                title={s.facts.tradingName || s.facts.legalName || "Untitled"}
                actions={
                  <StatusChip
                    tone={s.published ? "success" : problems.length ? "warning" : "muted"}
                  >
                    {s.published
                      ? "Published"
                      : problems.length
                        ? `${problems.length} to fill in`
                        : "Draft"}
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
                  Version {s.version} · {s.facts.websiteUrl || "no website yet"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/app/legal/${s.id}`} className="kb kb-primary kb-sm">
                    Edit answers
                  </Link>
                  {s.published && (
                    <a
                      href={`/l/${s.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="kb kb-outline kb-sm"
                    >
                      View hosted pages
                    </a>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {sites.length < p.limits.sites && (
        <Panel
          label={sites.length ? "Add another website" : "Start"}
          title="Which website is this for?"
        >
          <form action={createSiteAction} className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Business name</span>
              <input
                name="businessName"
                className="k-input"
                defaultValue={workspace.tenantName}
                required
                maxLength={120}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Website address</span>
              <input
                name="websiteUrl"
                className="k-input"
                placeholder="www.example.co.uk"
                required
                maxLength={200}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Contact email for data questions</span>
              <input
                name="contactEmail"
                type="email"
                className="k-input"
                defaultValue={email}
                required
              />
            </label>
            <div className="sm:col-span-3">
              <button type="submit" className="kb kb-primary">
                Continue to the form
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel label="Please note">
        <p
          style={{
            fontFamily: T.sans,
            color: "var(--k-muted)",
            lineHeight: 1.65,
            fontSize: "0.9rem",
          }}
        >
          These are template documents generated from your answers, written for UK GDPR
          and PECR. They are not legal advice. If you handle health or other sensitive
          data, work in a regulated sector, or trade mainly outside the UK, have a
          solicitor review them before publishing.
        </p>
      </Panel>
    </div>
  );
}
