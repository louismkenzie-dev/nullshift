import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { PlanQuestionnaire } from "@/components/plan-embed/PlanQuestionnaire";
import { requireProduct } from "@/lib/products/session";
import { getEmbed } from "@/lib/plan-embed/data";
import { deleteEmbedAction, saveEmbedAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EmbedEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, entitlement } = await requireProduct("plans", `/app/plans/${id}`);
  if (!entitlement.entitled)
    return <ProductGate product="plans" entitlement={entitlement} />;
  const e = await getEmbed(workspace.tenantId, id);
  if (!e) notFound();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  const embed = `<script src="${site}/plan.js" data-nullshift-plan="${e.public_key}" async></script>`;
  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="plans" />
      <PageHeader
        index="04"
        label="Nullshift Plans"
        title={e.name}
        lead="The plan is written as you. Tell it who you are and what you sell; it recommends from that list and nothing else."
        actions={
          <Link href="/app/plans" className="kb kb-outline">
            All generators
          </Link>
        }
      />
      {sp.saved && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>Saved.</p>
        </Panel>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <form action={saveEmbedAction} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={e.id} />
          <Panel label="1" title="Your brand">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Brand name</span>
                <input
                  name="brandName"
                  className="k-input"
                  defaultValue={e.brand.name}
                  maxLength={80}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Tagline (optional)</span>
                <input
                  name="tagline"
                  className="k-input"
                  defaultValue={e.brand.tagline ?? ""}
                  maxLength={120}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Website</span>
                <input
                  name="website"
                  className="k-input"
                  defaultValue={e.brand.website ?? ""}
                  placeholder="www.yourstudio.co.uk"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Logo URL (https, optional)</span>
                <input
                  name="logoUrl"
                  className="k-input"
                  defaultValue={e.brand.logoUrl ?? ""}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Accent colour</span>
                <input
                  name="colour"
                  type="color"
                  className="k-input"
                  defaultValue={e.brand.colour}
                  style={{ padding: 4 }}
                />
              </label>
              <label
                className="flex items-center gap-2 self-end"
                style={{ fontFamily: T.sans, color: "var(--k-fg)" }}
              >
                <input type="checkbox" name="dark" defaultChecked={e.brand.dark} /> Dark
                form
              </label>
            </div>
          </Panel>
          <Panel label="2" title="What you sell">
            <div className="grid gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="k-label">
                  Services, one per line (the plan only recommends these)
                </span>
                <textarea
                  name="services"
                  className="k-textarea"
                  rows={6}
                  defaultValue={e.brand.services.join("\n")}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Voice (optional)</span>
                <input
                  name="tone"
                  className="k-input"
                  defaultValue={e.brand.tone ?? ""}
                  placeholder="e.g. friendly, a bit blunt, no buzzwords"
                  maxLength={240}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Opening line on the form (optional)</span>
                <input
                  name="intro"
                  className="k-input"
                  defaultValue={e.intro ?? ""}
                  maxLength={300}
                />
              </label>
            </div>
          </Panel>
          <Panel label="3" title="Embed and settings">
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <span className="k-label">Paste on your website</span>
                <pre
                  className="k-kard"
                  style={{
                    background: "var(--k-bg)",
                    padding: 14,
                    fontFamily: T.mono,
                    fontSize: "0.78rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    color: "var(--k-fg)",
                  }}
                >
                  {embed}
                </pre>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    color: "var(--k-muted)",
                  }}
                >
                  Or share the hosted link:{" "}
                  <a
                    href={`${site}/p/${e.public_key}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--k-accent)" }}
                  >
                    {site}/p/{e.public_key}
                  </a>
                </p>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Name (only you see this)</span>
                <input
                  name="name"
                  className="k-input"
                  defaultValue={e.name}
                  maxLength={120}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="k-label">Email new leads and plans to</span>
                <input
                  name="notifyEmail"
                  type="email"
                  className="k-input"
                  defaultValue={e.notify_email ?? ""}
                />
              </label>
              <div
                className="flex flex-wrap gap-6"
                style={{ fontFamily: T.sans, color: "var(--k-fg)", fontSize: "0.9rem" }}
              >
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="active" defaultChecked={e.active} /> Live
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="hidePoweredBy"
                    defaultChecked={e.hide_powered_by}
                    disabled={entitlement.trialing}
                  />{" "}
                  Hide “Powered by Nullshift”{entitlement.trialing ? " (paid plans)" : ""}
                </label>
              </div>
            </div>
          </Panel>
          <div className="flex gap-3">
            <button type="submit" className="kb kb-primary">
              Save
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </button>
          </div>
        </form>
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <span className="k-label">Preview (does not create a lead)</span>
          <PlanQuestionnaire
            brand={e.brand}
            intro={e.intro}
            publicKey={e.public_key}
            poweredBy={entitlement.trialing || !e.hide_powered_by}
            preview
          />
          <form action={deleteEmbedAction}>
            <input type="hidden" name="id" value={e.id} />
            <button
              type="submit"
              className="kb kb-outline kb-sm"
              style={{ color: T.danger, borderColor: T.danger }}
            >
              Delete generator (leads are kept)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
