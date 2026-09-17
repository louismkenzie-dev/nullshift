import "server-only";

import { createClient, createServiceClient } from "@nullshift/db";
import { getPortalClient } from "@/lib/clientPreview";
import { flagOn } from "@/lib/flags";
import { CARE_PLANS } from "@/lib/carePlans";
import {
  generateInitialChecklist,
  generateLaterChecklist,
  type InitialFacts,
  type LaterFacts,
} from "./checklists";
import { governingAcceptance } from "./acceptance";
import { governingScope, type GoverningScope, type OrderFormLike } from "./scope";
import type { BuildAcceptance, ChecklistTask, ServiceRoute } from "./types";

/**
 * Data loading for the portal's checklist and acceptance pages (server only).
 *
 * With `acceptanceGate` OFF nothing from migration 0060 is read: the checklist
 * is generated from facts the portal already reads today (project, order
 * forms, invoices, subscriptions) and the pages are read-only. With the flag
 * ON the persisted `checklist_tasks` and `build_acceptances` rows are read as
 * well, through the caller's own client — the RLS client for a real client,
 * the tenant-scoped read-only client for a staff preview.
 */

type Db = Awaited<ReturnType<typeof createClient>>;

export type PortalProject = {
  id: string;
  name: string | null;
  stage: string | null;
  proposal_status: string | null;
  accepted_at: string | null;
  dpa_client_submitted_at: string | null;
  accepted_snapshot: {
    deliverables?: unknown;
    scope?: { deliverables?: unknown };
  } | null;
};

export type ProjectFacts = {
  tenant: { id: string; name: string; care_plan_choice: string | null } | null;
  project: PortalProject | null;
  route: ServiceRoute;
  scope: GoverningScope | null;
  initialFacts: InitialFacts | null;
  laterFacts: Omit<
    LaterFacts,
    "buildAccepted" | "buildAcceptedPartial" | "buildDisputed"
  > | null;
};

const managedIds = new Set(CARE_PLANS.map((p) => p.id));

/** Route from today's evidence: a chosen care plan means managed. Anything else is unresolved
 *  until a service arrangement records the election (independent is never inferred from "none"). */
export function routeFromChoice(choice: string | null | undefined): ServiceRoute {
  return choice && managedIds.has(choice) ? "managed" : "unresolved";
}

/** Facts for one tenant, read through the given client (RLS or tenant-scoped). */
export async function loadProjectFacts(
  db: Db,
  opts?: { projectId?: string | null }
): Promise<ProjectFacts> {
  const [
    { data: tenants },
    { data: projects },
    { data: orderForms },
    { data: invoices },
    { data: subs },
  ] = await Promise.all([
    db
      .from("tenants")
      .select("id, name, care_plan_choice, care_plan_terms_accepted_at")
      .limit(1),
    db
      .from("projects")
      .select(
        "id, name, stage, proposal_status, accepted_at, dpa_client_submitted_at, accepted_snapshot, created_at"
      )
      .order("created_at", { ascending: false }),
    db
      .from("order_forms")
      .select("reference, status, accepted_at, superseded_by, project_id, scope"),
    db.from("invoices").select("id, type, status, paid_at, project_id"),
    db.from("subscriptions").select("id, status, provider, gc_mandate_id"),
  ]);

  const tenantRow = (tenants?.[0] ?? null) as {
    id: string;
    name: string;
    care_plan_choice: string | null;
    care_plan_terms_accepted_at: string | null;
  } | null;
  const projectRows = (projects ?? []) as (PortalProject & { created_at: string })[];
  const project =
    (opts?.projectId
      ? projectRows.find((p) => p.id === opts.projectId)
      : projectRows[0]) ?? null;

  if (!tenantRow || !project) {
    return {
      tenant: tenantRow
        ? {
            id: tenantRow.id,
            name: tenantRow.name,
            care_plan_choice: tenantRow.care_plan_choice,
          }
        : null,
      project: null,
      route: "unresolved",
      scope: null,
      initialFacts: null,
      laterFacts: null,
    };
  }

  const forms = (orderForms ?? []) as OrderFormLike[];
  const scope = governingScope(project, forms);
  const invoiceRows = (invoices ?? []) as {
    type: string;
    status: string;
    project_id: string | null;
  }[];
  const depositPaid = invoiceRows.some(
    (i) =>
      i.type === "build_milestone" &&
      i.status === "paid" &&
      (!i.project_id || i.project_id === project.id)
  );
  const subRows = (subs ?? []) as { status: string; gc_mandate_id: string | null }[];
  const route = routeFromChoice(tenantRow.care_plan_choice);
  const stage = project.stage ?? "";
  const pastOnboarding = !["discovery", "onboarding", ""].includes(stage);

  return {
    tenant: {
      id: tenantRow.id,
      name: tenantRow.name,
      care_plan_choice: tenantRow.care_plan_choice,
    },
    project,
    route,
    scope,
    initialFacts: {
      projectId: project.id,
      tenantId: tenantRow.id,
      companyDetailsSubmitted: !!project.dpa_client_submitted_at,
      agreementAccepted: !!scope,
      depositPaid,
      // Assets and kickoff have no record of their own today; the stage moving
      // past onboarding is the only evidence, and it is labelled as such.
      assetsProvided: pastOnboarding,
      kickoffConfirmed: pastOnboarding,
    },
    laterFacts: {
      projectId: project.id,
      tenantId: tenantRow.id,
      route,
      scheduleAccepted: !!tenantRow.care_plan_terms_accepted_at,
      mandateAuthorised: subRows.some((s) => !!s.gc_mandate_id),
      activated: subRows.some((s) => s.status === "active"),
    },
  };
}

