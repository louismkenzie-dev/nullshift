import { NextResponse } from "next/server";
import { sendMonthlyReports } from "@/lib/watch/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Nullshift Watch: monthly client-ready report, 1st of the month 08:00. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sent = await sendMonthlyReports();
  return NextResponse.json({ ok: true, sent });
}
