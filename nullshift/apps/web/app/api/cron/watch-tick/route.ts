import { NextResponse } from "next/server";
import { runDueChecks } from "@/lib/watch/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Nullshift Watch: uptime every run; SSL / links / speed when due. Every 15 minutes. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await runDueChecks();
  return NextResponse.json({ ok: true, ...r });
}
