import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader } from "@/components/app/AppKit";

/**
 * Shared types, constants, styles and small helpers for the per-client tile
 * pages under /admin/clients/[id]/*. Not a route (underscore prefix). The
 * server actions live in ./actions.ts; every tile page imports what it needs
 * from here so the panels moved off the old hub keep their exact look.
 */

export type Item = { id: string; name: string; amount: number; status: string };
export type CR = {
  id: string;
  description: string;
  status: string;
  estimate_hours: number | null;
  quoted_price: number | null;
};
export type Note = { id: string; body: string; created_at: string };
export type Doc = {
  id: string;
  kind: string;
  storage_path: string;
  version: number;
  created_at?: string | null;
};
export type Invoice = {
  id: string;
  /** Null for an ad-hoc one-off raised against the tenant, not a project. */
  project_id?: string | null;
  amount: number;
  status: string;
  /** 'build_milestone' | 'one_off' | … — the build panel keys off this. */
  type: string | null;
  hosted_invoice_url: string | null;
  project_item_count: number | null;
  created_at: string;
  paid_at: string | null;
  xero_invoice_id: string | null;
};
export type Call = {
  id: string;
  call_date: string;
  call_time: string;
  duration_min: number;
  status: string;
  meeting_link: string | null;
  meeting_id: string | null;
  meeting_password: string | null;
};
export type Sub = {
  id: string;
  plan: string;
  mrr: number;
  status: string;
  provider?: string | null;
};

export const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
// Full delivery lifecycle (migration 0024): signed work lands in onboarding,
// launch_prep is the real pre-live gate, complete closes a project out.
export const STAGES = [
  "discovery",
  "onboarding",
  "build",
  "review",
  "launch_prep",
  "live",
  "care",
  "complete",
];
/** Time-of-day the client picked when booking → a readable label + a sensible
 *  default exact time to prefill (still confirmed with them). */
export const TIME_BUCKETS: Record<string, { label: string; time: string }> = {
  morning: { label: "Morning (9am–12pm)", time: "09:00" },
  afternoon: { label: "Afternoon (12pm–5pm)", time: "13:00" },
  evening: { label: "Evening (5pm–8pm)", time: "17:00" },
};
export const CR_NEXT: Record<string, string> = {
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};

