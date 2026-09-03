import { createServiceClient } from "@nullshift/db";
import { carePlan } from "@/lib/carePlans";
import { OPEN_STATUSES, isUnreviewedDraft, type IssueStatus } from "@/lib/ops/issues";
import { pricesFromAssessment } from "@/lib/pricing/contracted";
import type { AssessmentRow } from "@/lib/pricing/contractedPrice";
import type { ScaleBand } from "@/lib/pricing/nsi";
import { documentReceipts } from "@/lib/documentEvents";
import {
  awaitingSignatureCount,
  blockColour,
  isCritHigh,
  summariseReceipts,
  type Block,
  type BlockProject,
  type DocsSummary,
} from "./rules";

/**
 * Loaders for the Dashboard grid and the per-client block. Service-role reads
 * only (the admin layout has already run requireStaff()); every signal is a
 * handful of bulk queries folded in memory — never a query per client.
 *
 * The receipts summary on the grid is derived from the document rows
 * themselves (proposal / Order Form / Change Order statuses). The per-client
 * loader swaps in the real read receipts from lib/documentEvents.
 */

type Service = ReturnType<typeof createServiceClient>;

/** A pipeline lead with no client tenant yet — a red "Enquiries" block. */
export type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  vertical: string | null;
  status: string;
  leadScore: number | null;
  businessName: string | null;
  requestedDate: string | null;
  createdAt: string;
};

export type ClientBlocks = { clients: Block[]; enquiries: Lead[]; platform: Block[] };

// ---------------------------------------------------------------------------
// Row shapes (what the queries select)
// ---------------------------------------------------------------------------

type TenantRow = {
  id: string;
  name: string;
  type: string;
  status: string | null;
  vertical: string | null;
  contact_name: string | null;
  contact_email: string | null;
  care_plan_choice: string | null;
  care_plan_terms_accepted_at: string | null;
  created_at: string;
};

type ProjectRow = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string | null;
  proposal_status: string | null;
  proposal_sent_at: string | null;
  accepted_at: string | null;
  live_url: string | null;
  next_action: string | null;
  next_action_owner: string | null;
  account_owner: string | null;
  delivery_owner: string | null;
  technical_owner: string | null;
  finance_owner: string | null;
  proposal_reviewed_by: string | null;
  created_at: string;
};

type ProfileRow = {
  project_id: string;
  repo_full_name: string | null;
  supabase_ref: string | null;
  health: string | null;
  build_goal: string | null;
};

