import { createServiceClient } from "@nullshift/db";
import { invoiceRef } from "@nullshift/ui/format";
import { sendEmail } from "./sendEmail";
import { buildInvoiceReadyEmail } from "./clientEmails";
import { syncInvoiceToXero } from "./xeroSync";

type Service = ReturnType<typeof createServiceClient>;

/**
 * Generate + send an itemised invoice for a project's build modules. Shared by
 * the admin client hub ("Generate invoice" button) and the portal accept flow
 * ("auto-draft & send on acceptance"). Service-role client only (writes
 * invoices/invoice_items which are staff-write under RLS, and looks up the
 * client's email).
 *
 * Collected by bank transfer only — no card link, no fees. The invoice is
 * mirrored into Xero (reference = the client's payment reference) and the
 * email leads with the bank details and that reference; the bank feed
 * matches a transfer quoting it and confirms the payment automatically.
 */
export async function generateProjectInvoice(
  service: Service,
  opts: { tenantId: string; projectId: string }
): Promise<{ ok: boolean; invoiceId?: string; total?: number }> {
  const { tenantId, projectId } = opts;

  const { data: items } = await service
    .from("project_items")
    .select("name, amount")
    .eq("project_id", projectId);
  const lines = (items ?? []) as { name: string; amount: number }[];
  if (lines.length === 0) return { ok: false };
  const total = lines.reduce((s, l) => s + Number(l.amount), 0);

  // Don't create a duplicate. The accept flow auto-generates this invoice and
  // the admin "Generate & send" button calls the same helper, so a double-click
  // or a click-after-accept must reuse the existing build invoice rather than
  // mint (and Stripe-send) a second one. A voided invoice can be regenerated.
  const { data: existing } = await service
    .from("invoices")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "build_milestone")
    .neq("status", "void")
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, invoiceId: existing.id, total };

  // Due in 14 days — matches the Stripe hosted invoice's days_until_due, and
  // gives the overdue detection on /admin/billing a real date to compare.
  const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invoice, error } = await service
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      project_id: projectId,
      type: "build_milestone",
      amount: total,
      status: "draft",
      due_at: dueAt,
      project_item_count: lines.length,
    })
    .select("id")
    .single();
  if (error || !invoice) {
    // A concurrent generate may have already inserted the build invoice (the
    // partial unique index invoices_one_build_per_project rejects the second) —
    // reuse it rather than minting a second Stripe invoice + charge.
    const { data: raced } = await service
      .from("invoices")
      .select("id")
      .eq("project_id", projectId)
      .eq("type", "build_milestone")
      .neq("status", "void")
      .limit(1)
      .maybeSingle();
    if (raced) return { ok: true, invoiceId: raced.id, total };
    console.error("generateProjectInvoice:", error?.message);
    return { ok: false };
  }

  await service.from("invoice_items").insert(
    lines.map((l) => ({
      invoice_id: invoice.id,
      tenant_id: tenantId,
      name: l.name,
      amount: l.amount,
      quantity: 1,
    }))
  );

  // Resolve the client's email (the client_admin member of this tenant).
  const { data: tenantRow } = await service
    .from("tenants")
    .select("name, contact_name, contact_email")
    .eq("id", tenantId)
    .maybeSingle();
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

  email = email ?? tenantRow?.contact_email ?? null;

  // Open, then into Xero (best-effort — logged + swallowed inside). The Xero
  // online invoice is the document link in the email; there is no card leg.
  await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
  const xero = await syncInvoiceToXero(service, invoice.id);
  const viewUrl = xero.ok && xero.onlineUrl ? xero.onlineUrl : null;

  // Branded invoice email — bank details + the invoice's payment reference
  // first, the document link second. Best-effort.
  if (email) {
    try {
      const mail = buildInvoiceReadyEmail({
        name: tenantRow?.contact_name ?? tenantRow?.name ?? "",
        total,
        payUrl: viewUrl,
        payVia: viewUrl ? "xero" : null,
        items: lines.map((l) => ({ name: l.name, amount: Number(l.amount) })),
        reference: invoiceRef(tenantId, invoice.id),
        dueOn: new Date(dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      });
      await sendEmail({
        purpose: "transactional",
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    } catch (e) {
      console.error("Invoice email send failed:", e);
    }
  }

  return { ok: true, invoiceId: invoice.id, total };
}
