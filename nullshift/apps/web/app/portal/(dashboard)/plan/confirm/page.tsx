import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalClient } from "@/lib/clientPreview";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { contractedPrices } from "@/lib/pricing/contracted";
import { planChoiceOpen } from "@/lib/planGate";
import {
  CARE_PLAN_TERMS_POINTS,
  CARE_PLAN_TERMS_STATEMENT,
  CARE_PLAN_TERMS_URL,
  CARE_PLAN_TERMS_VERSION,
} from "@/lib/carePlanTerms";
import { PageHeader, Panel } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";
import { PendingBeacon } from "@/components/app/PendingBeacon";
import { choosePlan } from "../actions";

/**
 * Confirm step — the client reads the care-plan terms and agrees to them
 * before the Direct Debit is started. The plan and the price they saw travel
 * through hidden fields and are re-verified by choosePlan; the agreement is
 * stored on their tenant and on the subscription with the version and time.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

export default async function ConfirmPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; terms?: string }>;
}) {
  const { plan: planId, terms } = await searchParams;
  const plan = carePlan(planId);
  if (!plan || plan.quotedOnly) redirect("/portal/plan");

  const { supabase } = await getPortalClient();
  const [{ data: tenants }, { data: projects }] = await Promise.all([
    supabase.from("tenants").select("id, name").limit(1),
    supabase
      .from("projects")
      .select("stage")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const tenant = tenants?.[0] as { id: string; name: string } | undefined;
  if (!tenant) redirect("/portal/plan");
  if (!planChoiceOpen((projects?.[0] as { stage?: string } | undefined)?.stage))
    redirect("/portal/plan?gate=closed");

  const pricing = await contractedPrices(tenant.id);
  const price = pricing.prices[plan.id];
  if (!price?.priced || price.mrr === null) redirect("/portal/plan");

  return (
    <div
      className="px-4 sm:px-6"
      style={{ maxWidth: 720, margin: "0 auto", paddingTop: 28, paddingBottom: 56 }}
    >
      <PageHeader
        index="06"
        label="YOUR PLAN"
        title={`Confirm your ${plan.label} plan`}
        lead="Read the terms, agree, and set up your Direct Debit. Nothing is collected until the mandate is confirmed."
        actions={
          <Link
            href="/portal/plan"
            className="kb kb-outline kb-sm"
            style={{ textDecoration: "none" }}
          >
            ← Back to options
          </Link>
        }
      />

      <div style={{ marginTop: 24 }}>
        <Reveal>
          <Panel label="// WHAT YOU'RE CHOOSING">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span
                style={{
                  fontFamily: T.sans,
                  fontWeight: 700,
                  fontSize: "1.3rem",
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                {plan.label}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontWeight: 700,
                  fontSize: "1.2rem",
                  color: "var(--k-fg)",
                }}
              >
                {gbp(price.mrr)}
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    color: "var(--k-muted)",
                  }}
                >
                  {" "}
                  / month by Direct Debit
                </span>
              </span>
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.86rem",
                color: "var(--k-muted)",
                marginTop: 8,
              }}
            >
              {plan.blurb}
            </p>
            <ul className="flex flex-col gap-1" style={{ marginTop: 12 }}>
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.7rem",
                      color: "var(--k-accent)",
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.8rem",
                      color: "var(--k-fg)",
                      lineHeight: 1.45,
                    }}
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </div>

      <div style={{ marginTop: 20 }}>
        <Reveal>
          <Panel label="// THE TERMS" title="Care plan terms">
            <ol className="flex flex-col gap-2" style={{ paddingLeft: 18, margin: 0 }}>
              {CARE_PLAN_TERMS_POINTS.map((pt) => (
                <li
                  key={pt}
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.86rem",
                    color: "var(--k-fg)",
                    lineHeight: 1.6,
                  }}
                >
                  {pt}
                </li>
              ))}
            </ol>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: "var(--k-muted)",
                marginTop: 12,
              }}
            >
              Full terms:{" "}
              <a
                href={CARE_PLAN_TERMS_URL}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--k-accent)" }}
              >
                Client services framework ↗
              </a>{" "}
              · version {CARE_PLAN_TERMS_VERSION}
            </p>

            {terms === "required" && (
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.86rem",
                  color: T.warning,
                  marginTop: 14,
                }}
              >
                Please tick the box to agree the terms before continuing.
              </p>
            )}

            <form
              action={choosePlan}
              className="flex flex-col gap-4"
              style={{ marginTop: 18 }}
            >
              <PendingBeacon />
              <input type="hidden" name="plan" value={plan.id} />
              {/* The figure shown, echoed back so the server refuses to charge anything else. */}
              <input
                type="hidden"
                name="quoted_pence"
                value={Math.round(price.mrr * 100)}
              />
              <input type="hidden" name="terms_version" value={CARE_PLAN_TERMS_VERSION} />
              <label className="flex items-start gap-3" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="terms_accepted"
                  required
                  style={{ marginTop: 4 }}
                />
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.88rem",
                    color: "var(--k-fg)",
                    lineHeight: 1.55,
                  }}
                >
                  {CARE_PLAN_TERMS_STATEMENT}
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="kb kb-primary kb-sm">
                  Agree and set up Direct Debit
                  <span className="k-arrow" aria-hidden>
                    →
                  </span>
                </button>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.62rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--k-faint)",
                  }}
                >
                  Next: GoCardless secure mandate page
                </span>
              </div>
            </form>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