type OrderFormRow = {
  id: string;
  tenant_id: string;
  reference: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

type ChangeOrderRow = { tenant_id: string; status: string; reviewed_by: string | null };

type SubRow = {
  id: string;
  tenant_id: string;
  plan: string | null;
  status: string;
  provider: string | null;
  mrr: number | string | null;
  created_at: string;
};

type EvidenceRow = {
  tenant_id: string;
  provisional_nsi: number | null;
  provisional_band: string | null;
  field_states: Record<string, string> | null;
  collected_at: string;
};

type IssueRow = {
  tenant_id: string;
  status: IssueStatus;
  severity: string | null;
  client_visible: boolean;
};

type InvoiceRow = {
  tenant_id: string;
  amount: number | string;
  status: string;
  due_at: string | null;
};

type AuditRow = { tenant_id: string | null; action: string; created_at: string };

type MembershipRow = { tenant_id: string; user_id: string };

type LeadRow = {
  id: string;
  name: string | null;
  email: string | null;
  vertical: string | null;
  status: string;
  lead_score: number | null;
  quiz_answers: { requested_date?: string | null } | null;
  plan: { businessName?: string | null } | null;
  created_at: string;
};

const TENANT_COLUMNS =
  "id, name, type, status, vertical, contact_name, contact_email, care_plan_choice, care_plan_terms_accepted_at, created_at";
const PROJECT_COLUMNS =
  "id, tenant_id, name, stage, proposal_status, proposal_sent_at, accepted_at, live_url, next_action, next_action_owner, account_owner, delivery_owner, technical_owner, finance_owner, proposal_reviewed_by, created_at";
const PROFILE_COLUMNS = "project_id, repo_full_name, supabase_ref, health, build_goal";
const ORDER_FORM_COLUMNS =
  "id, tenant_id, reference, status, sent_at, accepted_at, reviewed_by, created_at";
const SUB_COLUMNS = "id, tenant_id, plan, status, provider, mrr, created_at";
const ASSESSMENT_COLUMNS =
  "id, tenant_id, plan, scale_band, multiplier, direct_cost_floor, recommended_mrr, override_mrr, agreed_mrr, enterprise_review_required, pricing_version, plan_prices, created_at";
const EVIDENCE_COLUMNS =
  "tenant_id, provisional_nsi, provisional_band, field_states, collected_at";
const ISSUE_COLUMNS = "tenant_id, status, severity, client_visible";
const INVOICE_COLUMNS = "tenant_id, amount, status, due_at";
const LEAD_COLUMNS =
  "id, name, email, vertical, status, lead_score, quiz_answers, plan, created_at";

/** The audit actions that are the only record of "options / link sent". */
const OPTIONS_SENT_ACTIONS = ["care_plan.plan_invite_sent", "subscription.signup_sent"];
const DD_LINK_ACTIONS = ["care_plan.dd_setup_sent", "care_plan.dd_started"];
const CARE_AUDIT_ACTIONS = [...OPTIONS_SENT_ACTIONS, ...DD_LINK_ACTIONS];

/** Change Order statuses that mean the client has signed it. */
const CO_SIGNED = new Set(["accepted", "in_build", "delivered", "accepted_complete"]);

// ---------------------------------------------------------------------------
// Folding helpers
// ---------------------------------------------------------------------------

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? 0 : Number(v);

const toProject = (p: ProjectRow, profile: ProfileRow | undefined): BlockProject => ({
  id: p.id,
  proposalReviewedBy: p.proposal_reviewed_by,
  name: p.name,
  stage: p.stage,
  proposalStatus: p.proposal_status,
  proposalSentAt: p.proposal_sent_at,
  acceptedAt: p.accepted_at,
  liveUrl: p.live_url,
  nextAction: p.next_action?.trim() || null,
  nextActionOwner: p.next_action_owner?.trim() || null,
  owners: {
    account: p.account_owner?.trim() || null,
    delivery: p.delivery_owner?.trim() || null,
    technical: p.technical_owner?.trim() || null,
    finance: p.finance_owner?.trim() || null,
  },
  profile: profile
    ? {
        repo: profile.repo_full_name,
        supabaseRef: profile.supabase_ref,
        health: profile.health,
        buildGoal: profile.build_goal,
      }
    : null,
});

/** First-seen wins: callers pass rows ordered newest first. */
function latestBy<T extends { tenant_id: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) if (!m.has(r.tenant_id)) m.set(r.tenant_id, r);
  return m;
}

/**
 * Grid-side document summary from the document rows themselves. Approval
 * state reads the review-gate columns (migration 0049): a draft whose
 * reviewed_by is empty is awaiting a second staff member. The per-client
 * loader replaces this with the real receipts (the document_events ledger).
 */
function docsFromRows(input: {
  project: BlockProject | null;
  orderForm: OrderFormRow | null;
  changeOrders: ChangeOrderRow[];
}): DocsSummary {
  let awaitingApproval = 0;
  let awaitingSignature = 0;
  let signed = 0;
  let sent = 0;
  const ps = input.project?.proposalStatus ?? null;
  if (ps === "sent") {
    sent++;
    awaitingSignature++;
  } else if (ps === "accepted") {
    sent++;
    signed++;
  } else if (input.project && (ps === null || ps === "draft")) {
    if (!input.project.proposalReviewedBy) awaitingApproval++;
  }
  const os = input.orderForm?.status ?? null;
  if (os === "client_review") {
    sent++;
    awaitingSignature++;
  } else if (os === "accepted") {
    sent++;
    signed++;
  } else if (os === "draft" && !input.orderForm?.reviewed_by) {
    awaitingApproval++;
  }
  for (const co of input.changeOrders) {
    if (co.status === "client_review") {
      sent++;
      awaitingSignature++;
    } else if (CO_SIGNED.has(co.status)) {
      sent++;
      signed++;
    } else if (co.status === "draft" && !co.reviewed_by) {
      awaitingApproval++;
    }
  }
  return { awaitingApproval, awaitingSignature, signed, sent };
}

