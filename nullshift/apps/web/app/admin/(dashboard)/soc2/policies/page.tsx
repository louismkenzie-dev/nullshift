import Link from "next/link";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { POLICY_STATUS_TONE } from "@/lib/soc2/ui";
import { EmptyRow, HeaderRow, faintMono, shortDate } from "../shared";

/**
 * Policy register — every policy the programme maintains: who owns it, whether
 * its current text has been approved by a named human, when it is next due for
 * review, and how far staff acknowledgement of the approved text has got.
 * Seeded drafts are templates that REQUIRE human review before approval — the
 * system never approves a policy. Rows open the policy's detail page
 * (versions, approval trail, acknowledgements).
 */

export const dynamic = "force-dynamic";

type PolicyRow = {
  id: string;
  key: string;
  title: string;
  owner_email: string | null;
  approver_email: string | null;
  status: "draft" | "in_review" | "approved" | "retired";
  current_version: number;
  effective_date: string | null;
  review_due_at: string | null;
  requires_acknowledgement: boolean;
  acknowledgement_audience: string;
  legal_review_required: boolean;
};

type VersionRow = {
  id: string;
  policy_id: string;
  version: number;
  status: "draft" | "approved" | "superseded";
};

type AckRow = { id: string; policy_version_id: string };

const GRID = "1.6fr 110px 1.1fr 60px 110px 120px 150px";

export default async function Soc2PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const err = sp.err || null;

  const supabase = await createClient();
  const [{ data: policyRows }, { data: versionRows }, { data: ackRows }] =
    await Promise.all([
      supabase
        .from("soc2_policies")
        .select(
          "id, key, title, owner_email, approver_email, status, current_version, effective_date, review_due_at, requires_acknowledgement, acknowledgement_audience, legal_review_required"
        )
        .order("title"),
      supabase.from("soc2_policy_versions").select("id, policy_id, version, status"),
      supabase.from("soc2_policy_acknowledgements").select("id, policy_version_id"),
    ]);
  const policies = (policyRows ?? []) as PolicyRow[];
  const versions = (versionRows ?? []) as VersionRow[];
  const acks = (ackRows ?? []) as AckRow[];

  const today = new Date().toISOString().slice(0, 10);

  // Ack coverage counts against the CURRENT APPROVED version only — a draft's
  // acknowledgements would be meaningless.
  const ackCountByPolicy = new Map<string, number>();
  for (const p of policies) {
    const current = versions.find(
      (v) => v.policy_id === p.id && v.version === p.current_version && v.status === "approved"
    );
    if (current) {
      ackCountByPolicy.set(
        p.id,
        acks.filter((a) => a.policy_version_id === current.id).length
      );
    }
  }

  const approvedCount = policies.filter((p) => p.status === "approved").length;
  const awaitingReview = policies.filter(
    (p) => p.status === "draft" || p.status === "in_review"
  ).length;
  const reviewOverdue = policies.filter(
    (p) => p.status !== "retired" && p.review_due_at !== null && p.review_due_at < today
  ).length;
  const unowned = policies.filter(
    (p) => p.status !== "retired" && !p.owner_email
  ).length;

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Policy register"
        lead="Every policy's owner, approval state and review date. Seeded drafts are templates that require human review before approval — the system never approves a policy."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.04em",
            color: T.danger,
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          {err}
        </p>
      )}

      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 28 }}>
          <StatCard
            value={String(approvedCount)}
            label="Approved"
            sub="Current text approved by a named human."
          />
          <StatCard
            value={String(awaitingReview)}
            label="Requires review"
            sub="Draft or in-review text awaiting a named approver."
          />
          <StatCard
            value={String(reviewOverdue)}
            label="Review overdue"
            sub="Past their scheduled review date."
          />
          <StatCard
            value={String(unowned)}
            label="Unowned"
            sub="No owner recorded — a standing flag."
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div style={{ marginTop: 22 }}>
          <Panel label="// POLICY REGISTER" pad={false}>
            <HeaderRow
              grid={GRID}
              cols={["Policy", "Status", "Owner", "Ver", "Effective", "Review due", "Ack / legal"]}
            />
            {policies.length === 0 && (
              <EmptyRow>
                The policy register is empty. Seed the programme&apos;s policy templates from{" "}
                <Link href="/admin/soc2/settings" style={{ color: "var(--k-accent)" }}>
                  Settings → Seed programme
                </Link>
                .
              </EmptyRow>
            )}
            {policies.map((p, i) => {
              const overdue = p.review_due_at !== null && p.review_due_at < today;
              const ackCount = ackCountByPolicy.get(p.id);
              return (
                <Link
                  key={p.id}
                  href={`/admin/soc2/policies/${p.key}`}
                  className="grid md:grid gap-3 items-center px-4 py-2.5"
                  style={{
                    gridTemplateColumns: GRID,
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span
                      style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-fg)" }}
                    >
                      {p.title}
                    </span>
                    <span style={faintMono}>{p.key}</span>
                  </span>
                  <span>
                    <StatusChip tone={POLICY_STATUS_TONE[p.status] ?? "muted"}>
                      {p.status.replace(/_/g, " ")}
                    </StatusChip>
                  </span>
                  {p.owner_email ? (
                    <span
                      className="min-w-0 truncate"
                      style={{ fontFamily: T.mono, fontSize: "0.72rem", color: "var(--k-muted)" }}
                    >
                      {p.owner_email}
                    </span>
                  ) : (
                    <span>
                      <StatusChip tone="warning">unowned</StatusChip>
                    </span>
                  )}
                  <span style={{ fontFamily: T.mono, fontSize: "0.75rem", color: "var(--k-fg)" }}>
                    v{p.current_version}
                  </span>
                  <span style={faintMono}>{shortDate(p.effective_date)}</span>
                  <span style={{ ...faintMono, color: overdue ? T.danger : undefined }}>
                    {shortDate(p.review_due_at)}
                    {overdue ? " · overdue" : ""}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {p.legal_review_required && (
                      <StatusChip tone="warning">legal review</StatusChip>
                    )}
                    {p.requires_acknowledgement ? (
                      ackCount !== undefined ? (
                        <span style={faintMono}>{ackCount} acks</span>
                      ) : (
                        <span style={faintMono}>no approved version</span>
                      )
                    ) : (
                      !p.legal_review_required && <span style={faintMono}>—</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
