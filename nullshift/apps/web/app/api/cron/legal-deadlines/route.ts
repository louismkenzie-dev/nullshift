import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { sendEmail } from "@/lib/sendEmail";
import { esc, wrap } from "@/lib/emailLayout";
import { legalConfig } from "@nullshift/content/legal/config";

export const dynamic = "force-dynamic";

/**
 * Legal deadline watch (spec §11, §12, §18).
 *
 * Deadlines that are only written down in a policy get missed. This runs daily
 * and alerts BEFORE each one, not on it — an alert that fires on the statutory
 * date is a record of having been late.
 *
 * What it watches:
 *  · Data-protection complaints approaching the 30-day acknowledgement
 *    maximum. 30 days is the ACKNOWLEDGEMENT deadline, not a resolution
 *    deadline, and the alert fires at 7 days remaining.
 *  · Subprocessor change notices whose 14-day client-notice window is running
 *    out before the change takes effect.
 *  · Termination handovers whose deletion or backup-expiry dates fall due.
 *
 * Silent when there is nothing to say. A daily "all clear" email trains people
 * to ignore the alert that matters.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createServiceClient();
  const now = new Date();
  const inDays = (n: number) =>
    new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
  const dateOnly = (n: number) => inDays(n).slice(0, 10);

  const [{ data: complaints }, { data: notices }, { data: terminations }] =
    await Promise.all([
      // Unacknowledged and inside 7 days of the statutory maximum. Overdue rows
      // stay in the result deliberately: an alert that stops once the deadline
      // passes is how a missed deadline becomes invisible.
      db
        .from("data_complaints")
        .select("case_ref, complainant_name, received_at, acknowledge_due_at, status")
        .is("acknowledged_at", null)
        .lte("acknowledge_due_at", inDays(7))
        .order("acknowledge_due_at", { ascending: true }),
      db
        .from("subprocessor_notices")
        .select("id, provider_name, effective_from, notified_at, status")
        .eq("status", "proposed")
        .lte("effective_from", dateOnly(21))
        .order("effective_from", { ascending: true }),
      db
        .from("termination_records")
        .select(
          "reference, effective_date, active_data_deletion_due, backup_expiry_due, status"
        )
        .in("status", ["requested", "acknowledged", "in_handover"])
        .order("effective_date", { ascending: true }),
    ]);

  const blocks: string[] = [];

  if (complaints?.length) {
    const rows = complaints
      .map((c) => {
        const days = Math.ceil(
          (new Date(c.acknowledge_due_at).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000)
        );
        return `<li><strong>${esc(c.case_ref)}</strong> — ${esc(c.complainant_name)} · ${
          days < 0
            ? `<span style="color:#ff3a5c">OVERDUE by ${Math.abs(days)} day(s)</span>`
            : `${days} day(s) to acknowledge`
        }</li>`;
      })
      .join("");
    blocks.push(
      `<h2 style="margin:0 0 8px">Complaints approaching the 30-day acknowledgement limit</h2><ul style="margin:0 0 20px;padding-left:18px">${rows}</ul>`
    );
  }

  if (notices?.length) {
    const rows = notices
      .map((n) => {
        const days = Math.ceil(
          (new Date(n.effective_from).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        return `<li><strong>${esc(n.provider_name)}</strong> — effective ${esc(n.effective_from)} · ${
          n.notified_at
            ? "clients notified"
            : `<span style="color:#ff3a5c">clients NOT notified</span> · ${days} day(s) until effective (14 required)`
        }</li>`;
      })
      .join("");
    blocks.push(
      `<h2 style="margin:0 0 8px">Subprocessor changes needing client notice</h2><ul style="margin:0 0 20px;padding-left:18px">${rows}</ul>`
    );
  }

  const dueTerminations = (terminations ?? []).filter(
    (t) =>
      (t.active_data_deletion_due && t.active_data_deletion_due <= dateOnly(7)) ||
      (t.backup_expiry_due && t.backup_expiry_due <= dateOnly(7))
  );
  if (dueTerminations.length) {
    const rows = dueTerminations
      .map(
        (t) =>
          `<li><strong>${esc(t.reference)}</strong> — deletion due ${esc(
            t.active_data_deletion_due ?? "—"
          )}, backups expire ${esc(t.backup_expiry_due ?? "—")}</li>`
      )
      .join("");
    blocks.push(
      `<h2 style="margin:0 0 8px">Termination handovers falling due</h2><ul style="margin:0 0 20px;padding-left:18px">${rows}</ul>`
    );
  }

  if (!blocks.length) return NextResponse.json({ ok: true, alerts: 0 });

  const sent = await sendEmail({
    purpose: "transactional",
    to: legalConfig.contact.privacy,
    subject: `Legal deadlines — ${blocks.length} area${blocks.length === 1 ? "" : "s"} need attention`,
    html: wrap(
      `<tr><td style="padding:26px 32px">${blocks.join("")}</td></tr>`,
      "Legal deadlines need attention"
    ),
    text: "Legal deadlines need attention. Open the admin compliance screen.",
  });

  return NextResponse.json({
    ok: true,
    alerts: blocks.length,
    complaints: complaints?.length ?? 0,
    subprocessorNotices: notices?.length ?? 0,
    terminations: dueTerminations.length,
    emailSent: sent,
  });
}