type Signals = {
  projects: ProjectRow[];
  profiles: Map<string, ProfileRow>;
  orderForms: Map<string, OrderFormRow>;
  changeOrders: ChangeOrderRow[];
  subs: Map<string, SubRow>;
  assessments: Map<string, AssessmentRow & { tenant_id: string }>;
  evidence: Map<string, EvidenceRow>;
  issues: IssueRow[];
  invoices: InvoiceRow[];
  audit: AuditRow[];
  memberships: MembershipRow[];
  users: Map<string, { email: string | null; lastSignIn: string | null }>;
  now: number;
};

function buildBlock(t: TenantRow, s: Signals): Block {
  const projects = s.projects
    .filter((p) => p.tenant_id === t.id)
    .map((p) => toProject(p, s.profiles.get(p.id)));
  const project = projects[0] ?? null;

  const of = s.orderForms.get(t.id) ?? null;
  const cos = s.changeOrders.filter((c) => c.tenant_id === t.id);
  const changeOrdersInReview = cos.filter((c) => c.status === "client_review").length;

  const subRow = s.subs.get(t.id) ?? null;
  const subscription = subRow
    ? {
        id: subRow.id,
        plan: subRow.plan,
        planLabel: carePlan(subRow.plan)?.label ?? subRow.plan,
        status: subRow.status,
        provider: subRow.provider,
        mrr: num(subRow.mrr),
      }
    : null;

  const assessment = s.assessments.get(t.id) ?? null;
  const prices = pricesFromAssessment(assessment);
  const scan = !assessment ? (s.evidence.get(t.id) ?? null) : null;
  const pricing: Block["pricing"] = {
    scored: prices.scored,
    anyPriced: prices.anyPriced,
    enterpriseReview: !!assessment?.enterprise_review_required,
    band: (assessment?.scale_band as ScaleBand | null) ?? null,
    multiplier:
      assessment?.multiplier === null || assessment?.multiplier === undefined
        ? null
        : Number(assessment.multiplier),
    scan: scan
      ? {
          nsi: scan.provisional_nsi,
          band: scan.provisional_band,
          pending: Object.values(scan.field_states ?? {}).filter((v) => v !== "auto")
            .length,
        }
      : null,
  };

  let open = 0;
  let critHigh = 0;
  let awaitingClient = 0;
  for (const i of s.issues) {
    if (i.tenant_id !== t.id) continue;
    // Unreviewed inbox drafts aren't confirmed work — same rule as mission
    // control and the client table.
    if (isUnreviewedDraft(i)) continue;
    open++;
    if (isCritHigh(i.severity)) critHigh++;
    if (i.status === "awaiting_client") awaitingClient++;
  }

  const invoices: Block["invoices"] = {
    openCount: 0,
    openTotal: 0,
    overdueCount: 0,
    overdueTotal: 0,
    paidTotal: 0,
    hasAny: false,
  };
  for (const inv of s.invoices) {
    if (inv.tenant_id !== t.id) continue;
    invoices.hasAny = true;
    const amount = num(inv.amount);
    if (inv.status === "paid") invoices.paidTotal += amount;
    if (inv.status === "open") {
      invoices.openCount++;
      invoices.openTotal += amount;
      if (inv.due_at && new Date(inv.due_at).getTime() < s.now) {
        invoices.overdueCount++;
        invoices.overdueTotal += amount;
      }
    }
  }

  let optionsSentAt: string | null = null;
  let ddLinkSentAt: string | null = null;
  for (const a of s.audit) {
    if (a.tenant_id !== t.id) continue;
    if (!optionsSentAt && OPTIONS_SENT_ACTIONS.includes(a.action))
      optionsSentAt = a.created_at;
    if (!ddLinkSentAt && DD_LINK_ACTIONS.includes(a.action)) ddLinkSentAt = a.created_at;
  }

  const member = s.memberships.find((m) => m.tenant_id === t.id) ?? null;
  const user = member ? s.users.get(member.user_id) : undefined;
  const portal: Block["portal"] = {
    state: !member ? "none" : user?.lastSignIn ? "active" : "invited",
    email: user?.email ?? t.contact_email ?? null,
    lastSignInAt: user?.lastSignIn ?? null,
  };

  const colourInput = {
    proposalStatus: project?.proposalStatus ?? null,
    orderFormStatus: of?.status ?? null,
    tenantStatus: t.status,
    stage: project?.stage ?? null,
  };
  const colour =
    t.type === "internal"
      ? { tone: "muted" as const, label: "Platform" }
      : blockColour(colourInput);

  return {
    tenant: {
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      vertical: t.vertical,
      contactName: t.contact_name,
      contactEmail: t.contact_email,
      carePlanChoice: t.care_plan_choice,
      carePlanTermsAcceptedAt: t.care_plan_terms_accepted_at,
      createdAt: t.created_at,
    },
    projects,
    project,
    orderForm: of
      ? {
          id: of.id,
          reference: of.reference,
          status: of.status,
          sentAt: of.sent_at,
          acceptedAt: of.accepted_at,
        }
      : null,
    changeOrdersInReview,
    subscription,
    pricing,
    issues: { open, critHigh, awaitingClient },
    invoices,
    carePlan: { optionsSentAt, ddLinkSentAt },
    portal,
    documents: [],
    docs: docsFromRows({ project, orderForm: of, changeOrders: cos }),
    colour,
    awaitingSignature: awaitingSignatureCount({
      proposalStatus: colourInput.proposalStatus,
      orderFormStatus: colourInput.orderFormStatus,
      changeOrdersInReview,
    }),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Every per-tenant signal for a set of tenants in one round of bulk queries.
 * `users` is resolved by the caller (listUsers for the grid, getUserById for a
 * single block) so the grid never calls auth once per client.
 */
async function loadSignals(
  service: Service,
  tenantIds: string[],
  users: Signals["users"]
): Promise<Signals> {
  const now = Date.now();
  if (!tenantIds.length)
    return {
      projects: [],
      profiles: new Map(),
      orderForms: new Map(),
      changeOrders: [],
      subs: new Map(),
      assessments: new Map(),
      evidence: new Map(),
      issues: [],
      invoices: [],
      audit: [],
      memberships: [],
      users,
      now,
    };

  const [
    { data: projectsRaw },
    { data: orderFormsRaw },
    { data: changeOrdersRaw },
    { data: subsRaw },
    { data: assessmentsRaw },
    { data: evidenceRaw },
    { data: issuesRaw },
    { data: invoicesRaw },
    { data: auditRaw },
    { data: membershipsRaw },
  ] = await Promise.all([
    service
      .from("projects")
      .select(PROJECT_COLUMNS)
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false }),
    service
      .from("order_forms")
      .select(ORDER_FORM_COLUMNS)
      .in("tenant_id", tenantIds)
      .not("status", "in", "(withdrawn,superseded)")
      .order("created_at", { ascending: false }),
    service
      .from("change_orders")
      .select("tenant_id, status, reviewed_by")
      .in("tenant_id", tenantIds),
    service
      .from("subscriptions")
      .select(SUB_COLUMNS)
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false }),
    service
      .from("scale_assessments")
      .select(ASSESSMENT_COLUMNS)
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false }),
    service
      .from("scale_evidence")
      .select(EVIDENCE_COLUMNS)
      .in("tenant_id", tenantIds)
      .order("collected_at", { ascending: false }),
    service
      .from("issues")
      .select(ISSUE_COLUMNS)
      .in("tenant_id", tenantIds)
      .in("status", OPEN_STATUSES),
    service
      .from("invoices")
      .select(INVOICE_COLUMNS)
      .in("tenant_id", tenantIds)
      .in("status", ["open", "paid"]),
    service
      .from("audit_log")
      .select("tenant_id, action, created_at")
      .in("tenant_id", tenantIds)
      .in("action", CARE_AUDIT_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(1000),
    service
      .from("memberships")
      .select("tenant_id, user_id")
      .in("tenant_id", tenantIds)
      .eq("role", "client_admin"),
  ]);

  const projects = (projectsRaw ?? []) as ProjectRow[];
  const projectIds = projects.map((p) => p.id);
  const { data: profilesRaw } = projectIds.length
    ? await service
        .from("system_profiles")
        .select(PROFILE_COLUMNS)
        .in("project_id", projectIds)
    : { data: [] as ProfileRow[] };

  return {
    projects,
    profiles: new Map(
      ((profilesRaw ?? []) as ProfileRow[]).map((p) => [p.project_id, p])
    ),
    // Live order form = accepted → client_review → draft, newest first within
    // a status; withdrawn / superseded rows are already excluded.
    orderForms: latestBy(
      [...((orderFormsRaw ?? []) as OrderFormRow[])].sort((a, b) => {
        const rank = (s: string) =>
          s === "accepted" ? 0 : s === "client_review" ? 1 : s === "draft" ? 2 : 3;
        return rank(a.status) - rank(b.status);
      })
    ),
    changeOrders: (changeOrdersRaw ?? []) as ChangeOrderRow[],
    subs: latestBy(
      // A live row wins over a stale canceled/incomplete one, whatever the age.
      [...((subsRaw ?? []) as SubRow[])].sort((a, b) => {
        const rank = (s: string) =>
          s === "active" || s === "trialing" ? 0 : s === "past_due" ? 1 : 2;
        return rank(a.status) - rank(b.status);
      })
    ),
    assessments: latestBy(
      (assessmentsRaw ?? []) as (AssessmentRow & { tenant_id: string })[]
    ),
    evidence: latestBy((evidenceRaw ?? []) as EvidenceRow[]),
    issues: (issuesRaw ?? []) as IssueRow[],
    invoices: (invoicesRaw ?? []) as InvoiceRow[],
    audit: (auditRaw ?? []) as AuditRow[],
    memberships: (membershipsRaw ?? []) as MembershipRow[],
    users,
    now,
  };
}

