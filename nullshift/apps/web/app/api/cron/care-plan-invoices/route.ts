import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { tickInvoicedPlans } from "@/lib/billing/invoicedPlansRun";
import { auditDirectDebits } from "@/lib/billing/directDebitRun";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Care plans, daily:
 *   • invoiced plans — raise the periods that have started, mirror payments
 *     Xero has seen, chase what is overdue, flag what is past due;
 *   • Direct Debit plans — re-read every live subscription, mandate and
 *     recent payment from GoCardless and compare with the plan; drift or an
 *     off-plan collection opens an urgent exception and alerts staff.
 * Both also run when the relevant admin pages open, so a scheduler that
 * never fires does not stop a client being invoiced or a wrong amount being
 * caught.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createServiceClient();
  const invoiced = await tickInvoicedPlans(service);
  const directDebits = await auditDirectDebits(service, { source: "cron" }).catch((e) => ({
    configured: true,
    checked: 0,
    results: [],
    opened: 0,
    emailed: 0,
    resolved: 0,
    errors: [e instanceof Error ? e.message : String(e)],
  }));
  const errors = [...invoiced.errors, ...directDebits.errors];
  return NextResponse.json(
    {
      invoiced,
      directDebits: {
        configured: directDebits.configured,
        checked: directDebits.checked,
        findings: directDebits.results.reduce((n, r) => n + r.findings.length, 0),
        opened: directDebits.opened,
        emailed: directDebits.emailed,
        resolved: directDebits.resolved,
        errors: directDebits.errors,
      },
    },
    { status: errors.length ? 207 : 200 }
  );
}
