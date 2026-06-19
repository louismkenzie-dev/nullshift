import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { uploadDeliverable } from "@nullshift/db/documents";
import { createItemisedStripeInvoice } from "@nullshift/billing/stripe";
import { CATALOG } from "@nullshift/content/catalog";
import { T } from "@nullshift/ui/tokens";

/**
 * Unified Client hub — ONE page per client, keyed by the tenant. Everything for a
 * client relationship lives here: contact details, call booking, the itemised
 * proposal (build modules), DPA/compliance, project stage, change requests,
 * itemised invoicing + care subscriptions, deliverables, internal notes, and the
 * client's portal login. Replaces the old split between /admin/clients (legacy)
 * and /admin/delivery (multi-tenant). The client portal reads the same tenant
 * tables, so a membership created here gives the client portal access immediately.
 */
export const dynamic = "force-dynamic";

type Item = { id: string; name: string; amount: number; status: string };
type CR = {
  id: string;
  description: string;
  status: string;
  estimate_hours: number | null;
  quoted_price: number | null;
};
type Note = { id: string; body: string; created_at: string };
type Doc = { id: string; kind: string; storage_path: string; version: number };
type Invoice = {
  id: string;
  amount: number;
  status: string;
  hosted_invoice_url: string | null;
  project_item_count: number | null;
  created_at: string;
};
type Call = {
  id: string;
  call_date: string;
  call_time: string;
  duration_min: number;
  status: string;
  meeting_link: string | null;
  meeting_id: string | null;
  meeting_password: string | null;
};
type Sub = { id: string; plan: string; mrr: number; status: string };

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const STAGES = ["discovery", "build", "review", "live", "care"];
const CR_NEXT: Record<string, string> = {
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};
const PLANS: { id: string; label: string; mrr: number }[] = [
  { id: "care_basic", label: "Care Basic", mrr: 49 },
  { id: "care_pro", label: "Care Pro", mrr: 149 },
  { id: "transaction", label: "Transaction", mrr: 39 },
];
const PLAN_MRR: Record<string, number> = Object.fromEntries(
  PLANS.map((p) => [p.id, p.mrr])
);

