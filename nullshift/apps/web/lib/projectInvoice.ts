import { createItemisedStripeInvoice } from "@nullshift/billing/stripe";
import { createServiceClient } from "@nullshift/db";

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

  const { data: invoice, error } = await service
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
  } else {
    await service.from("invoices").update({ status: "open" }).eq("id", invoice.id);
  }

  return { ok: true, invoiceId: invoice.id, total };
}