// ── UI helpers (KYMA app surface: hairline, square, mono, emerald accent) ──
// Emerald (var(--k-accent)) is the only brand colour; the rest are signal/muted
// tones. Status chips are square (no pills) per the design system.
export const tone: Record<string, string> = {
  draft: "var(--k-muted)",
  sent: T.warning,
  accepted: "var(--k-accent)",
  declined: T.danger,
  submitted: T.info,
  triaged: T.info,
  scoped: T.warning,
  awaiting_approval: T.warning,
  approved: "var(--k-accent)",
  in_progress: "var(--k-accent)",
  review: T.warning,
  shipped: T.success,
  rejected: T.danger,
  paid: T.success,
  open: T.warning,
  proposed: "var(--k-muted)",
  built: T.success,
  active: T.success,
  trialing: T.info,
  past_due: T.danger,
  incomplete: T.warning,
  canceled: "var(--k-muted)",
  cancelled: "var(--k-muted)",
  confirmed: "var(--k-accent)",
  client_review: T.warning,
  withdrawn: "var(--k-muted)",
  superseded: "var(--k-muted)",
  notified: T.warning,
  notice_sent: T.warning,
  effective: T.success,
};
export function Badge({ s }: { s: string }) {
  const c = tone[s] ?? "var(--k-muted)";
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "10px",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: c,
        background: `color-mix(in oklab, ${c} 12%, transparent)`,
        border: `1px solid color-mix(in oklab, ${c} 32%, transparent)`,
        borderRadius: 0,
        padding: "3px 8px",
      }}
    >
      {s.replace(/_/g, " ")}
    </span>
  );
}
// Workhorse panel — mirrors AppKit Panel / .k-kard: hairline square card.
export const card = {
  background: "var(--k-surface)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "18px 20px",
  marginBottom: 16,
} as const;
// Section title — TASA Orbiter, uppercase (matches Panel header type).
export const h2 = {
  fontFamily: T.sans,
  fontWeight: 700,
  fontSize: "1.05rem",
  letterSpacing: "-0.01em",
  textTransform: "uppercase" as const,
  color: "var(--k-fg)",
  marginBottom: 12,
} as const;
// Square input — var(--k-surface) bg, hairline border, emerald focus ring.
export const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 32,
  padding: "0 10px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
} as const;
// Square mono uppercase button. Accent (emerald) primary, outline ghost.
export const btn = (bg: string, fg: string) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  height: 32,
  paddingInline: 12,
  background: bg,
  color: fg,
  border: bg === "transparent" ? "1px solid var(--k-border-strong)" : "none",
  borderRadius: 0,
  cursor: "pointer",
});
/** Small mono chip used for header signals (DPA state, blocked notices…). */
export function SignalChip({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
        border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`,
        borderRadius: 0,
        padding: "3px 8px",
      }}
    >
      {children}
    </span>
  );
}

/** Mono uppercase link used for cross-tile navigation inside panels. */
export const monoLink = {
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "var(--k-accent)",
  textDecoration: "none",
} as const;

// ── shared loading ─────────────────────────────────────────────

export type TenantRow = {
  id: string;
  name: string;
  type: string | null;
  vertical: string | null;
  status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  care_plan_choice: string | null;
  care_plan_terms_accepted_at: string | null;
};

export type ProjectRow = {
  id: string;
  name: string;
  stage: string;
  proposal_status: string;
  proposed_plan: string | null;
  overview: string | null;
  payment_terms: string | null;
  client_entity_type: string | null;
  dpa_client_country: string | null;
  dpa_client_company_name: string | null;
  dpa_client_company_number: string | null;
  dpa_client_registered_address: string | null;
  dpa_personal_data: string | null;
  dpa_special_category: boolean | null;
  dpa_special_category_detail: string | null;
  dpa_client_submitted_at: string | null;
  accepted_name: string | null;
  accepted_at: string | null;
  proposal_sent_at: string | null;
  live_url: string | null;
  account_owner: string | null;
  delivery_owner: string | null;
  technical_owner: string | null;
  finance_owner: string | null;
  next_action: string | null;
  next_action_owner: string | null;
  proposal_drafted_by: string | null;
  proposal_reviewed_by: string | null;
  proposal_reviewed_at: string | null;
};

export const PROJECT_COLUMNS =
  "id, name, stage, proposal_status, proposed_plan, overview, payment_terms, client_entity_type, dpa_client_country, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at, accepted_name, accepted_at, proposal_sent_at, live_url, account_owner, delivery_owner, technical_owner, finance_owner, next_action, next_action_owner, proposal_drafted_by, proposal_reviewed_by, proposal_reviewed_at";

/**
 * The tenant plus its projects (newest first) — what every tile page starts
 * from. Calls notFound() when the tenant does not exist. The primary project
 * is the most recent one, exactly as the old hub keyed on it.
 */
export async function loadTenantAndProjects(tenantId: string): Promise<{
  tenant: TenantRow;
  projects: ProjectRow[];
  project: ProjectRow | null;
}> {
  const supabase = await createClient();
  const [{ data: tenant }, { data: projects }] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "id, name, type, vertical, status, contact_name, contact_email, contact_phone, notes, care_plan_choice, care_plan_terms_accepted_at"
      )
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);
  if (!tenant) notFound();
  const list = (projects ?? []) as unknown as ProjectRow[];
  return {
    tenant: tenant as unknown as TenantRow,
    projects: list,
    project: list[0] ?? null,
  };
}

/** Back link to the client's block page, labelled with the client's name. */
export function BackToClient({ tenantId, name }: { tenantId: string; name: string }) {
  return (
    <Link
      href={`/admin/clients/${tenantId}`}
      style={{
        fontFamily: T.mono,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--k-muted)",
        textDecoration: "none",
      }}
    >
      ← {name}
    </Link>
  );
}

/**
 * Standard tile-page top: the back link to the block, then a PageHeader whose
 * eyebrow is the tile name and whose title is the tile's subject.
 */
export function TilePage({
  tenantId,
  tenantName,
  index,
  label,
  title,
  lead,
  actions,
  children,
  maxWidth = 880,
}: {
  tenantId: string;
  tenantName: string;
  index: string;
  label: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div style={{ maxWidth, margin: "0 auto" }}>
      <BackToClient tenantId={tenantId} name={tenantName} />
      <div style={{ marginTop: 12, marginBottom: 18 }}>
        <PageHeader
          index={index}
          label={label}
          title={title}
          lead={lead}
          actions={actions}
        />
      </div>
      {children}
    </div>
  );
}

export const dateGB = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

export const dateTimeGB = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
