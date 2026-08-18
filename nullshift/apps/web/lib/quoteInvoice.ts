import {
  createItemisedStripeInvoice,
  findOrCreateCustomer,
} from "@nullshift/billing/stripe";
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
 * invoices_one_per_issue partial unique index (0025), Stripe hosted invoice
 * best-effort with bank-transfer fallback, branded email, Xero mirror.
 * Service-role only.
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
    .select("name, contact_name, contact_email, stripe_customer_id")
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

  let payUrl: string | null = null;
  if (email) {
    try {
      const customerId = await findOrCreateCustomer({
        email,
        name: tenantRow?.name ?? undefined,
        existingCustomerId: tenantRow?.stripe_customer_id ?? null,
        idempotencyKey: `customer:${tenantId}`,
      });
      const stripeInv = customerId
        ? await createItemisedStripeInvoice({
            customerId,
            items: [{ name: title, amountPence: Math.round(amount * 100) }],
          })
        : null;
      if (stripeInv) {
        payUrl = stripeInv.url ?? null;
        await service
          .from("invoices")
          .update({
            status: "open",
            stripe_invoice_id: stripeInv.id,
            hosted_invoice_url: stripeInv.url,
          })
          .eq("id", invoice.id);
      } else {
        await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
      }
    } catch (e) {
      console.error("Stripe quote-invoice send failed:", e);
      await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
    }

    try {
      const mail = buildInvoiceReadyEmail({
        name: tenantRow?.contact_name ?? tenantRow?.name ?? "",
        total: amount,
        payUrl,
        items: [{ name: title, amount }],
        reference: invoiceRef(tenantId, invoice.id),
      });
      await sendEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    } catch (e) {
      console.error("Quote invoice email failed:", e);
    }
  } else {
    await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
  }

  await syncInvoiceToXero(service, invoice.id);
  return { ok: true, invoiceId: invoice.id };
}