/** The Dashboard grid: one block per client, enquiries, and the platform row. */
export async function loadClientBlocks(): Promise<ClientBlocks> {
  const service = createServiceClient();
  const [{ data: tenantsRaw }, { data: leadsRaw }, usersRes] = await Promise.all([
    service
      .from("tenants")
      .select(TENANT_COLUMNS)
      .in("type", ["client", "internal"])
      .order("created_at", { ascending: false }),
    service
      .from("leads")
      .select(LEAD_COLUMNS)
      .neq("status", "lost")
      .order("lead_score", { ascending: false, nullsFirst: false }),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const tenants = (tenantsRaw ?? []) as TenantRow[];
  const users = new Map(
    (usersRes.data?.users ?? []).map((u) => [
      u.id,
      { email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null },
    ])
  );

  const signals = await loadSignals(
    service,
    tenants.map((t) => t.id),
    users
  );
  const blocks = tenants.map((t) => buildBlock(t, signals));
  const clients = blocks.filter((b) => b.tenant.type === "client");
  const platform = blocks.filter((b) => b.tenant.type === "internal");

  // Enquiries: leads whose email matches no client tenant (openLead has not
  // run). Emailless leads cannot have been opened, so they count too.
  const tenantEmails = new Set(
    tenants
      .map((t) => t.contact_email?.trim().toLowerCase())
      .filter((e): e is string => !!e)
  );
  const enquiries: Lead[] = ((leadsRaw ?? []) as LeadRow[])
    .filter((l) => {
      const email = l.email?.trim().toLowerCase();
      return !email || !tenantEmails.has(email);
    })
    .map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      vertical: l.vertical,
      status: l.status,
      leadScore: l.lead_score,
      businessName: l.plan?.businessName ?? null,
      requestedDate: l.quiz_answers?.requested_date ?? null,
      createdAt: l.created_at,
    }));

  return { clients, enquiries, platform };
}

