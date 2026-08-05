import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { sendEmail } from "@/lib/sendEmail";
import { esc, wrap } from "@/lib/emailLayout";
import { OPEN_STATUSES } from "@/lib/ops/issues";

export const dynamic = "force-dynamic";

/**
 * Friday pulse — runs via Vercel cron (see vercel.json) every Friday morning.
 * Compiles a per-client digest of the week (shipped / up next / blocked on
 * client) and emails it to the agency inbox as the review step: Louis skims
 * one email instead of trawling chats, and forwards or rewrites per client
 * as needed. Client-facing auto-send can be layered on once trusted.
 *
 * Vercel invokes cron routes with "Authorization: Bearer <CRON_SECRET>" when
 * the CRON_SECRET env var is set — anything else is rejected.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: tenants }, { data: shipped }, { data: open }] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("type", "client"),
    supabase
      .from("issues")
      .select("tenant_id, title, resolved_at")
      .in("status", ["fixed", "shipped"])
      .gte("resolved_at", weekAgo),
    supabase
      .from("issues")
      .select("tenant_id, title, status, severity, due_at, promised_note")
      .in("status", OPEN_STATUSES),
  ]);

  const byTenant = new Map<string, { shipped: string[]; next: string[]; blocked: string[] }>();
  for (const t of tenants ?? []) byTenant.set(t.id, { shipped: [], next: [], blocked: [] });
  for (const i of shipped ?? []) byTenant.get(i.tenant_id)?.shipped.push(i.title);
  for (const i of open ?? []) {
    const bucket = byTenant.get(i.tenant_id);
    if (!bucket) continue;
    if (i.status === "awaiting_client") bucket.blocked.push(i.title);
    else bucket.next.push(i.title);
  }

  const sections: string[] = [];
  for (const t of tenants ?? []) {
    const d = byTenant.get(t.id);
    if (!d || (!d.shipped.length && !d.next.length && !d.blocked.length)) continue;
    const list = (label: string, items: string[]) =>
      items.length
        ? `<p style="margin:6px 0 2px;font-weight:600;">${label}</p><ul style="margin:0 0 8px;padding-left:18px;">${items
            .slice(0, 8)
            .map((x) => `<li>${esc(x)}</li>`)
            .join("")}</ul>`
        : "";
    sections.push(
      `<h3 style="margin:20px 0 4px;">${esc(t.name)}</h3>` +
        list("Shipped this week", d.shipped) +
        list("Up next", d.next) +
        list("Blocked on client", d.blocked)
    );
  }

  if (!sections.length) {
    return NextResponse.json({ ok: true, sent: false, reason: "nothing to report" });
  }

  const html = wrap(
    `<h2 style="margin:0 0 8px;">Friday pulse</h2><p style="margin:0 0 12px;">Per-client digest of the week — review, then send each client their version (or forward as-is).</p>${sections.join("")}`,
    "Your weekly per-client digest is ready"
  );

  const sent = await sendEmail({
    to: process.env.ENQUIRY_NOTIFY_EMAIL || "louis@nullshift.co.uk",
    subject: `Friday pulse — ${sections.length} client${sections.length === 1 ? "" : "s"} with activity`,
    html,
    text: "Your weekly per-client digest is ready. Open the admin to review.",
  });

  return NextResponse.json({ ok: true, sent, clients: sections.length });
}
