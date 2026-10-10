import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { tickInvoicedPlans } from "@/lib/billing/invoicedPlansRun";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Invoiced care plans, daily: raise the periods that have started, mirror
 * payments Xero has seen, chase what is overdue, flag what is past due. The
 * same tick also runs when the care-plan page opens for a client, so a
 * scheduler that never fires does not stop a client being invoiced.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await tickInvoicedPlans(createServiceClient());
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
