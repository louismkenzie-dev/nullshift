import { createServiceClient } from "@nullshift/db";
import { invoiceRef } from "@nullshift/ui/format";
import { sendEmail } from "./sendEmail";
import { buildInvoiceReadyEmail } from "./clientEmails";
import { syncInvoiceToXero } from "./xeroSync";

type Service = ReturnType<typeof createServiceClient>;

/**
 * Generate + send the invoice for an ACCEPTED out-of-scope quote — the missing
 * link between "client clicked Accept on £X" and money actually being
 * requested. Mirrors generateProjectInvoice's guarantees: dedupe via the
 * invoices_one_per_issue partial unique index (0025), Xero mirror, branded
 * email with the bank details and the invoice's payment reference. Bank
 * transfer only — no card link, no fees. Service-role only.
 */
export async function generateQuoteInvoice(
  service: Service,
  opts: {
    tenantId: string;
    projectId: string | null;
    issueId: string;
    title: string;
    amount: number;
  }
): Promise<{ ok: boolean; invoiceId?: string }> {
  const { tenantId, projectId, issueId, title, amount } = opts;
  if (!(amount > 0)) return { ok: false };

  // Reuse any live invoice already generated for this issue (double-click,
  // webhook retry, or a concurrent accept — the partial index backstops races).
  const { data: existing } = await service
    .from("invoices")
    .select("id")
    .eq("issue_id", issueId)
    .neq("status", "void")
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, invoiceId: existing.id };

  const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invoice, error } = await service
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      project_id: projectId,
      issue_id: issueId,
      type: "one_off",
      amount,
      status: "draft",
      due_at: dueAt,
      project_item_count: 1,
    })
    .select("id")
    .single();
  if (error || !invoice) {
    const { data: raced } = await service
      .from("invoices")
      .select("id")
      .eq("issue_id", issueId)
      .neq("status", "void")
      .limit(1)
      .maybeSingle();
    if (raced) return { ok: true, invoiceId: raced.id };
    console.error("generateQuoteInvoice:", error?.message);
    return { ok: false };
  }

  await service.from("invoice_items").insert({
    invoice_id: invoice.id,
    tenant_id: tenantId,
    name: title,
    amount,
    quantity: 1,
  });

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

  // Open, then into Xero (best-effort). The Xero online invoice is the
  // document link in the email; there is no card leg.
  await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
  const xero = await syncInvoiceToXero(service, invoice.id);
  const viewUrl = xero.ok && xero.onlineUrl ? xero.onlineUrl : null;

  if (email) {
    try {
      const mail = buildInvoiceReadyEmail({
        name: tenantRow?.contact_name ?? tenantRow?.name ?? "",
        total: amount,
        payUrl: viewUrl,
        payVia: viewUrl ? "xero" : null,
        items: [{ name: title, amount }],
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
      console.error("Quote invoice email failed:", e);
    }
  }

  return { ok: true, invoiceId: invoice.id };
}
