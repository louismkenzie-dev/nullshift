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
 * Project detail — the hub for one client build. The whole lifecycle attaches
 * here: the itemised PROPOSAL (build modules), change requests (build edits the
 * client suggests), a notes timeline + stage status, deliverables, and an
 * itemised INVOICE generated from the build modules and sent to collect payment.
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

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const STAGES = ["discovery", "build", "review", "live", "care"];
const CR_NEXT: Record<string, string> = {
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};

// Build modules for one-click add — shared with the public Build Blueprint
// generator (@nullshift/content/catalog) so the proposal and the lead magnet
// never drift on scope or price.

// ── server actions ─────────────────────────────────────────────
async function addItem(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
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
  revalidatePath(`/admin/delivery/${projectId}`);
}

async function removeItem(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("project_id") || "");
  const supabase = await createClient();
  await supabase.from("project_items").delete().eq("id", id);
  revalidatePath(`/admin/delivery/${projectId}`);
}

async function sendProposal(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ proposal_status: "sent", proposal_sent_at: new Date().toISOString() })
    .eq("id", projectId);
  await logAudit({ action: "proposal.sent", target: `project:${projectId}`, tenantId });
  revalidatePath(`/admin/delivery/${projectId}`);
}

async function setStage(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
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
  revalidatePath(`/admin/delivery/${projectId}`);
}

async function addNote(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const body = String(formData.get("body") || "").trim();
  if (!projectId || !body) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("project_notes").insert({
    project_id: projectId,
    tenant_id: tenantId,
    body,
    author: user?.id ?? null,
  });
  revalidatePath(`/admin/delivery/${projectId}`);
}

async function advanceCr(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
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
  revalidatePath(`/admin/delivery/${projectId}`);
}

async function uploadDoc(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
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
  revalidatePath(`/admin/delivery/${projectId}`);
}

async function generateInvoice(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
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
  revalidatePath(`/admin/delivery/${projectId}`);
}

// ── UI ─────────────────────────────────────────────────────────
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

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id, name, stage, build_fee, proposal_status, tenants(name)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  const p = project as unknown as {
    id: string;
    tenant_id: string;
    name: string;
    stage: string;
    proposal_status: string;
    tenants: { name: string } | null;
  };
  const tenantId = p.tenant_id;

  const [
    { data: items },
    { data: crs },
    { data: notes },
    { data: docs },
    { data: invoices },
    { data: compliance },
  ] = await Promise.all([
    supabase
      .from("project_items")
      .select("id, name, amount, status")
      .eq("project_id", id)
      .order("sort")
      .order("created_at"),
    supabase
      .from("change_requests")
      .select("id, description, status, estimate_hours, quoted_price")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_notes")
      .select("id, body, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, kind, storage_path, version")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, amount, status, hosted_invoice_url, project_item_count, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("compliance_records")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kind", "dpa_signed")
      .limit(1),
  ]);
  const itemList = (items ?? []) as Item[];
  const crList = (crs ?? []) as CR[];
  const noteList = (notes ?? []) as Note[];
  const docList = (docs ?? []) as Doc[];
  const invoiceList = (invoices ?? []) as Invoice[];
  const dpaSigned = (compliance ?? []).length > 0;
  const total = itemList.reduce((s, i) => s + Number(i.amount), 0);

  const hid = <input type="hidden" name="project_id" value={id} />;
  const htid = <input type="hidden" name="tenant_id" value={tenantId} />;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <Link
        href="/admin/delivery"
        style={{
          fontFamily: T.mono,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.muted,
          textDecoration: "none",
        }}
      >
        ← Delivery
      </Link>

      {/* Header */}
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ marginTop: 12, marginBottom: 18 }}
      >
        <div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: T.faint,
              letterSpacing: "0.06em",
            }}
          >
            {p.tenants?.name ?? "Client"}
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "1.7rem",
              color: T.fg,
            }}
          >
            {p.name}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge s={p.stage} />
          <Badge s={p.proposal_status} />
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
          <form action={setStage} className="flex items-center gap-1">
            {hid}
            {htid}
            <select name="stage" defaultValue={p.stage} style={{ ...inp, height: 28 }}>
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
        </div>
      </div>

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
                <span style={{ fontFamily: T.mono, fontSize: "0.85rem", color: T.muted }}>
                  {gbp(Number(it.amount))}
                </span>
                <form action={removeItem}>
                  {hid}
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
          {hid}
          {htid}
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
              {hid}
              {htid}
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
        {itemList.length > 0 && p.proposal_status === "draft" && (
          <form action={sendProposal} style={{ marginTop: 14 }}>
            {hid}
            {htid}
            <button type="submit" style={btn(T.primary, T.primaryFg)}>
              Send proposal to client →
            </button>
          </form>
        )}
        {p.proposal_status === "sent" && (
          <p
            style={{ fontFamily: T.mono, fontSize: 11, color: T.warning, marginTop: 12 }}
          >
            Sent — awaiting the client&apos;s acceptance + DPA in their portal.
          </p>
        )}
        {p.proposal_status === "accepted" && (
          <p
            style={{ fontFamily: T.mono, fontSize: 11, color: T.primary, marginTop: 12 }}
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
            {hid}
            {htid}
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
          Compiles the build modules above into an itemised Stripe invoice and emails the
          client a payment link.
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

      {/* Change requests (build edits) */}
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
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
                {cr.status === "submitted" && (
                  <form action={advanceCr}>
                    {hid}
                    {htid}
                    <input type="hidden" name="id" value={cr.id} />
                    <input type="hidden" name="action" value="triage" />
                    <button style={btn(T.surface2, T.fg)}>Triage</button>
                  </form>
                )}
                {(cr.status === "triaged" || cr.status === "submitted") && (
                  <form action={advanceCr} className="flex items-center gap-1.5">
                    {hid}
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
                    {hid}
                    {htid}
                    <input type="hidden" name="id" value={cr.id} />
                    <input type="hidden" name="action" value={cr.status} />
                    <button style={btn(T.primary, T.primaryFg)}>
                      Move to {CR_NEXT[cr.status].replace(/_/g, " ")}
                    </button>
                  </form>
                )}
                {cr.status === "awaiting_approval" && (
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: T.warning }}>
                    waiting on client approval
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section style={card}>
        <h2 style={h2}>Notes</h2>
        <form
          action={addNote}
          className="flex items-center gap-2"
          style={{ marginBottom: 12 }}
        >
          {hid}
          {htid}
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

      {/* Deliverables */}
      <section style={card}>
        <h2 style={h2}>Deliverables</h2>
        {docList.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2"
            style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, padding: "2px 0" }}
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
          {hid}
          {htid}
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
    </div>
  );
}
