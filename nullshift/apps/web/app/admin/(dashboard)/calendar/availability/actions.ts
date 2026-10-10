"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { isClientPreview } from "@/lib/clientPreview";

/**
 * Availability server actions (migration 0070). Every action: requireStaff →
 * never under a client preview cookie → RLS client (staff policy) → audit row.
 * The website reads the same tables through the service role, so a change
 * here is live on /book/call and /book/partner on the next request.
 */

const PATHS = ["/admin/calendar/availability", "/admin/calendar"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard() {
  const staff = await requireStaff();
  if (!staff.ok) return null;
  if (await isClientPreview()) return null;
  return { db: await createClient(), staff };
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const int = (fd: FormData, key: string, min: number, max: number, fallback: number) => {
  const n = Number(str(fd, key));
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const done = () => {
  for (const p of PATHS) revalidatePath(p);
};

/** Add or update a weekly rule. */
export async function saveRule(formData: FormData) {
  const g = await guard();
  if (!g) return;
  const id = str(formData, "id");
  const weekday = int(formData, "weekday", 0, 6, -1);
  const start = str(formData, "start_time");
  const end = str(formData, "end_time");
  const slot = int(formData, "slot_minutes", 5, 480, 30);
  const active = formData.get("active") === "on";
  if (weekday < 0 || !TIME.test(start) || !TIME.test(end) || end <= start) return;
  const row = { weekday, start_time: start, end_time: end, slot_minutes: slot, active };
  const { error } = UUID.test(id)
    ? await g.db.from("availability_rules").update(row).eq("id", id)
    : await g.db.from("availability_rules").insert(row);
  if (error) {
    console.error("saveRule:", error.message);
    return;
  }
  await logAudit({
    action: UUID.test(id) ? "availability.rule.updated" : "availability.rule.added",
    target: UUID.test(id) ? `availability_rule:${id}` : null,
    metadata: row,
  });
  done();
}

export async function deleteRule(formData: FormData) {
  const g = await guard();
  if (!g) return;
  const id = str(formData, "id");
  if (!UUID.test(id)) return;
  const { error } = await g.db.from("availability_rules").delete().eq("id", id);
  if (error) {
    console.error("deleteRule:", error.message);
    return;
  }
  await logAudit({
    action: "availability.rule.removed",
    target: `availability_rule:${id}`,
  });
  done();
}

/** Block a whole day, or a window within it. */
export async function addException(formData: FormData) {
  const g = await guard();
  if (!g) return;
  const date = str(formData, "date");
  const start = str(formData, "start_time");
  const end = str(formData, "end_time");
  const reason = str(formData, "reason").slice(0, 200) || null;
  if (!DATE.test(date)) return;
  const partial = start || end;
  if (partial && (!TIME.test(start) || !TIME.test(end) || end <= start)) return;
  const row = {
    date,
    start_time: partial ? start : null,
    end_time: partial ? end : null,
    reason,
  };
  const { error } = await g.db.from("availability_exceptions").insert(row);
  if (error) {
    console.error("addException:", error.message);
    return;
  }
  await logAudit({ action: "availability.exception.added", metadata: row });
  done();
}

export async function deleteException(formData: FormData) {
  const g = await guard();
  if (!g) return;
  const id = str(formData, "id");
  if (!UUID.test(id)) return;
  const { error } = await g.db.from("availability_exceptions").delete().eq("id", id);
  if (error) {
    console.error("deleteException:", error.message);
    return;
  }
  await logAudit({
    action: "availability.exception.removed",
    target: `availability_exception:${id}`,
  });
  done();
}

/** Notice, horizon, buffer, meeting link, on/off switch. */
export async function saveSettings(formData: FormData) {
  const g = await guard();
  if (!g) return;
  const link = str(formData, "meeting_link").slice(0, 500);
  if (link && !/^https:\/\/[^\s]+$/i.test(link)) return;
  const row = {
    id: 1,
    timezone: "Europe/London",
    min_notice_hours: int(formData, "min_notice_hours", 0, 720, 12),
    max_days_ahead: int(formData, "max_days_ahead", 1, 365, 30),
    buffer_minutes: int(formData, "buffer_minutes", 0, 240, 15),
    meeting_link: link || null,
    active: formData.get("active") === "on",
  };
  const { error } = await g.db.from("booking_settings").upsert(row, { onConflict: "id" });
  if (error) {
    console.error("saveSettings:", error.message);
    return;
  }
  await logAudit({
    action: "availability.settings.updated",
    metadata: { ...row, meeting_link: row.meeting_link ? "(set)" : null },
  });
  done();
}

/** Mark a website booking as completed / no-show / cancelled from the calendar. */
export async function setBookingStatus(formData: FormData) {
  const g = await guard();
  if (!g) return;
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (
    !UUID.test(id) ||
    !["confirmed", "cancelled", "completed", "no_show"].includes(status)
  )
    return;
  const { error } = await g.db
    .from("bookings")
    .update({
      status,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) {
    console.error("setBookingStatus:", error.message);
    return;
  }
  await logAudit({ action: `booking.${status}`, target: `booking:${id}` });
  done();
}
