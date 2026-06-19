import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { StageStepper } from "@/components/portal/StageStepper";

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

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 16px 56px" }}>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.7rem",
          color: T.fg,
          marginBottom: 4,
        }}
      >
        Your projects
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          marginBottom: 20,
        }}
      >
        Tap a project to see its status, updates, tasks and documents.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 20 }}>
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: T.r.lg,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            Invested
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.5rem",
              color: T.fg,
              marginTop: 4,
            }}
          >
            {gbp(invested)}
          </div>
          {outstanding > 0 && (
            <div
              style={{ fontFamily: T.mono, fontSize: 11, color: T.warning, marginTop: 2 }}
            >
              {gbp(outstanding)} outstanding
            </div>
          )}
        </div>
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: T.r.lg,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.muted,
            }}
          >
            Care plan
          </div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.2rem",
              color: plan ? T.fg : T.faint,
              marginTop: 4,
            }}
          >
            {plan ? plan.label : "None yet"}
          </div>
          {plan && (
            <div
              style={{ fontFamily: T.mono, fontSize: 11, color: T.primary, marginTop: 2 }}
            >
              {gbp(plan.mrr)}/mo
            </div>
          )}
        </div>
      </div>

      {/* Project cards */}
      {projectList.length === 0 ? (
        <p style={{ fontFamily: T.sans, fontSize: "0.92rem", color: T.muted }}>
          Your project is being set up — it'll appear here shortly.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {projectList.map((p) => (
            <Link
              key={p.id}
              href={`/portal/project/${p.id}`}
              className="block hover:opacity-95 transition-opacity"
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
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
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: "1.1rem",
                    color: T.fg,
                  }}
                >
                  {p.name}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.primary }}>
                  Open →
                </span>
              </div>
              <StageStepper stage={p.stage} />
              {p.live_url && (
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: T.primary,
                    marginTop: 12,
                  }}
                >
                  ● Live site available
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