// ── server actions ─────────────────────────────────────────────
async function ensureProject(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const name = String(formData.get("name") || "Build").trim() || "Build";
  if (!tenantId) return;
  const supabase = await createClient();
  await supabase
    .from("projects")
    .insert({ tenant_id: tenantId, name, stage: "discovery" });
  await logAudit({ action: "project.created", target: `tenant:${tenantId}`, tenantId });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function addItem(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const name = String(formData.get("name") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!projectId || !name) return;
  const supabase = await createClient();
  await supabase
    .from("project_items")
    .insert({ project_id: projectId, tenant_id: tenantId, name, amount });
  await logAudit({
    action: "proposal.item_added",
    target: `project:${projectId}`,
    tenantId,
    metadata: { name, amount },
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function removeItem(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  await supabase.from("project_items").delete().eq("id", id);
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function sendProposal(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ proposal_status: "sent", proposal_sent_at: new Date().toISOString() })
    .eq("id", projectId);
  await logAudit({ action: "proposal.sent", target: `project:${projectId}`, tenantId });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function setStage(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const stage = String(formData.get("stage") || "");
  if (!STAGES.includes(stage)) return;
  const supabase = await createClient();
  // The DPA-before-live DB trigger blocks stage='live' until a DPA is logged.
  const { error } = await supabase
    .from("projects")
    .update({ stage: stage as never })
    .eq("id", projectId);
  if (error) console.error("setStage:", error.message);
  else
    await logAudit({
      action: `project.stage.${stage}`,
      target: `project:${projectId}`,
      tenantId,
    });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function addNote(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const body = String(formData.get("body") || "").trim();
  if (!projectId || !body) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("project_notes")
    .insert({
      project_id: projectId,
      tenant_id: tenantId,
      body,
      author: user?.id ?? null,
    });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function advanceCr(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const action = String(formData.get("action") || "");
  const supabase = await createClient();
  if (action === "triage") {
    await supabase.from("change_requests").update({ status: "triaged" }).eq("id", id);
    await logAudit({
      action: "change_request.triaged",
      target: `change_request:${id}`,
      tenantId,
    });
  } else if (action === "scope") {
    const hours = Number(formData.get("estimate_hours") || 0);
    const price = Number(formData.get("quoted_price") || 0);
    await supabase
      .from("change_requests")
      .update({ status: "awaiting_approval", estimate_hours: hours, quoted_price: price })
      .eq("id", id);
    await logAudit({
      action: "change_request.scoped",
      target: `change_request:${id}`,
      tenantId,
      metadata: { hours, price },
    });
  } else if (CR_NEXT[action]) {
    await supabase
      .from("change_requests")
      .update({ status: CR_NEXT[action] })
      .eq("id", id);
    await logAudit({
      action: `change_request.${CR_NEXT[action]}`,
      target: `change_request:${id}`,
      tenantId,
    });
  }
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function uploadDoc(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const kind = String(formData.get("kind") || "asset");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const supabase = await createClient();
  const res = await uploadDeliverable(supabase, {
    tenantId,
    projectId,
    kind,
    fileName: file.name,
    body: await file.arrayBuffer(),
    contentType: file.type || undefined,
  });
  if (res.ok)
    await logAudit({
      action: "document.uploaded",
      target: `project:${projectId}`,
      tenantId,
      metadata: { path: res.path },
    });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function generateInvoice(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("project_items")
    .select("name, amount")
    .eq("project_id", projectId);
  const lines = (items ?? []) as { name: string; amount: number }[];
  if (lines.length === 0) return;
  const total = lines.reduce((s, l) => s + Number(l.amount), 0);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      project_id: projectId,
      type: "build_milestone",
      amount: total,
      status: "draft",
      project_item_count: lines.length,
    })
    .select("id")
    .single();
  if (error || !invoice) {
    console.error("generateInvoice:", error?.message);
    return;
  }
  await supabase.from("invoice_items").insert(
    lines.map((l) => ({
      invoice_id: invoice.id,
      tenant_id: tenantId,
      name: l.name,
      amount: l.amount,
      quantity: 1,
    }))
  );

  // Send via Stripe to the client's email (the client_admin on this tenant).
  const service = createServiceClient();
  const { data: membership } = await service
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "client_admin")
    .limit(1)
    .maybeSingle();
  let email: string | null = null;
  if (membership?.user_id) {
    const { data: u } = await service.auth.admin.getUserById(membership.user_id);
    email = u.user?.email ?? null;
  }

  if (email) {
    try {
      const stripeInv = await createItemisedStripeInvoice({
        customerEmail: email,
        items: lines.map((l) => ({
          name: l.name,
          amountPence: Math.round(Number(l.amount) * 100),
        })),
      });
      if (stripeInv) {
        await supabase
          .from("invoices")
          .update({
            status: "open",
            stripe_invoice_id: stripeInv.id,
            hosted_invoice_url: stripeInv.url,
          })
          .eq("id", invoice.id);
      } else {
        await supabase.from("invoices").update({ status: "open" }).eq("id", invoice.id);
      }
    } catch (e) {
      console.error("Stripe invoice send failed:", e);
      await supabase.from("invoices").update({ status: "open" }).eq("id", invoice.id);
    }
  } else {
    await supabase.from("invoices").update({ status: "open" }).eq("id", invoice.id);
  }

  await logAudit({
    action: "invoice.generated",
    target: `project:${projectId}`,
    tenantId,
    metadata: { total, lines: lines.length },
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function bookCall(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "") || null;
  const date = String(formData.get("call_date") || "");
  const time = String(formData.get("call_time") || "");
  if (!tenantId || !date || !time) return;
  const supabase = await createClient();
  await supabase.from("calls").insert({
    tenant_id: tenantId,
    project_id: projectId,
    call_date: date,
    call_time: time,
    duration_min: 30,
    status: "confirmed",
  });
  await logAudit({ action: "call.booked", target: `tenant:${tenantId}`, tenantId });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function cancelCall(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  await supabase.from("calls").update({ status: "cancelled" }).eq("id", id);
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function saveMeeting(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  await supabase
    .from("calls")
    .update({
      meeting_link: String(formData.get("meeting_link") || "") || null,
      meeting_id: String(formData.get("meeting_id") || "") || null,
      meeting_password: String(formData.get("meeting_password") || "") || null,
    })
    .eq("id", id);
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function recordDpa(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;
  const supabase = await createClient();
  await supabase
    .from("compliance_records")
    .insert({ tenant_id: tenantId, kind: "dpa_signed", detail: { via: "admin" } });
  await logAudit({
    action: "compliance.dpa_signed",
    target: `tenant:${tenantId}`,
    tenantId,
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function addSubscription(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const plan = String(formData.get("plan") || "");
  if (!tenantId || !(plan in PLAN_MRR)) return;
  const supabase = await createClient();
  await supabase.from("subscriptions").insert({
    tenant_id: tenantId,
    plan,
    mrr: PLAN_MRR[plan],
    status: "active",
    started_at: new Date().toISOString(),
  });
  await logAudit({
    action: "subscription.added",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { plan, mrr: PLAN_MRR[plan] },
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function cancelSubscription(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  await supabase.from("subscriptions").update({ status: "cancelled" }).eq("id", id);
  revalidatePath(`/admin/clients/${tenantId}`);
}

/** Create the client's portal login: an auth user + a client_admin membership on
 *  this tenant. Idempotent — reuses an existing auth user with the same email. */
async function createPortalAccount(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  if (!tenantId || !email || password.length < 8) return;
  const service = createServiceClient();

  // Create the auth user, or find the existing one with this email.
  let userId: string | null = null;
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
  } else if (error) {
    const { data: list } = await service.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }
  if (!userId) {
    console.error("createPortalAccount: could not resolve user for", email);
    return;
  }

  // Link as a client_admin member of this tenant (idempotent).
  const { data: existing } = await service
    .from("memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .limit(1);
  if (!existing?.length) {
    await service
      .from("memberships")
      .insert({ tenant_id: tenantId, user_id: userId, role: "client_admin" });
  }
  await logAudit({
    action: "portal.account_created",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { email },
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

// ── UI helpers ─────────────────────────────────────────────────
const tone: Record<string, string> = {
  draft: T.muted,
  sent: T.warning,
  accepted: T.primary,
  declined: T.danger,
  submitted: T.info,
  triaged: T.info,
  scoped: T.warning,
  awaiting_approval: T.warning,
  approved: T.primary,
  in_progress: T.primary,
  review: T.warning,
  shipped: T.success,
  rejected: T.danger,
  paid: T.success,
  open: T.warning,
  proposed: T.muted,
  built: T.success,
  active: T.success,
  cancelled: T.muted,
  confirmed: T.primary,
};
function Badge({ s }: { s: string }) {
  const c = tone[s] ?? T.muted;
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "10px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: c,
        background: `${c}14`,
        border: `1px solid ${c}40`,
        borderRadius: 999,
        padding: "2px 8px",
      }}
    >
      {s.replace(/_/g, " ")}
    </span>
  );
}
const card = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.r.lg,
  padding: "18px 20px",
  marginBottom: 16,
} as const;
const h2 = {
  fontFamily: T.display,
  fontWeight: 600,
  fontSize: "1.05rem",
  color: T.fg,
  marginBottom: 12,
} as const;
const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 32,
  padding: "0 10px",
  background: T.bg,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
} as const;
const btn = (bg: string, fg: string) => ({
  fontFamily: T.mono,
  fontSize: "11px",
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  height: 32,
  paddingInline: 12,
  background: bg,
  color: fg,
  border: bg === "transparent" ? `1px solid ${T.border}` : "none",
  borderRadius: 6,
  cursor: "pointer",
});

export default async function ClientHub({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "id, name, type, vertical, status, contact_name, contact_email, contact_phone, notes"
    )
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) notFound();
  const t = tenant as unknown as {
    id: string;
    name: string;
    vertical: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
  };

  // Primary project (most recent). Tenant-scoped sections work without one.
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, stage, proposal_status")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  const project = (projects ?? [])[0] as
    | { id: string; name: string; stage: string; proposal_status: string }
    | undefined;
  const projectId = project?.id ?? null;

  // Tenant-scoped data (always loaded).
  const [{ data: call }, { data: subs }, { data: compliance }, { data: membership }] =
    await Promise.all([
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
        .from("subscriptions")
        .select("id, plan, mrr, status")
        .eq("tenant_id", tenantId)
        .eq("status", "active"),
      supabase
        .from("compliance_records")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "dpa_signed")
        .limit(1),
      supabase
        .from("memberships")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("role", "client_admin")
        .limit(1),
    ]);
  const theCall = (call as Call) ?? null;
  const subList = (subs ?? []) as Sub[];
  const dpaSigned = (compliance ?? []).length > 0;
  const hasPortal = (membership ?? []).length > 0;

  // Project-scoped data (only when a project exists).
  let itemList: Item[] = [];
  let crList: CR[] = [];
  let noteList: Note[] = [];
  let docList: Doc[] = [];
  let invoiceList: Invoice[] = [];
  if (projectId) {
    const [
      { data: items },
      { data: crs },
      { data: notes },
      { data: docs },
      { data: invs },
    ] = await Promise.all([
      supabase
        .from("project_items")
        .select("id, name, amount, status")
        .eq("project_id", projectId)
        .order("created_at"),
      supabase
        .from("change_requests")
        .select("id, description, status, estimate_hours, quoted_price")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_notes")
        .select("id, body, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("id, kind, storage_path, version")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, amount, status, hosted_invoice_url, project_item_count, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
    itemList = (items ?? []) as Item[];
    crList = (crs ?? []) as CR[];
    noteList = (notes ?? []) as Note[];
    docList = (docs ?? []) as Doc[];
    invoiceList = (invs ?? []) as Invoice[];
  }
  const total = itemList.reduce((s, i) => s + Number(i.amount), 0);
  const mrr = subList.reduce((s, x) => s + Number(x.mrr), 0);

  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;
  const hpid = projectId ? (
    <input type="hidden" name="project_id" value={projectId} />
  ) : null;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <Link
        href="/admin/clients"
        style={{
          fontFamily: T.mono,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.muted,
          textDecoration: "none",
        }}
      >
        ← Clients
      </Link>

      {/* Header */}
      <div
        className="flex items-end justify-between flex-wrap gap-3"
        style={{ marginTop: 12, marginBottom: 18 }}
      >
        <div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1.9rem",
              color: T.fg,
            }}
          >
            {t.name}
          </h1>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: T.muted,
              marginTop: 2,
            }}
          >
            {[t.contact_name, t.contact_email, t.contact_phone, t.vertical]
              .filter(Boolean)
              .join(" · ") || "No contact details yet"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {project && <Badge s={project.stage} />}
          {project && <Badge s={project.proposal_status} />}
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: dpaSigned ? T.success : T.danger,
              border: `1px solid ${dpaSigned ? T.success : T.danger}40`,
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            {dpaSigned ? "DPA signed" : "DPA pending"}
          </span>
          {project && (
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
              <button type="submit" style={btn(T.surface2, T.fg)}>
                Set stage
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Book Call */}
      <section style={card}>
        <h2 style={h2}>Discovery / project call</h2>
        {theCall ? (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.fg }}>
                {new Date(theCall.call_date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                <span
                  style={{ color: T.primary, fontFamily: T.mono, fontSize: "0.82rem" }}
                >
                  {theCall.call_time} · {theCall.duration_min} min
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge s={theCall.status} />
                <form action={cancelCall}>
                  {htid}
                  <input type="hidden" name="id" value={theCall.id} />
                  <button type="submit" style={btn("transparent", T.danger)}>
                    Cancel
                  </button>
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
                  color: T.primary,
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
                borderTop: `1px solid ${T.border}`,
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
              <button type="submit" style={btn(T.surface2, T.fg)}>
                Save meeting
              </button>
            </form>
          </div>
        ) : (
          <form action={bookCall} className="flex items-center gap-2 flex-wrap">
            {htid}
            {hpid}
            <input
              name="call_date"
              type="date"
              required
              style={{ ...inp, colorScheme: "dark" }}
            />
            <input
              name="call_time"
              type="time"
              defaultValue="10:00"
              required
              style={{ ...inp, colorScheme: "dark" }}
            />
            <button type="submit" style={btn(T.primary, T.primaryFg)}>
              Book call
            </button>
          </form>
        )}
      </section>

      {/* No project yet → start one to unlock proposal/invoicing/etc. */}
      {!project && (
        <section style={card}>
          <h2 style={{ ...h2, marginBottom: 6 }}>Build project</h2>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.85rem",
              color: T.faint,
              marginBottom: 12,
            }}
          >
            Start the build project to unlock the proposal, change requests, invoicing and
            deliverables for this client.
          </p>
          <form action={ensureProject}>
            {htid}
            <input type="hidden" name="name" value={`${t.name} — build`} />
            <button type="submit" style={btn(T.primary, T.primaryFg)}>
              Start build project →
            </button>
          </form>
        </section>
      )}

      {project && (
        <>
          {/* Proposal / build modules */}
          <section style={card}>
            <div className="flex items-center justify-between">
              <h2 style={h2}>Proposal — build modules</h2>
              <span
                style={{
                  fontFamily: T.display,
                  fontWeight: 700,
                  fontSize: "1.3rem",
                  color: T.fg,
                }}
              >
                {gbp(total)}
              </span>
            </div>
            {itemList.length === 0 && (
              <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
                No modules yet. Add what the client wants built.
              </p>
            )}
            <div className="flex flex-col gap-1.5" style={{ marginBottom: 12 }}>
              {itemList.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between"
                  style={{ padding: "7px 0", borderTop: `1px solid ${T.border}` }}
                >
                  <span style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.fg }}>
                    {it.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.muted }}
                    >
                      {gbp(Number(it.amount))}
                    </span>
                    <form action={removeItem}>
                      {htid}
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        type="submit"
                        style={{
                          ...btn("transparent", T.faint),
                          height: 24,
                          paddingInline: 8,
                        }}
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
            <form
              action={addItem}
              className="flex items-center gap-2 flex-wrap"
              style={{ paddingTop: 12, borderTop: `1px solid ${T.border}` }}
            >
              {htid}
              {hpid}
              <input
                name="name"
                placeholder="Module (e.g. Booking system)"
                required
                style={{ ...inp, width: 220 }}
              />
              <input
                name="amount"
                type="number"
                step="1"
                placeholder="£"
                required
                style={{ ...inp, width: 90 }}
              />
              <button type="submit" style={btn(T.surface2, T.fg)}>
                + Add
              </button>
            </form>
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
              {CATALOG.map((m) => (
                <form key={m.key} action={addItem}>
                  {htid}
                  {hpid}
                  <input type="hidden" name="name" value={m.name} />
                  <input type="hidden" name="amount" value={m.price} />
                  <button
                    type="submit"
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      height: 24,
                      paddingInline: 8,
                      background: "transparent",
                      color: T.muted,
                      border: `1px solid ${T.border}`,
                      borderRadius: 5,
                      cursor: "pointer",
                    }}
                  >
                    + {m.name} {gbp(m.price)}
                  </button>
                </form>
              ))}
            </div>
            {itemList.length > 0 && project.proposal_status === "draft" && (
              <form action={sendProposal} style={{ marginTop: 14 }}>
                {htid}
                {hpid}
                <button type="submit" style={btn(T.primary, T.primaryFg)}>
                  Send proposal to client →
                </button>
              </form>
            )}
            {project.proposal_status === "sent" && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.warning,
                  marginTop: 12,
                }}
              >
                Sent — awaiting the client&apos;s acceptance + DPA in their portal.
              </p>
            )}
            {project.proposal_status === "accepted" && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.primary,
                  marginTop: 12,
                }}
              >
                Accepted by the client ✓
              </p>
            )}
          </section>

          {/* Invoice */}
          <section style={card}>
            <div className="flex items-center justify-between">
              <h2 style={{ ...h2, marginBottom: 0 }}>Invoice</h2>
              <form action={generateInvoice}>
                {htid}
                {hpid}
                <button type="submit" style={btn(T.primary, T.primaryFg)}>
                  Generate &amp; send itemised invoice
                </button>
              </form>
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.faint,
                margin: "6px 0 12px",
              }}
            >
              Compiles the build modules above into an itemised Stripe invoice and emails
              the client a payment link.
            </p>
            {invoiceList.length === 0 ? (
              <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
                No invoices yet.
              </p>
            ) : (
              invoiceList.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between"
                  style={{ padding: "8px 0", borderTop: `1px solid ${T.border}` }}
                >
                  <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.fg }}>
                    {gbp(Number(inv.amount))}{" "}
                    <span style={{ color: T.faint, fontFamily: T.mono, fontSize: 11 }}>
                      · {inv.project_item_count ?? 0} items
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <Badge s={inv.status} />
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          color: T.primary,
                          textDecoration: "none",
                        }}
                      >
                        payment link ↗
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Change requests */}
          <section style={card}>
            <h2 style={h2}>Build edits (change requests)</h2>
            {crList.length === 0 && (
              <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
                None — the client submits these from their portal.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {crList.map((cr) => (
                <div
                  key={cr.id}
                  style={{
                    background: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p style={{ fontFamily: T.sans, fontSize: "0.86rem", color: T.fg }}>
                      {cr.description}
                    </p>
                    <Badge s={cr.status} />
                  </div>
                  {(cr.estimate_hours != null || cr.quoted_price != null) && (
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 11,
                        color: T.muted,
                        marginTop: 5,
                      }}
                    >
                      {cr.estimate_hours != null && <>est {cr.estimate_hours}h</>}
                      {cr.quoted_price != null && <> · £{cr.quoted_price}</>}
                    </div>
                  )}
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    style={{ marginTop: 8 }}
                  >
                    {cr.status === "submitted" && (
                      <form action={advanceCr}>
                        {htid}
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="action" value="triage" />
                        <button style={btn(T.surface2, T.fg)}>Triage</button>
                      </form>
                    )}
                    {(cr.status === "triaged" || cr.status === "submitted") && (
                      <form action={advanceCr} className="flex items-center gap-1.5">
                        {htid}
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="action" value="scope" />
                        <input
                          name="estimate_hours"
                          type="number"
                          step="0.5"
                          placeholder="hrs"
                          required
                          style={{ ...inp, width: 64, height: 28 }}
                        />
                        <input
                          name="quoted_price"
                          type="number"
                          step="1"
                          placeholder="£"
                          required
                          style={{ ...inp, width: 70, height: 28 }}
                        />
                        <button style={btn(T.warning, "#1a1300")}>Scope →</button>
                      </form>
                    )}
                    {CR_NEXT[cr.status] && (
                      <form action={advanceCr}>
                        {htid}
                        <input type="hidden" name="id" value={cr.id} />
                        <input type="hidden" name="action" value={cr.status} />
                        <button style={btn(T.primary, T.primaryFg)}>
                          Move to {CR_NEXT[cr.status].replace(/_/g, " ")}
                        </button>
                      </form>
                    )}
                    {cr.status === "awaiting_approval" && (
                      <span
                        style={{ fontFamily: T.mono, fontSize: 11, color: T.warning }}
                      >
                        waiting on client approval
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Deliverables */}
          <section style={card}>
            <h2 style={h2}>Deliverables</h2>
            {docList.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2"
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.muted,
                  padding: "2px 0",
                }}
              >
                <span style={{ color: T.primary }}>v{d.version}</span>
                <span style={{ color: T.faint }}>{d.kind}</span>
                <span>{d.storage_path.split("/").pop()}</span>
              </div>
            ))}
            <form
              action={uploadDoc}
              className="flex items-center gap-2 flex-wrap"
              style={{ marginTop: 10 }}
            >
              {htid}
              {hpid}
              <select name="kind" defaultValue="asset" style={{ ...inp, width: 110 }}>
                <option value="asset">asset</option>
                <option value="brief">brief</option>
                <option value="contract">contract</option>
                <option value="consent">consent</option>
              </select>
              <input
                type="file"
                name="file"
                required
                style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}
              />
              <button type="submit" style={btn(T.surface2, T.fg)}>
                Upload
              </button>
            </form>
          </section>

          {/* Notes */}
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
              <button type="submit" style={btn(T.surface2, T.fg)}>
                Add note
              </button>
            </form>
            <div className="flex flex-col gap-2">
              {noteList.map((n) => (
                <div
                  key={n.id}
                  style={{ padding: "8px 0", borderTop: `1px solid ${T.border}` }}
                >
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      color: T.faint,
                      marginBottom: 3,
                    }}
                  >
                    {new Date(n.created_at).toLocaleString("en-GB")}
                  </div>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      color: T.fg,
                      lineHeight: 1.5,
                    }}
                  >
                    {n.body}
                  </p>
                </div>
              ))}
              {noteList.length === 0 && (
                <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.faint }}>
                  No notes yet.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      {/* DPA / compliance */}
      <section style={card}>
        <h2 style={h2}>Data Processing Agreement</h2>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.85rem",
            color: T.muted,
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          The client signs the DPA when they accept the proposal in their portal. Record
          it here if it was signed offline — a project cannot go <b>live</b> until a DPA
          is logged.
        </p>
        {dpaSigned ? (
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.success }}>
            ✓ DPA signed — logged for this client.
          </span>
        ) : (
          <form action={recordDpa}>
            {htid}
            <button type="submit" style={btn(T.surface2, T.fg)}>
              Record DPA as signed
            </button>
          </form>
        )}
      </section>

      {/* Care subscriptions */}
      <section style={card}>
        <div className="flex items-center justify-between">
          <h2 style={{ ...h2, marginBottom: 0 }}>Care subscription</h2>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.primary }}>
            {gbp(mrr)}/mo MRR
          </span>
        </div>
        <div className="flex flex-col gap-1.5" style={{ margin: "12px 0" }}>
          {subList.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between"
              style={{ padding: "7px 0", borderTop: `1px solid ${T.border}` }}
            >
              <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.fg }}>
                {PLANS.find((p) => p.id === s.plan)?.label ?? s.plan}{" "}
                <span style={{ color: T.muted, fontFamily: T.mono, fontSize: 11 }}>
                  {gbp(Number(s.mrr))}/mo
                </span>
              </span>
              <form action={cancelSubscription}>
                {htid}
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" style={btn("transparent", T.danger)}>
                  Cancel
                </button>
              </form>
            </div>
          ))}
          {subList.length === 0 && (
            <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.faint }}>
              No active subscription.
            </p>
          )}
        </div>
        <form action={addSubscription} className="flex items-center gap-2">
          {htid}
          <select name="plan" defaultValue="care_basic" style={{ ...inp, width: 160 }}>
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — £{p.mrr}/mo
              </option>
            ))}
          </select>
          <button type="submit" style={btn(T.surface2, T.fg)}>
            Add subscription
          </button>
        </form>
      </section>

      {/* Portal access */}
      <section style={card}>
        <h2 style={h2}>Client portal access</h2>
        {hasPortal ? (
          <p style={{ fontFamily: T.mono, fontSize: 12, color: T.success }}>
            ✓ Portal login enabled{t.contact_email ? ` for ${t.contact_email}` : ""}. The
            client can sign in at /portal to see their proposal, requests and
            deliverables.
          </p>
        ) : (
          <>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.85rem",
                color: T.muted,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              Create the client&apos;s portal login. They&apos;ll be able to sign in at
              /portal to accept the proposal, submit change requests and download
              deliverables.
            </p>
            <form
              action={createPortalAccount}
              className="flex items-center gap-2 flex-wrap"
            >
              {htid}
              <input
                name="email"
                type="email"
                required
                placeholder="client@email.com"
                defaultValue={t.contact_email ?? ""}
                style={{ ...inp, width: 230 }}
              />
              <input
                name="password"
                type="text"
                required
                minLength={8}
                placeholder="Temp password (8+ chars)"
                style={{ ...inp, width: 200 }}
              />
              <button type="submit" style={btn(T.primary, T.primaryFg)}>
                Create portal login
              </button>
            </form>
          </>
        )}
      </section>

      {t.notes && (
        <section style={card}>
          <h2 style={h2}>Lead context</h2>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.86rem",
              color: T.muted,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {t.notes}
          </p>
        </section>
      )}
    </div>
  );
}
