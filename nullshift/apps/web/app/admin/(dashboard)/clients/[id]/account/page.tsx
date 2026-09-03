import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { findUserByEmail } from "@nullshift/auth/confirmation-email";
import { escapeLike } from "@nullshift/db/leads";
import { T } from "@nullshift/ui/tokens";
import { LONDON_TZ, clientRef } from "@nullshift/ui/format";
import { Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { DeliverySections } from "../DeliverySections";
import { TimelinePanel } from "../TimelinePanel";
import {
  addNote,
  bookCall,
  cancelCall,
  createPortalAccount,
  deleteClient,
  draftDiscoveryBriefAction,
  draftUpdateWithAi,
  postUpdate,
  saveMeeting,
  saveOwnership,
  sendPasswordReset,
  setLiveUrl,
  setStage,
} from "../actions";
import {
  Badge,
  STAGES,
  SignalChip,
  TIME_BUCKETS,
  TilePage,
  btn,
  card,
  h2,
  inp,
  loadTenantAndProjects,
  monoLink,
  type Call,
  type Note,
} from "../_shared";

/**
 * Account management tile — who owns this client and what happens next:
 * owners + next action, stage control (with the deposit / DPA gates and the
 * auto-score side effect), discovery evidence and the discovery call, lead
 * context, milestones / decision log / playbooks, the unified timeline,
 * internal notes, client-facing project updates, portal access, "View portal
 * as client", the compliance review centre, and the danger zone.
 */
export const dynamic = "force-dynamic";

export default async function ClientAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    stage_blocked?: string;
    draft_title?: string;
    draft_body?: string;
  }>;
}) {
  const { id: tenantId } = await params;
  const {
    stage_blocked: stageBlocked,
    draft_title: draftTitle,
    draft_body: draftBody,
  } = await searchParams;
  if (!(await requireStaff()).ok) notFound();
  const { tenant: t, project } = await loadTenantAndProjects(tenantId);
  const projectId = project?.id ?? null;
  const supabase = await createClient();

  const noRows = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [
    { data: call },
    { data: membership },
    { data: leadRows },
    { data: notes },
    { data: activityRows },
    { data: agentTaskRows },
  ] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id, call_date, call_time, duration_min, status, meeting_link, meeting_id, meeting_password"
      )
      .eq("tenant_id", tenantId)
      .eq("status", "confirmed")
      .order("call_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("id, user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "client_admin")
      .limit(1),
    t.contact_email
      ? supabase
          .from("leads")
          .select("quiz_answers, agent_enrichment, phone, lead_score, source")
          .ilike("email", escapeLike(t.contact_email))
          .order("created_at", { ascending: false })
          .limit(10)
      : noRows,
    projectId
      ? supabase
          .from("project_notes")
          .select("id, body, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : noRows,
    // This client's slice of the audit trail (Mission Control shows the
    // agency-wide last ten).
    supabase
      .from("audit_log")
      .select("id, action, target, metadata, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
    // AI Office work delegated in this client's context — read-only here,
    // the boards stay global.
    supabase
      .from("agent_tasks")
      .select("id, objective, status, priority, deadline, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const theCall = (call as Call) ?? null;
  type ActivityRow = {
    id: string;
    action: string;
    target: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };
  // One-line digest of an audit row's metadata jsonb: top-level scalars as
  // "key: value", arrays as a count, nested objects skipped (noise). Capped so
  // the row stays a single mono line.
  const summariseMetadata = (meta: Record<string, unknown> | null): string | null => {
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(meta)) {
      if (v === null || v === undefined || v === "") continue;
      let text: string;
      if (typeof v === "string") text = v;
      else if (typeof v === "number" || typeof v === "boolean") text = String(v);
      else if (Array.isArray(v)) text = `${v.length} item${v.length === 1 ? "" : "s"}`;
      else continue;
      if (text.length > 40) text = `${text.slice(0, 37)}…`;
      parts.push(`${k}: ${text}`);
      if (parts.length >= 4) break;
    }
    return parts.length ? parts.join(" · ") : null;
  };
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: LONDON_TZ,
    });
  type AgentTaskLite = {
    id: string;
    objective: string;
    status: string;
    priority: string;
    deadline: string | null;
    created_at: string;
  };
  const activity = (activityRows ?? []) as ActivityRow[];
  const agentTasks = (agentTaskRows ?? []) as AgentTaskLite[];
  const AGENT_TASK_TONE: Record<
    string,
    "success" | "warning" | "danger" | "muted" | "accent"
  > = {
    complete: "success",
    running: "accent",
    planning: "accent",
    queued: "muted",
    proposed: "muted",
    waiting_approval: "warning",
    awaiting_start_approval: "warning",
    waiting_info: "warning",
    waiting_external: "warning",
    quality_review: "warning",
    blocked: "danger",
    failed: "danger",
    cancelled: "muted",
  };
  const hasPortal = (membership ?? []).length > 0;
  // Whether this client has any email to confirm a deletion against. A portal
  // login always carries one; otherwise it's the contact email. With neither
  // (e.g. a client converted from an emailless funnel lead), the danger zone
  // shows a plain Delete button instead of the type-the-email gate.
  const hasEmail = Boolean(t.contact_email) || hasPortal;

  // Resolve the client's portal login state: their auth account (via the
  // membership, or by contact email if no membership yet) + whether they've
  // signed in. Drives the portal-access UI — the reference password is only ever
  // shown/issued when the client has NOT set their own (i.e. never signed in).
  const memberUserId =
    (membership as { user_id?: string | null }[] | null)?.[0]?.user_id ?? null;
  let portalUser: { email: string; lastSignInAt: string | null } | null = null;
  if (memberUserId || t.contact_email) {
    const portalSvc = createServiceClient();
    if (memberUserId) {
      const { data: u } = await portalSvc.auth.admin.getUserById(memberUserId);
      if (u.user)
        portalUser = {
          email: u.user.email ?? t.contact_email ?? "",
          lastSignInAt: u.user.last_sign_in_at ?? null,
        };
    } else if (t.contact_email) {
      const found = await findUserByEmail(portalSvc, t.contact_email);
      if (found)
        portalUser = {
          email: found.email ?? t.contact_email,
          lastSignInAt: found.last_sign_in_at ?? null,
        };
    }
  }
  const portalLoggedIn = !!portalUser?.lastSignInAt;
  const portalEmail = portalUser?.email ?? t.contact_email ?? "";

  // The client's preferred call slot, carried over from the lead they created
  // when they booked (stored on quiz_answers.requested_date/_time). Used to
  // prefill + annotate the call booking below — we still confirm the exact time.
  type LeadRow = {
    quiz_answers: unknown;
    agent_enrichment: unknown;
    phone: string | null;
    lead_score: number | null;
    source: string | null;
  };
  const leadList = (leadRows ?? []) as LeadRow[];
  let preferredDate: string | null = null;
  let preferredTime: string | null = null;
  for (const lr of leadList) {
    const qa = (lr.quiz_answers ?? {}) as Record<string, unknown>;
    if (typeof qa.requested_date === "string" && qa.requested_date) {
      preferredDate = qa.requested_date;
      preferredTime = typeof qa.requested_time === "string" ? qa.requested_time : null;
      break;
    }
  }

  // Discovery evidence carried from the funnel + AI consultation: the answers
  // the prospect gave and what the research agent concluded — so the proposal
  // is built from what they actually said, not memory.
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const funnelLead = leadList.find((l) => {
    const qa = (l.quiz_answers ?? {}) as Record<string, unknown>;
    return !!(qa.answers && typeof qa.answers === "object");
  });
  const funnelAnswers = (
    (funnelLead?.quiz_answers ?? {}) as { answers?: Record<string, unknown> }
  ).answers as Record<string, unknown> | undefined;
  const enrichment = leadList
    .map((l) => l.agent_enrichment as Record<string, unknown> | null)
    .find((e) => e && typeof e === "object");
  const leadPhone = leadList.map((l) => l.phone).find((p) => !!p) ?? null;
  const discoveryFacts: [string, string][] = [];
  if (funnelAnswers) {
    for (const [key, label] of [
      ["industry", "Industry"],
      ["need", "What they want"],
      ["budget", "Budget"],
      ["timeline", "Timeline"],
      ["software_spend", "Current software spend"],
      ["admin_pain", "Biggest admin pain"],
      ["provider", "Current provider"],
      ["website_url", "Website"],
    ] as const) {
      const v = str(funnelAnswers[key]);
      if (v) discoveryFacts.push([label, v]);
    }
  }
  if (leadPhone) discoveryFacts.push(["Phone", leadPhone]);
  const enrichSummary = str(enrichment?.summary);
  const enrichDraftReply = str(enrichment?.draftReply);
  const enrichPains = Array.isArray(enrichment?.painPoints)
    ? (enrichment?.painPoints as unknown[]).filter(
        (p): p is string => typeof p === "string"
      )
    : [];
  const hasDiscovery = discoveryFacts.length > 0 || !!enrichSummary || !!enrichDraftReply;
  const noteList = (notes ?? []) as Note[];

  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;
  const hpid = projectId ? (
    <input type="hidden" name="project_id" value={projectId} />
  ) : null;

  const nextChip = project?.next_action ? (
    <StatusChip tone="accent">
      NEXT: {project.next_action}
      {project.next_action_owner ? ` — ${project.next_action_owner}` : ""}
    </StatusChip>
  ) : (
    <StatusChip tone="danger">No next action set</StatusChip>
  );

  return (
    <TilePage
      tenantId={tenantId}
      tenantName={t.name}
      index="06"
      label="Account management"
      title={
        <span className="inline-flex items-center flex-wrap gap-2.5">
          {t.name}
          <span
            title="Client reference"
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "none",
              color: "var(--k-muted)",
              background: "var(--k-surface)",
              border: "1px solid var(--k-border)",
              borderRadius: 0,
              padding: "3px 9px",
              verticalAlign: "middle",
            }}
          >
            {clientRef(tenantId)}
          </span>
        </span>
      }
      lead={
        [t.contact_name, t.contact_email, t.contact_phone, t.vertical]
          .filter(Boolean)
          .join(" · ") || "No contact details yet"
      }
      actions={
        <>
          {nextChip}
          {/* A plain <a>, not <Link>: a client-side navigation into the
              preview route followed its redirect as a SOFT navigation and
              reused the portal layout from the router cache — so the
              banner and header could show the previous client's name
              over the newly previewed client's data. A full document
              load starts the portal fresh. (And a link, not a form: it
              works without hydration and every refusal redirects
              somewhere that says why.) */}
          <a
            href={`/admin/clients/${tenantId}/preview`}
            title="Open this client's portal exactly as they see it — read-only"
            style={{
              ...btn("var(--k-surface)", "var(--k-accent)"),
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            View portal as client →
          </a>
          <Link
            href={`/admin/compliance/${tenantId}`}
            title="Compliance review centre — intake, escalation and the GDPR review pack"
            style={{
              ...btn("var(--k-surface)", "var(--k-fg)"),
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Compliance review →
          </Link>
        </>
      }
    >
      {/* Stage control — the lifecycle gate the whole block keys on */}
      {project && (
        <Reveal>
          <section style={card}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 style={{ ...h2, marginBottom: 0 }}>Stage</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge s={project.stage} />
                <Badge s={project.proposal_status} />
              </div>
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: "var(--k-faint)",
                margin: "6px 0 12px",
              }}
            >
              {project.name} · build needs a paid invoice (or a recorded override); live
              needs a logged DPA. Moving to live or care reads the system and drafts its
              scale assessment automatically.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <form action={setStage} className="flex items-center gap-1">
                {htid}
                {hpid}
                <select
                  name="stage"
                  defaultValue={project.stage}
                  style={{ ...inp, height: 28 }}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                  Set stage
                </SubmitButton>
              </form>
              {stageBlocked && (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10,
                    color: T.danger,
                    border: `1px solid color-mix(in oklab, ${T.danger} 32%, transparent)`,
                    padding: "3px 8px",
                  }}
                >
                  BLOCKED — can&apos;t set “{stageBlocked}”:
                  {stageBlocked === "live"
                    ? " the tenant DPA is not signed and logged."
                    : stageBlocked === "build"
                      ? " no paid invoice on this project yet."
                      : " the database refused the change."}
                </span>
              )}
              {stageBlocked === "build" && (
                <form action={setStage} className="flex items-center gap-1">
                  {htid}
                  {hpid}
                  <input type="hidden" name="stage" value="build" />
                  <input
                    name="override_reason"
                    required
                    placeholder="Reason to start build unpaid"
                    style={{ ...inp, height: 28, width: 220 }}
                  />
                  <SubmitButton style={btn("transparent", "var(--k-muted)")}>
                    Override
                  </SubmitButton>
                </form>
              )}
            </div>
          </section>
        </Reveal>
      )}

      {/* Ownership & next action — who holds this project, and what happens next */}
      {project && (
        <Reveal>
          <section style={card}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 style={h2}>Ownership &amp; next action</h2>
              {project.next_action ? (
                <SignalChip color="var(--k-accent)">
                  NEXT: {project.next_action}
                  {project.next_action_owner ? ` — ${project.next_action_owner}` : ""}
                </SignalChip>
              ) : (
                <SignalChip color={T.danger}>NO NEXT ACTION SET</SignalChip>
              )}
            </div>
            <form action={saveOwnership}>
              {htid}
              {hpid}
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  marginTop: 12,
                }}
              >
                {(
                  [
                    ["account_owner", "Account owner", project.account_owner],
                    ["delivery_owner", "Delivery owner", project.delivery_owner],
                    ["technical_owner", "Technical owner", project.technical_owner],
                    ["finance_owner", "Finance owner", project.finance_owner],
                  ] as const
                ).map(([name, label, value]) => (
                  <label key={name} className="flex flex-col gap-1">
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--k-faint)",
                      }}
                    >
                      {label}
                    </span>
                    <input
                      name={name}
                      defaultValue={value ?? ""}
                      placeholder="Name"
                      style={inp}
                    />
                  </label>
                ))}
              </div>
              <div className="flex items-end gap-2 flex-wrap" style={{ marginTop: 10 }}>
                <label className="flex flex-col gap-1" style={{ flex: "1 1 260px" }}>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-faint)",
                    }}
                  >
                    Next action
                  </span>
                  <input
                    name="next_action"
                    defaultValue={project.next_action ?? ""}
                    placeholder="e.g. Send proposal for sign-off"
                    style={inp}
                  />
                </label>
                <label className="flex flex-col gap-1" style={{ width: 170 }}>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-faint)",
                    }}
                  >
                    Owner
                  </span>
                  <input
                    name="next_action_owner"
                    defaultValue={project.next_action_owner ?? ""}
                    placeholder="Who"
                    style={inp}
                  />
                </label>
                <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                  Save
                </SubmitButton>
              </div>
            </form>
          </section>
        </Reveal>
      )}

      {!project && (
        <Reveal>
          <section style={card}>
            <h2 style={{ ...h2, marginBottom: 6 }}>Build project</h2>
            <p
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)" }}
            >
              No build project yet — ownership, stage, milestones and updates unlock once
              one exists.{" "}
              <Link href={`/admin/clients/${tenantId}/passport`} style={monoLink}>
                Start build project →
              </Link>
            </p>
          </section>
        </Reveal>
      )}

      {/* Discovery — what the prospect told the funnel + what the agent found */}
      {hasDiscovery && (
        <Reveal>
          <section style={card}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 style={h2}>Discovery</h2>
              {project && (
                <form action={draftDiscoveryBriefAction}>
                  {htid}
                  {hpid}
                  <SubmitButton
                    title="Drafts an internal discovery brief from the records below — saved as an internal note, never client-visible"
                    style={{ ...btn("transparent", "var(--k-accent)"), height: 26 }}
                  >
                    ✦ Draft brief
                  </SubmitButton>
                </form>
              )}
            </div>
            {discoveryFacts.length > 0 && (
              <div
                className="grid gap-x-5 gap-y-2"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  marginTop: 10,
                }}
              >
                {discoveryFacts.map(([label, value]) => (
                  <div key={label}>
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--k-faint)",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(enrichSummary || enrichPains.length > 0) && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid var(--k-border)",
                }}
              >
                <div
                  style={{
                    fontFamily: T.mono,
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-accent)",
                  }}
                >
                  Agent research — AI draft, verify before relying on it
                </div>
                {enrichSummary && (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      color: "var(--k-muted)",
                      marginTop: 6,
                    }}
                  >
                    {enrichSummary}
                  </p>
                )}
                {enrichPains.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
                    {enrichPains.slice(0, 6).map((p) => (
                      <span
                        key={p}
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          color: "var(--k-muted)",
                          border: "1px solid var(--k-border)",
                          padding: "2px 7px",
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {enrichDraftReply && (
              <details style={{ marginTop: 12 }}>
                <summary
                  style={{
                    fontFamily: T.mono,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                    cursor: "pointer",
                  }}
                >
                  Drafted first reply (AI — review before sending)
                </summary>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.86rem",
                    color: "var(--k-muted)",
                    whiteSpace: "pre-wrap",
                    marginTop: 8,
                  }}
                >
                  {enrichDraftReply}
                </p>
              </details>
            )}
          </section>
        </Reveal>
      )}

      {/* Book Call */}
      <Reveal>
        <section style={card}>
          <h2 style={h2}>Discovery / project call</h2>
          {theCall ? (
            <div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div
                  style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
                >
                  {new Date(theCall.call_date).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  <span
                    style={{
                      color: "var(--k-accent)",
                      fontFamily: T.mono,
                      fontSize: "0.82rem",
                    }}
                  >
                    {theCall.call_time} · {theCall.duration_min} min
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge s={theCall.status} />
                  <form action={cancelCall}>
                    {htid}
                    <input type="hidden" name="id" value={theCall.id} />
                    <SubmitButton style={btn("transparent", T.danger)}>
                      Cancel
                    </SubmitButton>
                  </form>
                </div>
              </div>
              {theCall.meeting_link && (
                <a
                  href={theCall.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    color: "var(--k-accent)",
                    textDecoration: "none",
                    display: "inline-block",
                    marginTop: 8,
                  }}
                >
                  Join meeting ↗
                </a>
              )}
              <form
                action={saveMeeting}
                className="flex items-center gap-2 flex-wrap"
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--k-border)",
                }}
              >
                {htid}
                <input type="hidden" name="id" value={theCall.id} />
                <input
                  name="meeting_link"
                  placeholder="Meeting link (Zoom/Meet)"
                  defaultValue={theCall.meeting_link ?? ""}
                  style={{ ...inp, flex: "1 1 240px" }}
                />
                <input
                  name="meeting_id"
                  placeholder="Meeting ID"
                  defaultValue={theCall.meeting_id ?? ""}
                  style={{ ...inp, width: 130 }}
                />
                <input
                  name="meeting_password"
                  placeholder="Passcode"
                  defaultValue={theCall.meeting_password ?? ""}
                  style={{ ...inp, width: 110 }}
                />
                <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                  Save meeting
                </SubmitButton>
              </form>
            </div>
          ) : (
            <>
              {preferredDate && (
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.85rem",
                    color: "var(--k-muted)",
                    lineHeight: 1.5,
                    marginBottom: 12,
                  }}
                >
                  Client&apos;s preferred slot:{" "}
                  <b style={{ color: "var(--k-fg)" }}>
                    {new Date(preferredDate).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </b>
                  {preferredTime
                    ? ` · ${TIME_BUCKETS[preferredTime]?.label ?? preferredTime}`
                    : ""}
                  . Reach out to confirm the exact date &amp; time, then set it below.
                </p>
              )}
              <form action={bookCall} className="flex items-center gap-2 flex-wrap">
                {htid}
                {hpid}
                <input
                  name="call_date"
                  type="date"
                  required
                  defaultValue={preferredDate ?? ""}
                  style={{ ...inp, colorScheme: "dark" }}
                />
                <input
                  name="call_time"
                  type="time"
                  required
                  defaultValue={
                    preferredTime
                      ? (TIME_BUCKETS[preferredTime]?.time ?? "10:00")
                      : "10:00"
                  }
                  style={{ ...inp, colorScheme: "dark" }}
                />
                <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
                  Book call
                </SubmitButton>
              </form>
            </>
          )}
        </section>
      </Reveal>

      {project && (
        <>
          {/* Delivery layer: milestones, decisions, playbooks (0028). The risk
              register sits on the Scale and Risk tile. */}
          <DeliverySections
            tenantId={tenantId}
            projectId={project.id}
            stage={project.stage}
            sections={["milestones", "decisions", "playbooks"]}
          />

          {/* Unified timeline — every source, one chronological story */}
          <TimelinePanel tenantId={tenantId} projectId={project.id} />

          {/* Notes */}
          <Reveal>
            <section style={card}>
              <h2 style={h2}>Internal notes</h2>
              <form
                action={addNote}
                className="flex items-center gap-2"
                style={{ marginBottom: 12 }}
              >
                {htid}
                {hpid}
                <input
                  name="body"
                  placeholder="Add an internal note…"
                  required
                  style={{ ...inp, flex: 1, height: 36 }}
                />
                <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                  Add note
                </SubmitButton>
              </form>
              <div className="flex flex-col gap-2">
                {noteList.map((n) => (
                  <div
                    key={n.id}
                    style={{ padding: "8px 0", borderTop: "1px solid var(--k-border)" }}
                  >
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        color: "var(--k-faint)",
                        marginBottom: 3,
                      }}
                    >
                      {new Date(n.created_at).toLocaleString("en-GB")}
                    </div>
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-fg)",
                        lineHeight: 1.5,
                      }}
                    >
                      {n.body}
                    </p>
                  </div>
                ))}
                {noteList.length === 0 && (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      color: "var(--k-faint)",
                    }}
                  >
                    No notes yet.
                  </p>
                )}
              </div>
            </section>
          </Reveal>

          {/* Live site + client-facing updates */}
          <Reveal>
            <section style={card}>
              <h2 style={h2}>Live site &amp; client updates</h2>
              <form
                action={setLiveUrl}
                className="flex items-center gap-2 flex-wrap"
                style={{ marginBottom: 14 }}
              >
                {htid}
                {hpid}
                <input
                  name="live_url"
                  type="url"
                  placeholder="https://their-live-site.co.uk"
                  defaultValue={project.live_url ?? ""}
                  style={{ ...inp, flex: "1 1 260px" }}
                />
                <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                  Save live link
                </SubmitButton>
              </form>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.8rem",
                  color: "var(--k-faint)",
                  marginBottom: 10,
                }}
              >
                Post a progress update the client sees on their project page.
              </p>
              <form action={postUpdate} className="flex flex-col gap-2">
                {htid}
                {hpid}
                {draftTitle && (
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    AI draft below — edit before posting; nothing is sent until you post
                  </span>
                )}
                <input
                  name="title"
                  required
                  defaultValue={draftTitle ?? ""}
                  placeholder="Update title (e.g. Homepage design ready for review)"
                  style={inp}
                />
                <textarea
                  name="body"
                  rows={draftBody ? 6 : 2}
                  defaultValue={draftBody ?? ""}
                  placeholder="Details (optional)"
                  style={{
                    ...inp,
                    height: "auto",
                    padding: "8px 10px",
                    resize: "vertical",
                  }}
                />
                <div className="flex items-center gap-2">
                  <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                    Post update
                  </SubmitButton>
                  <SubmitButton
                    formAction={draftUpdateWithAi}
                    formNoValidate
                    title="Drafts from shipped work, queued work, and milestones — you edit and post"
                    style={btn("transparent", "var(--k-accent)")}
                  >
                    ✦ Draft with AI
                  </SubmitButton>
                </div>
              </form>
            </section>
          </Reveal>
        </>
      )}

      {/* // RECENT ACTIVITY — this client's slice of the audit trail (the
          agency-wide last ten stays on Mission Control). */}
      <Reveal>
        <Panel
          label="// RECENT ACTIVITY"
          title="Recent activity"
          pad={false}
          style={{ marginBottom: 16 }}
          actions={
            <Link href="/admin/overview" style={monoLink}>
              Company-wide →
            </Link>
          }
        >
          {activity.length === 0 ? (
            <EmptyState text="No recorded activity for this client yet." />
          ) : (
            activity.map((a, i) => {
              const meta = summariseMetadata(a.metadata);
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5 px-4"
                  style={{
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    fontFamily: T.mono,
                    fontSize: 11,
                  }}
                >
                  <div className="min-w-0">
                    <div style={{ color: "var(--k-fg)" }}>
                      {a.action.replace(/[._]/g, " ")}
                      {a.target && (
                        <span style={{ color: "var(--k-faint)", marginLeft: 8 }}>
                          {a.target}
                        </span>
                      )}
                    </div>
                    {meta && (
                      <div
                        className="truncate"
                        style={{ color: "var(--k-muted)", marginTop: 3, maxWidth: 560 }}
                        title={meta}
                      >
                        {meta}
                      </div>
                    )}
                  </div>
                  <span style={{ color: "var(--k-muted)", whiteSpace: "nowrap" }}>
                    {stamp(a.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </Panel>
      </Reveal>

      {/* // AGENT TASKS — AI Office work delegated in this client's context.
          Read-only: the boards and the work order stay under /admin/ai. */}
      <Reveal>
        <Panel
          label="// AGENT TASKS"
          title="AI tasks for this client"
          pad={false}
          style={{ marginBottom: 16 }}
          actions={
            <Link href="/admin/ai/tasks" style={monoLink}>
              Task board →
            </Link>
          }
        >
          {agentTasks.length === 0 ? (
            <EmptyState text="No agent tasks delegated in this client's context." />
          ) : (
            agentTasks.map((task, i) => (
              <Link
                key={task.id}
                href={`/admin/ai/tasks/${task.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 px-4"
                style={{
                  borderTop: i ? "1px solid var(--k-border)" : "none",
                  textDecoration: "none",
                }}
              >
                <span className="min-w-0">
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.86rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {task.objective}
                  </span>
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      color: "var(--k-faint)",
                      marginLeft: 8,
                    }}
                  >
                    {task.priority}
                    {" · "}
                    {stamp(task.created_at)}
                    {task.deadline
                      ? ` · due ${new Date(task.deadline).toLocaleDateString("en-GB", {
                          timeZone: LONDON_TZ,
                        })}`
                      : ""}
                  </span>
                </span>
                <StatusChip tone={AGENT_TASK_TONE[task.status] ?? "muted"}>
                  {task.status.replace(/_/g, " ")}
                </StatusChip>
              </Link>
            ))
          )}
        </Panel>
      </Reveal>

      {/* Portal access */}
      <Reveal>
        <section style={card}>
          <h2 style={h2}>Client portal access</h2>
          {portalLoggedIn ? (
            <>
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 12,
                  color: T.success,
                  marginBottom: 4,
                }}
              >
                ✓ Portal active — the client has set their own password
                {portalUser?.lastSignInAt
                  ? ` (last signed in ${new Date(
                      portalUser.lastSignInAt
                    ).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })})`
                  : ""}
                .
              </p>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.82rem",
                  color: "var(--k-muted)",
                  lineHeight: 1.6,
                  marginBottom: 12,
                }}
              >
                They sign in with their own password — we never reset or display it.
                {!hasPortal
                  ? " Grant them access to this client's project below."
                  : ""}{" "}
                If they&apos;ve forgotten it, send a branded reset link.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {!hasPortal && (
                  <form action={createPortalAccount}>
                    {htid}
                    <input type="hidden" name="name" value={t.contact_name ?? t.name} />
                    <input type="hidden" name="email" value={portalEmail} />
                    <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
                      Grant portal access
                    </SubmitButton>
                  </form>
                )}
                <form action={sendPasswordReset}>
                  {htid}
                  <input type="hidden" name="name" value={t.contact_name ?? t.name} />
                  <input type="hidden" name="email" value={portalEmail} />
                  <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")}>
                    Send password reset link
                  </SubmitButton>
                </form>
              </div>
            </>
          ) : (
            <>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  color: "var(--k-muted)",
                  lineHeight: 1.6,
                  marginBottom: 12,
                }}
              >
                {hasPortal
                  ? "An invite was sent but the client hasn't signed in yet. Send a fresh link below — the old one stops working."
                  : "Invite the client to their portal. They choose their own password, then sign in at /portal to fill in their company details, review & sign the proposal + DPA, and submit change requests."}
              </p>
              <form
                action={createPortalAccount}
                className="flex items-center gap-2 flex-wrap"
              >
                {htid}
                <input type="hidden" name="name" value={t.contact_name ?? t.name} />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="client@email.com"
                  defaultValue={portalEmail || (t.contact_email ?? "")}
                  style={{ ...inp, width: 230 }}
                />
                <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")}>
                  {hasPortal ? "Send a fresh invite" : "Send portal invite"}
                </SubmitButton>
              </form>
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.78rem",
                  color: "var(--k-faint)",
                  marginTop: 8,
                }}
              >
                We email a single-use link and they choose their own password — no
                password is ever generated, sent or stored. If the link expires, they can
                use &ldquo;Forgot your password?&rdquo; on the sign-in page without
                needing us.
              </p>
            </>
          )}
        </section>
      </Reveal>

      {t.notes && (
        <Reveal>
          <section style={card}>
            <h2 style={h2}>Lead context</h2>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.86rem",
                color: "var(--k-muted)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {t.notes}
            </p>
          </section>
        </Reveal>
      )}

      {/* Danger zone — permanent deletion */}
      <Reveal>
        <section
          style={{
            ...card,
            borderColor: "color-mix(in oklab, " + T.danger + " 40%, transparent)",
          }}
        >
          <h2 style={{ ...h2, color: T.danger }}>Delete client</h2>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: "var(--k-muted)",
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          >
            Permanently erases this client and <b>all</b> their data — projects,
            proposals, invoices, documents, updates and portal login. This cannot be
            undone.
            {hasEmail ? (
              <>
                {" "}
                To confirm, type the client&apos;s email
                {t.contact_email ? (
                  <>
                    {" "}
                    (
                    <span style={{ fontFamily: T.mono, color: "var(--k-fg)" }}>
                      {t.contact_email}
                    </span>
                    )
                  </>
                ) : null}
                .
              </>
            ) : (
              <> This client has no email on record, so just press delete.</>
            )}
          </p>
          {hasEmail ? (
            <form action={deleteClient} className="flex items-center gap-2 flex-wrap">
              {htid}
              <input
                name="confirm_email"
                type="email"
                required
                placeholder="Type the client's email to confirm"
                autoComplete="off"
                style={{ ...inp, flex: "1 1 260px" }}
              />
              <SubmitButton style={btn(T.danger, "#fff")}>
                Delete permanently
              </SubmitButton>
            </form>
          ) : (
            <form action={deleteClient}>
              {htid}
              <SubmitButton style={btn(T.danger, "#fff")}>
                Delete permanently
              </SubmitButton>
            </form>
          )}
        </section>
      </Reveal>
    </TilePage>
  );
}

// Faint mono empty-row for the read-only panels (same markup as Mission Control).
function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="py-6 px-4"
      style={{
        fontFamily: T.sans,
        fontSize: "0.85rem",
        color: "var(--k-faint)",
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}
