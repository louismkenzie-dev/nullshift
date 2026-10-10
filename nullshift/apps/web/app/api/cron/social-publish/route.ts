import { NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/social/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Social publisher — every 15 minutes via Vercel cron (vercel.json:
 * {"path":"/api/cron/social-publish","schedule":"*\/15 * * * *"}).
 * Publishes due `scheduled` posts through the Instagram Graph API when an
 * account is connected; otherwise parks them as `needs_manual` and emails
 * Louis. Re-runnable at any time: a post is claimed before it is touched.
 *
 * Guarded exactly like the other cron routes: "Authorization: Bearer
 * <CRON_SECRET>"; anything else is 401. The response never contains token
 * material; errors are sanitised before they are stored or returned.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const outcome = await publishDuePosts();
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 502 });
}