/**
 * One client's block with the full document read receipts — everything
 * tileStates() needs plus the per-document Sent / Viewed / Signed rows.
 * Returns null when the tenant does not exist.
 */
export async function loadClientBlock(tenantId: string): Promise<Block | null> {
  if (!tenantId) return null;
  const service = createServiceClient();
  const { data: tenantRaw } = await service
    .from("tenants")
    .select(TENANT_COLUMNS)
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenantRaw) return null;
  const tenant = tenantRaw as TenantRow;

  // The portal user for this client alone — one lookup, not a full listing.
  const { data: membership } = await service
    .from("memberships")
    .select("tenant_id, user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "client_admin")
    .limit(1)
    .maybeSingle();
  const users: Signals["users"] = new Map();
  if (membership?.user_id) {
    const { data: u } = await service.auth.admin.getUserById(membership.user_id);
    if (u.user)
      users.set(u.user.id, {
        email: u.user.email ?? null,
        lastSignIn: u.user.last_sign_in_at ?? null,
      });
  }

  const [signals, documents] = await Promise.all([
    loadSignals(service, [tenantId], users),
    documentReceipts(service, tenantId),
  ]);
  const block = buildBlock(tenant, signals);
  const receipts = summariseReceipts(documents);
  return {
    ...block,
    documents,
    // Receipts are the authority once loaded; fall back to the row-derived
    // summary only when the events module knows nothing about this client.
    docs: documents.length ? receipts : block.docs,
  };
}
