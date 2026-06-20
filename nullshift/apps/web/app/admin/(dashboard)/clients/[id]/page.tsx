import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { uploadDeliverable } from "@nullshift/db/documents";
import { CATALOG } from "@nullshift/content/catalog";
import { T } from "@nullshift/ui/tokens";
import { clientRef } from "@nullshift/ui/format";
import { CARE_PLANS, CARE_PLAN_MRR, carePlan } from "@/lib/carePlans";
import { generateProjectInvoice } from "@/lib/projectInvoice";
import { getStripe } from "@nullshift/billing/stripe";
import { sendEmail } from "@/lib/sendEmail";
import {
  portalReadyEmail,
  documentsReadyEmail,
  portalAccessEmail,
  passwordResetEmail,
} from "@/lib/clientEmails";
import { ProposalDocsForm } from "@/components/admin/ProposalDocsForm";
import { dpaReadyToSend } from "@/lib/dpa";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(
  /\/$/,
  ""
);

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
  paid_at: string | null;
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
/** Time-of-day the client picked when booking → a readable label + a sensible
 *  default exact time to prefill (still confirmed with them). */
const TIME_BUCKETS: Record<string, { label: string; time: string }> = {
  morning: { label: "Morning (9am–12pm)", time: "09:00" },
  afternoon: { label: "Afternoon (12pm–5pm)", time: "13:00" },
  evening: { label: "Evening (5pm–8pm)", time: "17:00" },
};
const CR_NEXT: Record<string, string> = {
  approved: "in_progress",
  in_progress: "review",
  review: "shipped",
};

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

async function setProposedPlan(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const plan = String(formData.get("plan") || "");
  if (!projectId) return;
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ proposed_plan: plan || null })
    .eq("id", projectId);
  revalidatePath(`/admin/clients/${tenantId}`);
}

/**
 * Save the proposal document + DPA detail fields. When the proposal is still a
 * draft AND everything required is complete (modules, care plan, overview,
 * payment terms, DPA processing details), also mark it sent + email the client
 * that their documents are ready to review and sign in the portal. Editing the
 * fields again after sending just saves (it won't re-send).
 */
async function saveDocsAndSend(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!projectId) return;
  const str = (k: string) => String(formData.get(k) || "").trim() || null;
  const supabase = await createClient();

  // Save only the proposal doc. ALL DPA fields — company identity, data types,
  // special category — are owned by the client (their portal declaration); we
  // never write them here, or a stale admin page could clobber what they entered.
  await supabase
    .from("projects")
    .update({
      overview: str("overview"),
      payment_terms: str("payment_terms"),
    })
    .eq("id", projectId);

  // Re-check completeness from the saved row (don't trust the client), then send
  // only out of a draft — and only once the client has submitted their DPA.
  const [{ data: project }, { data: items }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "proposal_status, proposed_plan, overview, payment_terms, client_entity_type, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at"
      )
      .eq("id", projectId)
      .maybeSingle(),
    supabase.from("project_items").select("id").eq("project_id", projectId).limit(1),
  ]);
  const complete =
    !!project &&
    (items?.length ?? 0) > 0 &&
    !!project.proposed_plan &&
    !!project.overview &&
    !!project.payment_terms &&
    dpaReadyToSend(project);

  if (project?.proposal_status === "draft" && complete) {
    await supabase
      .from("projects")
      .update({ proposal_status: "sent", proposal_sent_at: new Date().toISOString() })
      .eq("id", projectId);
    await logAudit({ action: "proposal.sent", target: `project:${projectId}`, tenantId });

    // Email the client their documents are ready to sign (best-effort).
    const service = createServiceClient();
    const { data: tenant } = await service
      .from("tenants")
      .select("contact_name, contact_email")
      .eq("id", tenantId)
      .maybeSingle();
    let to = tenant?.contact_email ?? null;
    const { data: membership } = await service
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "client_admin")
      .limit(1)
      .maybeSingle();
    if (membership?.user_id) {
      const { data: u } = await service.auth.admin.getUserById(membership.user_id);
      to = u.user?.email ?? to;
    }
    if (to) {
      const mail = documentsReadyEmail({
        name: tenant?.contact_name ?? "there",
        portalUrl: `${SITE_URL}/portal`,
      });
      await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    }
  }
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function setLiveUrl(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const url = String(formData.get("live_url") || "").trim();
  if (!projectId) return;
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ live_url: url || null })
    .eq("id", projectId);
  revalidatePath(`/admin/clients/${tenantId}`);
}

