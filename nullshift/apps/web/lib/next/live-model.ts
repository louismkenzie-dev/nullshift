/** Real-record projections. No catalogue repricing and no fixture fallback. */
export type ClientRecord = {
  id: string;
  name: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  vertical: string | null;
  notes: string | null;
  created_at: string;
};
export type ProjectRecord = {
  id: string;
  tenant_id: string;
  name: string;
  stage: string;
  overview: string | null;
  next_action: string | null;
  next_action_owner: string | null;
  account_owner: string | null;
  proposal_status: string | null;
  accepted_at: string | null;
  created_at: string;
};
export type InvoiceRecord = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  type: string;
  amount: string | number;
  status: string;
  due_at: string | null;
  created_at: string;
};
export type SubscriptionRecord = {
  id: string;
  tenant_id: string;
  plan: string | null;
  mrr: number | string | null;
  status: string;
  provider: string | null;
  created_at: string;
};
export type AgreementRecord = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  reference: string;
  status: string;
  accepted_at: string | null;
  created_at: string;
};
export type LeadRecord = {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  vertical: string | null;
  created_at: string;
};
export type OperationsData = {
  clients: ClientRecord[];
  projects: ProjectRecord[];
  invoices: InvoiceRecord[];
  subscriptions: SubscriptionRecord[];
  agreements: AgreementRecord[];
  leads: LeadRecord[];
  unavailable: string[];
  limited: string[];
  loadedAt: string;
};

export const humanise = (value: string | null | undefined) =>
  value
    ? value.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase())
    : "Not recorded";
export const money = (value: number | string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Number(value));
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

export function operationsSummary(data: OperationsData) {
  // The legacy ledger stores GBP, not minor units. Do not infer partial allocations.
  const open = data.invoices.filter((r) => r.status === "open");
  const active = data.subscriptions.filter((r) => r.status === "active");
  return {
    clients: data.clients.length,
    inDelivery: data.projects.filter(
      (p) => !["live", "care", "complete", "cancelled"].includes(p.stage)
    ).length,
    monthly:
      data.unavailable.includes("Subscriptions") ||
      data.limited.includes("Subscriptions") ||
      active.some((r) => r.mrr === null || !Number.isFinite(Number(r.mrr)))
        ? null
        : active.reduce((sum, r) => sum + Number(r.mrr), 0),
    openInvoices:
      data.unavailable.includes("Invoices") ||
      data.limited.includes("Invoices") ||
      open.some((r) => r.amount === null || !Number.isFinite(Number(r.amount)))
        ? null
        : open.reduce((sum, r) => sum + Number(r.amount), 0),
    actions: data.projects.filter((p) => p.next_action?.trim()),
  };
}

export type NewClientInput = {
  draftId: string;
  projectId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  projectName: string;
  brief: string;
  owner: string;
  serviceRoute: "undecided" | "managed" | "handover";
};
export type NewClientResult = {
  ok: boolean;
  error?: string;
  clientId?: string;
  projectPending?: boolean;
  duplicateId?: string;
};
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateNewClient(raw: NewClientInput): string | null {
  if (
    !uuidPattern.test(raw.draftId) ||
    !uuidPattern.test(raw.projectId) ||
    raw.draftId === raw.projectId
  )
    return "This draft has expired. Refresh the page to start again.";
  if (raw.businessName.trim().length < 2 || raw.businessName.trim().length > 160)
    return "Enter a business name between 2 and 160 characters.";
  if (!raw.contactName.trim() || raw.contactName.length > 120)
    return "Enter the main contact’s name (up to 120 characters).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.email.trim()) || raw.email.length > 254)
    return "Enter a valid contact email address.";
  if (!raw.projectName.trim() || raw.projectName.length > 160)
    return "Give the project a short name (up to 160 characters).";
  if (raw.phone.length > 60 || raw.owner.length > 120 || raw.brief.length > 4000)
    return "Please shorten the phone number, owner or project brief.";
  if (!["undecided", "managed", "handover"].includes(raw.serviceRoute))
    return "Choose a valid service preference.";
  return null;
}

const DRAFT_PREFIX = "Nullshift onboarding draft\n";
export function draftNotes(input: NewClientInput, actor: string) {
  return (
    DRAFT_PREFIX +
    JSON.stringify({
      version: 1,
      actor,
      projectId: input.projectId,
      serviceRoute: input.serviceRoute,
      projectName: input.projectName,
      brief: input.brief,
      owner: input.owner,
    })
  );
}
export function readDraftNotes(notes: string | null) {
  if (!notes?.startsWith(DRAFT_PREFIX)) return null;
  try {
    const value = JSON.parse(notes.slice(DRAFT_PREFIX.length));
    if (
      !value ||
      value.version !== 1 ||
      typeof value.actor !== "string" ||
      !uuidPattern.test(value.projectId) ||
      !["undecided", "managed", "handover"].includes(value.serviceRoute) ||
      ["projectName", "brief", "owner"].some((key) => typeof value[key] !== "string")
    )
      return null;
    return value as {
      version: 1;
      actor: string;
      projectId: string;
      serviceRoute: string;
      projectName: string;
      brief: string;
      owner: string;
    };
  } catch {
    return null;
  }
}