export type PortalDelivery = {
  flag: boolean;
  preview: boolean;
  userId: string | null;
  /** The signed-in user holds the tenant-admin membership (the signatory role today). */
  isSignatory: boolean;
  facts: ProjectFacts;
  acceptances: BuildAcceptance[];
  governing: BuildAcceptance | null;
  initial: ChecklistTask[];
  later: ChecklistTask[];
  /** True when the tasks shown are persisted rows (flag on and published). */
  persisted: boolean;
};

/** Everything the two portal pages need, in one call. */
export async function loadPortalDelivery(): Promise<PortalDelivery> {
  const { supabase, user, preview } = await getPortalClient();
  const flag = flagOn("acceptanceGate");
  const facts = await loadProjectFacts(supabase);

  let acceptances: BuildAcceptance[] = [];
  let persistedInitial: ChecklistTask[] = [];
  let persistedLater: ChecklistTask[] = [];
  if (flag && facts.project) {
    const [{ data: acc }, { data: tasks }] = await Promise.all([
      supabase
        .from("build_acceptances")
        .select("*")
        .eq("project_id", facts.project.id)
        .order("accepted_at", { ascending: false }),
      supabase
        .from("checklist_tasks")
        .select("*")
        .eq("project_id", facts.project.id)
        .order("created_at", { ascending: true }),
    ]);
    acceptances = (acc ?? []) as BuildAcceptance[];
    const rows = (tasks ?? []) as ChecklistTask[];
    persistedInitial = rows.filter((t) => t.journey === "initial");
    persistedLater = rows.filter((t) => t.journey === "later");
  }

  const governing = governingAcceptance(acceptances, facts.scope?.ref ?? null);
  const latestForScope =
    acceptances.find((a) => a.scope_version_ref === facts.scope?.ref) ?? null;

  const initial =
    persistedInitial.length > 0
      ? persistedInitial
      : facts.initialFacts
        ? generateInitialChecklist(facts.initialFacts)
        : [];
  const later =
    persistedLater.length > 0
      ? persistedLater
      : facts.laterFacts
        ? generateLaterChecklist({
            ...facts.laterFacts,
            buildAccepted: !!governing && !governing.partial,
            buildAcceptedPartial: !!governing?.partial,
            buildDisputed: !!latestForScope?.disputed && !governing,
          })
        : [];

  let isSignatory = false;
  if (user && !preview && facts.tenant) {
    const service = createServiceClient();
    const { data: m } = await service
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", facts.tenant.id)
      .eq("role", "client_admin")
      .limit(1)
      .maybeSingle();
    isSignatory = !!m;
  }

  return {
    flag,
    preview: !!preview,
    userId: user?.id ?? null,
    isSignatory,
    facts,
    acceptances,
    governing,
    initial,
    later,
    persisted: persistedInitial.length > 0 || persistedLater.length > 0,
  };
}