/** Post a progress update the client sees in their project hub. */
async function postUpdate(formData: FormData) {
  "use server";
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim() || null;
  if (!projectId || !title) return;
  const supabase = await createClient();
  await supabase.from("project_updates").insert({
    tenant_id: tenantId,
    project_id: projectId,
    type: "update",
    title,
    body,
  });
  await logAudit({
    action: "project_update.posted",
    target: `project:${projectId}`,
    tenantId,
  });
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
  await supabase.from("project_notes").insert({
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
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "");
  if (!tenantId || !projectId) return;
  // Only invoice an accepted proposal (the button is disabled until then, but
  // re-check server-side since a disabled button isn't a real guard).
  const service = createServiceClient();
  const { data: proj } = await service
    .from("projects")
    .select("proposal_status")
    .eq("id", projectId)
    .maybeSingle();
  if (proj?.proposal_status !== "accepted") return;
  const res = await generateProjectInvoice(service, {
    tenantId,
    projectId,
  });
  if (res.ok)
    await logAudit({
      action: "invoice.generated",
      target: `project:${projectId}`,
      tenantId,
      metadata: { total: res.total },
    });
  revalidatePath(`/admin/clients/${tenantId}`);
}

/**
 * Manual fallback: re-pull each unpaid Stripe invoice's status (so a missed
 * webhook never strands the "invested" total). Stripe invoice statuses map 1:1
 * onto ours (draft|open|paid|void|uncollectible).
 */
async function syncInvoiceStatus(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;
  const stripe = getStripe();
  if (!stripe) return;
  const service = createServiceClient();
  const { data: invs } = await service
    .from("invoices")
    .select("id, stripe_invoice_id, status")
    .eq("tenant_id", tenantId)
    .not("stripe_invoice_id", "is", null)
    .neq("status", "paid");
  const valid = ["draft", "open", "paid", "void", "uncollectible"];
  for (const inv of (invs ?? []) as { id: string; stripe_invoice_id: string }[]) {
    try {
      const si = await stripe.invoices.retrieve(inv.stripe_invoice_id);
      if (!si.status || !valid.includes(si.status)) continue;
      const patch: Record<string, unknown> = { status: si.status };
      if (si.status === "paid") {
        const paidAt = si.status_transitions?.paid_at;
        patch.paid_at = paidAt
          ? new Date(paidAt * 1000).toISOString()
          : new Date().toISOString();
      }
      await service.from("invoices").update(patch).eq("id", inv.id);
    } catch (e) {
      console.error("syncInvoiceStatus: retrieve failed", inv.stripe_invoice_id, e);
    }
  }
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
  // Confirming the call advances the originating lead to 'call_booked' — this is
  // the ONLY thing that moves them into that column (a call request alone keeps
  // them in 'qualified'). Won/lost leads aren't reopened.
  const { data: t } = await supabase
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  if (t?.contact_email) {
    await supabase
      .from("leads")
      .update({ status: "call_booked" })
      .ilike("email", t.contact_email)
      .neq("status", "won")
      .neq("status", "lost");
  }
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
  if (!tenantId || !(plan in CARE_PLAN_MRR)) return;
  const supabase = await createClient();
  await supabase.from("subscriptions").insert({
    tenant_id: tenantId,
    plan,
    mrr: CARE_PLAN_MRR[plan],
    status: "active",
    started_at: new Date().toISOString(),
  });
  await logAudit({
    action: "subscription.added",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { plan, mrr: CARE_PLAN_MRR[plan] },
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

async function cancelSubscription(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("id") || "");
  if (!id) return;
  const service = createServiceClient();
  // Cancel the REAL Stripe subscription first so billing actually stops, then
  // reflect it locally ('canceled' — the enum is American-spelled; the old
  // 'cancelled' was rejected and silently left the row active).
  const { data: sub } = await service
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("id", id)
    .maybeSingle();
  if (sub?.stripe_subscription_id) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (e) {
        console.error("stripe subscription cancel failed:", e);
      }
    }
  }
  const { error } = await service
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("id", id);
  if (error) console.error("cancelSubscription:", error.message);
  revalidatePath(`/admin/clients/${tenantId}`);
}

/**
 * Give the client portal access: an auth user + a client_admin membership.
 * Credential handling depends on the account's state, so we never clobber a
 * password the client chose themselves:
 *   • no account yet → create it with the reference password + email it.
 *   • account exists but never signed in (admin-issued, unused) → (re)set the
 *     reference password + email it.
 *   • account exists AND the client has already signed in → they have their own
 *     password; we only link membership and email a "sign in with your existing
 *     password" note — we NEVER reset it or expose a reference.
 */
async function createPortalAccount(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim() || "there";
  if (!tenantId || !email) return;
  const service = createServiceClient();
  const loginUrl = `${SITE_URL}/portal/login`;

  // Resolve any existing auth user with this email + whether they've signed in.
  const { data: list } = await service.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  const hasLoggedIn = !!existing?.last_sign_in_at;

  let userId: string | null = existing?.id ?? null;
  let credentials = false; // whether we set + email the reference password

  if (!existing) {
    if (password.length < 8) return;
    const { data: created } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    userId = created?.user?.id ?? null;
    credentials = true;
  } else if (!hasLoggedIn) {
    // Unused admin-issued account — (re)issue the reference password.
    if (password.length < 8) return;
    await service.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    credentials = true;
  }
  // else: client has their own password — link membership only, no reset.

  if (!userId) {
    console.error("createPortalAccount: could not resolve user for", email);
    return;
  }

  // Link as a client_admin member of this tenant (idempotent).
  const { data: member } = await service
    .from("memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .limit(1);
  if (!member?.length) {
    await service
      .from("memberships")
      .insert({ tenant_id: tenantId, user_id: userId, role: "client_admin" });
  }
  await logAudit({
    action: "portal.account_created",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { email, credentials },
  });

  const mail = credentials
    ? portalReadyEmail({ name, email, password, loginUrl })
    : portalAccessEmail({ name, loginUrl });
  await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });

  revalidatePath(`/admin/clients/${tenantId}`);
}

