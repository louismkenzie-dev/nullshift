import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { StageStepper } from "@/components/portal/StageStepper";
import { PageHeader, Panel, StatCard } from "@/components/app/AppKit";
import { Eyebrow, Display, Lead } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";

/**
 * Client portal home — project-centric. The client's project(s) are front and
 * centre as cards; tapping one opens the project hub. A small summary shows what
 * they've invested and their care plan. Mobile-first: everything stacks.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

type Project = {
  id: string;
  name: string;
  stage: string;
  proposal_status: string;
  live_url: string | null;
};

export default async function PortalHome() {
  const supabase = await createClient();
  const [{ data: projects }, { data: invoices }, { data: subs }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, stage, proposal_status, live_url")
      .order("created_at"),
    supabase.from("invoices").select("amount, status"),
    supabase.from("subscriptions").select("plan, mrr, status").eq("status", "active"),
  ]);
  const projectList = (projects ?? []) as Project[];
  const invList = (invoices ?? []) as { amount: number; status: string }[];
  const invested = invList
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = invList
    .filter((i) => i.status === "open")
    .reduce((s, i) => s + Number(i.amount), 0);
  const sub = (subs ?? [])[0] as { plan: string; mrr: number } | undefined;
  const plan = sub ? carePlan(sub.plan) : null;

  // A freshly-onboarded client (no proposal sent yet) sees a "check back after
  // your call" screen rather than an empty project — there's nothing to review
  // until we've had the call and prepared their proposal.
  const hasActiveProposal = projectList.some((p) => p.proposal_status !== "draft");
  if (!hasActiveProposal) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 20px" }}>
        <Reveal>
          <Panel className="k-kard-h">
            <div className="flex flex-col items-center text-center" style={{ gap: 14 }}>
              <Eyebrow index="00" label="YOU'RE ALL SET" align="center" />
              <Display as="h1" size="md">
                Thanks — we&apos;ve got your details
              </Display>
              <Lead style={{ marginInline: "auto" }}>
                We&apos;ll talk through your project on your call with one of our team,
                then prepare your proposal right here for you to review and sign.
              </Lead>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.72rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                  marginTop: 4,
                }}
              >
                Check back here after your call
              </span>
            </div>
          </Panel>
        </Reveal>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 16px 56px" }}>
      <PageHeader
        index="01"
        label="CLIENT PORTAL"
        title="Your projects"
        lead="Tap a project to see its status, updates, tasks and documents."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3" style={{ margin: "24px 0 20px" }}>
        <Reveal delay={0}>
          <StatCard
            value={gbp(invested)}
            label="Invested"
            sub={outstanding > 0 ? `${gbp(outstanding)} outstanding` : undefined}
          />
        </Reveal>
        <Reveal delay={0.05}>
          <StatCard
            value={plan ? plan.label : "None yet"}
            label="Care plan"
            sub={plan ? `${gbp(plan.mrr)}/mo` : undefined}
            accent={!!plan}
          />
        </Reveal>
      </div>

      {/* Project cards */}
      {projectList.length === 0 ? (
        <Reveal>
          <p style={{ fontFamily: T.sans, fontSize: "0.92rem", color: "var(--k-muted)" }}>
            Your project is being set up — it&apos;ll appear here shortly.
          </p>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-3">
          {projectList.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.05}>
              <Link
                href={`/portal/project/${p.id}`}
                className="k-kard k-kard-h block"
                style={{
                  background: "var(--k-surface)",
                  padding: "18px 20px",
                  textDecoration: "none",
                }}
              >
                <div
                  className="flex items-center justify-between gap-3"
                  style={{ marginBottom: 12 }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.68rem",
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    Open
                    <span className="k-arrow" aria-hidden>
                      →
                    </span>
                  </span>
                </div>
                <StageStepper stage={p.stage} />
                {p.live_url && (
                  <div
                    className="inline-flex items-center gap-2"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      fontWeight: 500,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                      marginTop: 12,
                    }}
                  >
                    <span className="k-livedot" aria-hidden />
                    Live site available
                  </div>
                )}
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
