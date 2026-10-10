import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { invoiceRef } from "@nullshift/ui/format";
import { sendEmail } from "./sendEmail";
import { portalReplyTo } from "./portalAccess";
import { buildInvoiceReadyEmail } from "./clientEmails";
import { syncInvoiceToXero } from "./xeroSync";

type Service = ReturnType<typeof createServiceClient>;

export const MANUAL_INVOICE_TERMS_DAYS = 14;

/**
 * A manual invoice, raised by staff from the billing cockpit: a build
 * milestone or a one-off amount with a description. Collected by bank
 * transfer only — no card link, no fees:
 *
 *   1. `invoices` row (open, due after the terms) + one `invoice_items` line
 *      so the document and the books carry the description;
 *   2. mirrored into Xero with the client's payment reference
 *      (NS-<client>-<invoice>) as the Xero reference;
 *   3. emailed to the client with the bank details and that reference, and
 *      the Xero online invoice as "view the invoice" when Xero produced one.
 *
 * The bank feed then matches a transfer quoting the reference to this
 * invoice and confirms it automatically (lib/revolut/match.ts).
 */
export async function issueManualInvoice(
  service: Service,
  opts: {
    tenantId: string;
    type: "build_milestone" | "one_off";
    amount: number;
    description: string | null;
    termsDays?: number;
    actorEmail?: string | null;
  }
): Promise<{ ok: true; invoiceId: string; reference: string; emailed: boolean; xero: boolean } | { ok: false; error: string }> {
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (!(amount > 0)) return { ok: false, error: "Amount must be above zero." };
  const terms = opts.termsDays ?? MANUAL_INVOICE_TERMS_DAYS;
  const dueAt = new Date(Date.now() + terms * 86_400_000).toISOString();
  const description =
    opts.description?.trim() || (opts.type === "build_milestone" ? "System build — milestone" : "One-off work");

  const { data: tenant } = await service
    .from("tenants")
    .select("id, name, contact_name, contact_email")
    .eq("id", opts.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Client not found." };

  const { data: invoice, error } = await service
    .from("invoices")
    .insert({
      tenant_id: opts.tenantId,
      type: opts.type,
      amount,
      status: "open",
      due_at: dueAt,
      project_item_count: 1,
    })
    .select("id")
    .single();
  if (error || !invoice) return { ok: false, error: error?.message ?? "Invoice insert failed." };
  const invoiceId = invoice.id as string;
  const reference = invoiceRef(opts.tenantId, invoiceId);

  await service.from("invoice_items").insert({
    invoice_id: invoiceId,
    tenant_id: opts.tenantId,
    name: description,
    amount,
    quantity: 1,
  });

  const xero = await syncInvoiceToXero(service, invoiceId);
  const viewUrl = xero.ok && xero.onlineUrl ? xero.onlineUrl : null;

  let emailed = false;
  if (tenant.contact_email) {
    const mail = buildInvoiceReadyEmail({
      name: tenant.contact_name ?? tenant.name ?? "",
      total: amount,
      payUrl: viewUrl,
      payVia: viewUrl ? "xero" : null,
      items: [{ name: description, amount }],
      reference,
      dueOn: new Date(dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    });
    try {
      emailed = await sendEmail({
        purpose: "transactional",
        to: tenant.contact_email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        replyTo: portalReplyTo(),
      });
    } catch (e) {
      console.error("manual invoice email failed:", e);
    }
  }

  await logAuditAsService({
    action: "invoice.issued",
    target: `invoice:${invoiceId}`,
    tenantId: opts.tenantId,
    metadata: {
      type: opts.type,
      amount,
      description,
      reference,
      dueAt,
      xero: xero.ok ? (xero.xeroInvoiceId ?? true) : false,
      emailed,
      to: tenant.contact_email ?? null,
      by: opts.actorEmail ?? null,
      rail: "bank_transfer",
    },
  });
  return { ok: true, invoiceId, reference, emailed, xero: xero.ok };
}
