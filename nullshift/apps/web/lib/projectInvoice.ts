import {
  createItemisedStripeInvoice,
  findOrCreateCustomer,
} from "@nullshift/billing/stripe";
import { createServiceClient } from "@nullshift/db";
import { invoiceRef } from "@nullshift/ui/format";
import { sendEmail } from "./sendEmail";
import { buildInvoiceReadyEmail } from "./clientEmails";
import { isXeroPrimary } from "@nullshift/billing/xero";
import { syncInvoiceToXero } from "./xeroSync";

type Service = ReturnType<typeof createServiceClient>;

/**
 * Generate + send an itemised invoice for a project's build modules. Shared by
 * the admin client hub ("Generate invoice" button) and the portal accept flow
 * ("auto-draft & send on acceptance"). Service-role client only (writes
 * invoices/invoice_items which are staff-write under RLS, and looks up the
 * client's email). Stripe send is best-effort: if Stripe isn't configured the
 * invoice is still recorded as `open`.
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

  // Resolve the client's email (the client_admin member of this tenant) + the
  // tenant's stored Stripe customer (shared with the care subscription).
  const { data: tenantRow } = await service
    .from("tenants")
    .select("name, contact_name, stripe_customer_id")
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

  // Best-effort Stripe leg: create the hosted card-payment invoice. Any
  // failure (or Stripe simply unconfigured) still leaves the invoice open and
  // payable by bank transfer — the email below always carries those details.
  let payUrl: string | null = null;
  let payVia: "xero" | "stripe" | null = null;
  if (email) {
    // Xero is the invoice rail when configured: raise it there first and send
    // the client Xero's online invoice (with its Pay-now button once a payment
    // service is connected in Xero). Stripe stays the fallback.
    if (isXeroPrimary()) {
      await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
      const xero = await syncInvoiceToXero(service, invoice.id);
      if (xero.ok && xero.onlineUrl) {
        payUrl = xero.onlineUrl;
        payVia = "xero";
      }
    }
    if (payVia) {
      /* invoiced through Xero — no Stripe invoice */
    } else
      try {
        const customerId = await findOrCreateCustomer({
          email,
          name: tenantRow?.name ?? undefined,
          existingCustomerId: tenantRow?.stripe_customer_id ?? null,
          idempotencyKey: `customer:${tenantId}`,
        });
        if (customerId && customerId !== tenantRow?.stripe_customer_id) {
          await service
            .from("tenants")
            .update({ stripe_customer_id: customerId })
            .eq("id", tenantId)
            .is("stripe_customer_id", null);
        }
        const stripeInv = customerId
          ? await createItemisedStripeInvoice({
              customerId,
              items: lines.map((l) => ({
                name: l.name,
                amountPence: Math.round(Number(l.amount) * 100),
              })),
            })
          : null;
        if (stripeInv) {
          payUrl = stripeInv.url ?? null;
          payVia = payUrl ? "stripe" : null;
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
        console.error("Stripe invoice send failed:", e);
        await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
      }

    // Branded invoice email — card link (when Stripe produced one) + bank
    // transfer details in all cases. Best-effort; complements Stripe's own email.
    try {
      const mail = buildInvoiceReadyEmail({
        name: tenantRow?.contact_name ?? tenantRow?.name ?? "",
        total,
        payUrl,
        payVia,
        items: lines.map((l) => ({ name: l.name, amount: Number(l.amount) })),
        reference: invoiceRef(tenantId, invoice.id),
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
  } else {
    await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
  }

  // Mirror the invoice into Xero (best-effort — logged + swallowed inside).
  await syncInvoiceToXero(service, invoice.id);

  return { ok: true, invoiceId: invoice.id, total };
}