/**
 * Send the client a Nullshift-branded password-reset link. Used for clients who
 * have already signed in (so we can't re-issue a login) and forgotten their
 * password. We mint a Supabase recovery link and email it ourselves so the mail
 * stays on-brand; the link lands on /portal/reset where they set a new password.
 */
async function sendPasswordReset(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") || "").trim() || "there";
  if (!tenantId || !email) return;
  const service = createServiceClient();

  const { data, error } = await service.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${SITE_URL}/portal/reset` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    console.error("sendPasswordReset: generateLink failed:", error?.message);
    return;
  }
  const mail = passwordResetEmail({ name, resetUrl: link });
  await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  await logAudit({
    action: "portal.password_reset_sent",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { email },
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

/**
 * Permanently delete a client and ALL their data (GDPR right-to-erasure). Gated by
 * the admin re-typing the client's email. Hard-deletes the tenant (cascades every
 * project/proposal/invoice/document/update/task/membership) and removes the
 * client's portal login(s) that no longer belong to any tenant.
 */
async function deleteClient(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const typed = String(formData.get("confirm_email") || "")
    .trim()
    .toLowerCase();
  if (!tenantId) return;
  const service = createServiceClient();

  // Resolve the client's email(s): the contact email + each member's login.
  const { data: tenant } = await service
    .from("tenants")
    .select("contact_email")
    .eq("id", tenantId)
    .maybeSingle();
  const { data: members } = await service
    .from("memberships")
    .select("user_id")
    .eq("tenant_id", tenantId);
  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean) as string[];

  const emails = new Set<string>();
  if (tenant?.contact_email) emails.add(tenant.contact_email.trim().toLowerCase());
  for (const uid of userIds) {
    const { data: u } = await service.auth.admin.getUserById(uid);
    if (u.user?.email) emails.add(u.user.email.trim().toLowerCase());
  }
  // If the client has any email on record, require the typed confirmation to
  // match it exactly (case-insensitive). A client with NO email — e.g. one
  // converted from an emailless funnel lead — can't be email-confirmed, so the
  // plain Delete button in the danger zone is allowed through without it.
  if (emails.size > 0 && (!typed || !emails.has(typed))) {
    console.error("deleteClient: email confirmation did not match");
    return;
  }

  // Audit BEFORE the rows (and their audit entries) cascade away.
  await logAudit({
    action: "client.deleted",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { email: typed },
  });

  // Hard-delete the tenant — cascades to all its data + memberships.
  await service.from("tenants").delete().eq("id", tenantId);

  // Also clear the originating funnel lead(s) + enquiry(ies) for this client's
  // email(s). Converting a lead to a client doesn't consume the lead, so without
  // this the deleted client keeps showing on the pipeline / in the enquiries
  // inbox — and leaving them behind would be an incomplete erasure.
  for (const em of emails) {
    await service.from("leads").delete().ilike("email", em);
    await service.from("enquiries").delete().ilike("email", em);
  }

  // Remove the client's auth login(s). Resolve them BOTH ways: by membership
  // (userIds) AND by matching the client's email(s) to any auth account that was
  // never linked as a member — e.g. one created when they booked a call, before
  // an admin issued a portal login. Without the email pass, such an account is
  // orphaned on delete and blocks re-registering with that email.
  const authIds = new Set<string>(userIds);
  if (emails.size > 0) {
    const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) {
      if (u.email && emails.has(u.email.trim().toLowerCase())) authIds.add(u.id);
    }
  }
  // Delete each only if it no longer belongs to any tenant (don't nuke internal
  // staff or another client who still has a membership).
  for (const uid of authIds) {
    const { count } = await service
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);
    if (!count) {
      try {
        await service.auth.admin.deleteUser(uid);
      } catch (e) {
        console.error("deleteClient: deleteUser failed:", e);
      }
    }
  }

  redirect("/admin/clients");
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
  trialing: T.info,
  past_due: T.danger,
  incomplete: T.warning,
  canceled: T.muted,
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

  // Stage 1 — one batch keyed on the tenant id: the tenant, its projects, and
  // every tenant-scoped section. These only depend on the id, so they run in
  // parallel rather than as separate sequential round-trips.
  const [
    { data: tenant },
    { data: projects },
    { data: call },
    { data: subs },
    { data: compliance },
    { data: membership },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "id, name, type, vertical, status, contact_name, contact_email, contact_phone, notes"
      )
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select(
        "id, name, stage, proposal_status, proposed_plan, overview, payment_terms, client_entity_type, dpa_client_country, dpa_client_company_name, dpa_client_company_number, dpa_client_registered_address, dpa_personal_data, dpa_special_category, dpa_special_category_detail, dpa_client_submitted_at, accepted_name, accepted_at, live_url"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
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
      .select("id, user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "client_admin")
      .limit(1),
  ]);
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
  const project = (projects ?? [])[0] as
    | {
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
        live_url: string | null;
      }
    | undefined;
  const projectId = project?.id ?? null;
  const theCall = (call as Call) ?? null;
  const subList = (subs ?? []) as Sub[];
  const dpaSigned = (compliance ?? []).length > 0;
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
      const { data: list } = await portalSvc.auth.admin.listUsers();
      const found = list?.users.find(
        (x) => x.email?.toLowerCase() === t.contact_email!.toLowerCase()
      );
      if (found)
        portalUser = {
          email: found.email ?? t.contact_email,
          lastSignInAt: found.last_sign_in_at ?? null,
        };
    }
  }
  const portalLoggedIn = !!portalUser?.lastSignInAt;
  const portalEmail = portalUser?.email ?? t.contact_email ?? "";

  // Stage 2 — the project-scoped lists plus the preferred-slot lead lookup, all
  // in parallel (they depend on stage 1's project id / contact email). Slots
  // that don't apply resolve to an empty set so the batch shape stays stable.
  const noRows = Promise.resolve({ data: [] as Record<string, unknown>[] });
  const [
    { data: leadRows },
    { data: items },
    { data: crs },
    { data: notes },
    { data: docs },
    { data: invs },
  ] = await Promise.all([
    t.contact_email
      ? supabase
          .from("leads")
          .select("quiz_answers")
          .ilike("email", t.contact_email)
          .order("created_at", { ascending: false })
          .limit(10)
      : noRows,
    projectId
      ? supabase
          .from("project_items")
          .select("id, name, amount, status")
          .eq("project_id", projectId)
          .order("created_at")
      : noRows,
    projectId
      ? supabase
          .from("change_requests")
          .select("id, description, status, estimate_hours, quoted_price")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : noRows,
    projectId
      ? supabase
          .from("project_notes")
          .select("id, body, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : noRows,
    projectId
      ? supabase
          .from("documents")
          .select("id, kind, storage_path, version")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : noRows,
    projectId
      ? supabase
          .from("invoices")
          .select(
            "id, amount, status, hosted_invoice_url, project_item_count, created_at, paid_at"
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      : noRows,
  ]);

  // The client's preferred call slot, carried over from the lead they created
  // when they booked (stored on quiz_answers.requested_date/_time). Used to
  // prefill + annotate the call booking below — we still confirm the exact time.
  let preferredDate: string | null = null;
  let preferredTime: string | null = null;
  for (const lr of (leadRows ?? []) as { quiz_answers: unknown }[]) {
    const qa = (lr.quiz_answers ?? {}) as Record<string, unknown>;
    if (typeof qa.requested_date === "string" && qa.requested_date) {
      preferredDate = qa.requested_date;
      preferredTime = typeof qa.requested_time === "string" ? qa.requested_time : null;
      break;
    }
  }

  const itemList = (items ?? []) as Item[];
  const crList = (crs ?? []) as CR[];
  const noteList = (notes ?? []) as Note[];
  const docList = (docs ?? []) as Doc[];
  const invoiceList = (invs ?? []) as Invoice[];
  // Account rollup over the build invoice(s): invested = paid, outstanding =
  // still open. (Recurring care-plan fees are tracked separately via the
  // subscription status, not folded into the one-off build investment.)
  const invested = invoiceList
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = invoiceList
    .filter((i) => i.status === "open")
    .reduce((s, i) => s + Number(i.amount), 0);
  const hasStripeInvoice = invoiceList.some((i) => i.status !== "draft");
  const total = itemList.reduce((s, i) => s + Number(i.amount), 0);
  const mrr = subList.reduce((s, x) => s + Number(x.mrr), 0);

  // Gating: the documents can be sent once modules + a care plan + the proposal
  // doc + DPA processing details are all present; the invoice can be generated
  // once the client has signed (proposal accepted).
  const modulesComplete = itemList.length > 0;
  const planSelected = !!project?.proposed_plan;
  const isAccepted = project?.proposal_status === "accepted";
  // The active build invoice (ignore voided) + its lifecycle state, so the
  // button/card reads: generate → sent, awaiting payment → paid.
  const primaryInvoice = invoiceList.find((i) => i.status !== "void") ?? null;
  const invoicePaid = primaryInvoice?.status === "paid";
  const invoiceSent = !!primaryInvoice && !invoicePaid;
  // The client provides their DPA details in the portal; the docs can't be sent
  // until they have (drives the form gate + a header badge).
  const clientDpaReady = !!project && dpaReadyToSend(project);

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
            {t.name}{" "}
            <span
              title="Client reference"
              style={{
                fontFamily: T.mono,
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: "0.04em",
                color: T.muted,
                background: T.surface2,
                border: `1px solid ${T.border}`,
                borderRadius: 999,
                padding: "2px 9px",
                verticalAlign: "middle",
              }}
            >
              {clientRef(tenantId)}
            </span>
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
          {project && (
            <span
              title="Whether the client has submitted their DPA details in the portal"
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: clientDpaReady ? T.success : T.warning,
                border: `1px solid ${clientDpaReady ? T.success : T.warning}40`,
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {clientDpaReady ? "DPA details ✓" : "DPA details awaited"}
            </span>
          )}
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
          <>
            {preferredDate && (
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  color: T.muted,
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                Client&apos;s preferred slot:{" "}
                <b style={{ color: T.fg }}>
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
                  preferredTime ? (TIME_BUCKETS[preferredTime]?.time ?? "10:00") : "10:00"
                }
                style={{ ...inp, colorScheme: "dark" }}
              />
              <button type="submit" style={btn(T.primary, T.primaryFg)}>
                Book call
              </button>
            </form>
          </>
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
            {/* Ongoing care plan — part of the proposal the client accepts. */}
            <div
              className="flex items-center gap-2 flex-wrap"
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${T.border}`,
              }}
            >
              <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.fg }}>
                Ongoing care plan
              </span>
              <form action={setProposedPlan} className="flex items-center gap-2">
                {htid}
                {hpid}
                <select
                  name="plan"
                  defaultValue={project.proposed_plan ?? ""}
                  style={{ ...inp, width: 180 }}
                >
                  <option value="">No care plan</option>
                  {CARE_PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — £{p.mrr}/mo
                    </option>
                  ))}
                </select>
                <button type="submit" style={btn(T.surface2, T.fg)}>
                  Save plan
                </button>
              </form>
              {project.proposed_plan && (
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                  {carePlan(project.proposed_plan)?.label} · activates on acceptance
                </span>
              )}
            </div>
            {project.proposal_status === "draft" && (
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  color: T.faint,
                  marginTop: 12,
                }}
              >
                Add modules + a care plan here, then complete &amp; send the documents
                below.
              </p>
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

          {/* Proposal document + DPA details (authoring) */}
          <section style={card}>
            <div
              className="flex items-center justify-between flex-wrap gap-2"
              style={{ marginBottom: 4 }}
            >
              <h2 style={{ ...h2, marginBottom: 0 }}>
                Proposal document &amp; DPA details
              </h2>
              <Link
                href={`/admin/clients/${tenantId}/documents`}
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: T.primary,
                  textDecoration: "none",
                }}
              >
                View / download documents →
              </Link>
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.82rem",
                color: T.faint,
                marginTop: -6,
                marginBottom: 14,
              }}
            >
              Author the proposal here. The DPA details are provided by the client in
              their portal (status below) — the document ports them on automatically. You
              can send once the modules, care plan, this doc and the client&apos;s DPA
              details are all complete.
            </p>
            <ProposalDocsForm
              action={saveDocsAndSend}
              tenantId={tenantId}
              projectId={project.id}
              proposalStatus={project.proposal_status}
              modulesComplete={modulesComplete}
              planSelected={planSelected}
              clientDpaReady={clientDpaReady}
              clientSubmittedAt={project.dpa_client_submitted_at}
              entityType={project.client_entity_type}
              companyName={project.dpa_client_company_name}
              companyNumber={project.dpa_client_company_number}
              registeredAddress={project.dpa_client_registered_address}
              personalData={project.dpa_personal_data}
              specialCategory={project.dpa_special_category}
              specialCategoryDetail={project.dpa_special_category_detail}
              defaults={{
                overview: project.overview ?? "",
                paymentTerms: project.payment_terms ?? "",
              }}
            />
          </section>

          {/* Invoice */}
          <section style={card}>
            <div className="flex items-center justify-between">
              <h2 style={{ ...h2, marginBottom: 0 }}>Invoice</h2>
              {invoicePaid ? (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: T.success,
                    background: `${T.success}14`,
                    border: `1px solid ${T.success}55`,
                    borderRadius: 999,
                    padding: "7px 14px",
                  }}
                >
                  Paid ✓
                </span>
              ) : invoiceSent ? (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: T.warning,
                    background: `${T.warning}14`,
                    border: `1px solid ${T.warning}55`,
                    borderRadius: 999,
                    padding: "7px 14px",
                  }}
                >
                  Invoice sent — awaiting payment
                </span>
              ) : (
                <form action={generateInvoice}>
                  {htid}
                  {hpid}
                  <button
                    type="submit"
                    disabled={!isAccepted}
                    style={{
                      ...btn(
                        isAccepted ? T.primary : T.surface2,
                        isAccepted ? T.primaryFg : T.faint
                      ),
                      border: isAccepted ? "none" : `1px solid ${T.border}`,
                      cursor: isAccepted ? "pointer" : "not-allowed",
                      opacity: isAccepted ? 1 : 0.7,
                    }}
                  >
                    Generate &amp; send itemised invoice
                  </button>
                </form>
              )}
            </div>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.faint,
                margin: "6px 0 12px",
              }}
            >
              {invoicePaid
                ? "The client has paid this invoice — it's recorded against their account below."
                : invoiceSent
                  ? "Sent to the client — they've been emailed a Stripe payment link. This flips to Paid automatically once the payment goes through."
                  : isAccepted
                    ? "Compiles the build modules above into an itemised Stripe invoice and emails the client a payment link."
                    : "Available once the client has signed the proposal. An invoice is drafted automatically on signing."}
            </p>
            {invoiceList.length > 0 && (
              <div
                className="flex items-center justify-between flex-wrap gap-2"
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                }}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <span
                    style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}
                  >
                    Invested{" "}
                    <strong style={{ color: T.primary, fontFamily: T.mono }}>
                      {gbp(invested)}
                    </strong>
                  </span>
                  {outstanding > 0 && (
                    <span
                      style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}
                    >
                      Outstanding{" "}
                      <strong style={{ color: T.warning, fontFamily: T.mono }}>
                        {gbp(outstanding)}
                      </strong>
                    </span>
                  )}
                </div>
                {hasStripeInvoice && (
                  <form action={syncInvoiceStatus}>
                    {htid}
                    <button
                      type="submit"
                      title="Re-pull payment status from Stripe (fallback if a webhook was missed)"
                      style={{
                        fontFamily: T.mono,
                        fontSize: 10,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: T.muted,
                        background: "transparent",
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        padding: "5px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Sync from Stripe
                    </button>
                  </form>
                )}
              </div>
            )}
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
                    {inv.status === "paid" && inv.paid_at && (
                      <span
                        style={{ fontFamily: T.mono, fontSize: 10, color: T.success }}
                      >
                        paid {new Date(inv.paid_at).toLocaleDateString("en-GB")}
                      </span>
                    )}
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

          {/* Live site + client-facing updates */}
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
              <button type="submit" style={btn(T.surface2, T.fg)}>
                Save live link
              </button>
            </form>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.8rem",
                color: T.faint,
                marginBottom: 10,
              }}
            >
              Post a progress update the client sees on their project page.
            </p>
            <form action={postUpdate} className="flex flex-col gap-2">
              {htid}
              {hpid}
              <input
                name="title"
                required
                placeholder="Update title (e.g. Homepage design ready for review)"
                style={inp}
              />
              <textarea
                name="body"
                rows={2}
                placeholder="Details (optional)"
                style={{
                  ...inp,
                  height: "auto",
                  padding: "8px 10px",
                  resize: "vertical",
                }}
              />
              <button type="submit" className="self-start" style={btn(T.surface2, T.fg)}>
                Post update
              </button>
            </form>
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
                {carePlan(s.plan)?.label ?? s.plan}{" "}
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
            {CARE_PLANS.map((p) => (
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
                color: T.muted,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              They sign in with their own password — we never reset or display it.
              {!hasPortal ? " Grant them access to this client's project below." : ""} If
              they&apos;ve forgotten it, send a branded reset link.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {!hasPortal && (
                <form action={createPortalAccount}>
                  {htid}
                  <input type="hidden" name="name" value={t.contact_name ?? t.name} />
                  <input type="hidden" name="email" value={portalEmail} />
                  <button type="submit" style={btn(T.primary, T.primaryFg)}>
                    Grant portal access
                  </button>
                </form>
              )}
              <form action={sendPasswordReset}>
                {htid}
                <input type="hidden" name="name" value={t.contact_name ?? t.name} />
                <input type="hidden" name="email" value={portalEmail} />
                <button type="submit" style={btn(T.surface2, T.fg)}>
                  Send password reset link
                </button>
              </form>
            </div>
          </>
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
              {hasPortal
                ? "A login was issued but the client hasn't signed in yet. You can re-issue and re-email their reference password below."
                : "Create the client's portal login. They'll be able to sign in at /portal to fill in their company details, review & sign the proposal + DPA, and submit change requests."}
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
              <input
                name="password"
                type="text"
                required
                minLength={8}
                placeholder="Password (8+ chars)"
                defaultValue={clientRef(tenantId)}
                style={{ ...inp, width: 200 }}
              />
              <button type="submit" style={btn(T.primary, T.primaryFg)}>
                {hasPortal
                  ? "Re-issue & resend login email"
                  : "Create portal login & email it"}
              </button>
            </form>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.78rem",
                color: T.faint,
                marginTop: 8,
              }}
            >
              The password defaults to their reference (shown only because they
              haven&apos;t set their own yet). On submit we email the client their login
              (username = email, password as shown).
            </p>
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

      {/* Danger zone — permanent deletion */}
      <section style={{ ...card, borderColor: `${T.danger}55` }}>
        <h2 style={{ ...h2, color: T.danger }}>Delete client</h2>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.85rem",
            color: T.muted,
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          Permanently erases this client and <b>all</b> their data — projects, proposals,
          invoices, documents, updates and portal login. This cannot be undone.
          {hasEmail ? (
            <>
              {" "}
              To confirm, type the client&apos;s email
              {t.contact_email ? (
                <>
                  {" "}
                  (
                  <span style={{ fontFamily: T.mono, color: T.fg }}>
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
            <button type="submit" style={btn(T.danger, "#fff")}>
              Delete permanently
            </button>
          </form>
        ) : (
          <form action={deleteClient}>
            {htid}
            <button type="submit" style={btn(T.danger, "#fff")}>
              Delete permanently
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
