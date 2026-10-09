import { createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@nullshift/db";
import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { requestIp } from "@nullshift/db/rateLimit";
import { loadGenerateInput } from "@/lib/booking/data";
import {
  NOTIFY_EMAIL,
  bookingIcs,
  confirmationEmail,
  googleCalendarUrl,
  notifyEmail,
  type BookingForEmail,
} from "@/lib/booking/emails";
import { isSlotAvailable, londonDate } from "@/lib/booking/slots";
import { validateBooking } from "@/lib/booking/validate";
import { sendEmail } from "@/lib/sendEmail";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The honeypot field. `website` is a real field on this form, so it is `fax`. */
const HONEYPOT = "fax";

/**
 * POST /api/bookings — book a slot from the website.
 * Validate → rate-limit → confirm the slot is still free → insert → re-check
 * nobody else won the same instant → confirmation (.ics) + notification.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      const host = request.headers.get("host") || new URL(request.url).host;
      if (!/^https?:$/.test(source.protocol) || source.host !== host)
        return json({ error: "Please book from the Nullshift website." }, 403);
    } catch {
      return json({ error: "Please book from the Nullshift website." }, 403);
    }
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    return json({ error: "Invalid request format." }, 415);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return json({ error: "This request is too long." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "Please complete the form." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Please complete the form." }, 400);
  }
  if (body[HONEYPOT])
    return json({ error: "Unable to book this call. Please email us directly." }, 400);

  const result = validateBooking(body);
  if (!result.ok)
    return json(
      { error: "Please check the highlighted fields.", errors: result.errors },
      400
    );
  const data = result.data;

  if (!hasSupabaseServerConfig())
    return json({ error: "Booking is temporarily unavailable. Please email us." }, 503);

  const db = createServiceClient();
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  for (const identity of ["ip:" + requestIp(request), "email:" + data.email]) {
    const limit = await db.rpc("rate_limit_hit", {
      p_key: "booking:" + hash(identity),
      p_limit: 5,
      p_window_seconds: 3600,
    });
    if (limit.error)
      return json(
        { error: "We couldn’t book this just now. Please try again shortly." },
        503
      );
    if (limit.data !== true)
      return json(
        { error: "Too many attempts. Please try again later or email us." },
        429
      );
  }

  // Re-generate the day's slots from the live diary and insist the requested
  // instant is still one of them.
  const date = londonDate(Date.parse(data.startsAt));
  let input;
  try {
    input = await loadGenerateInput(date, date);
  } catch (e) {
    console.error("bookings: load failed", e);
    return json({ error: "Could not check availability. Please try again." }, 503);
  }
  const slot = isSlotAvailable(input, data.startsAt);
  if (!slot)
    return json(
      {
        error: "That time has just been taken. Please choose another slot.",
        code: "taken",
      },
      409
    );

  const cancelToken = randomBytes(24).toString("base64url");
  const source =
    typeof body.source === "string" && body.source.length <= 80 ? body.source : null;
  const prospectId =
    typeof body.prospectId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.prospectId
    )
      ? body.prospectId
      : null;

  const insert = await db
    .from("bookings")
    .insert({
      kind: data.kind,
      name: data.name,
      email: data.email,
      company: data.company || null,
      website: data.website || null,
      phone: data.phone || null,
      notes: data.notes || null,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      status: "confirmed",
      cancel_token: cancelToken,
      source: source ?? `web:${data.kind}`,
      prospect_id: prospectId,
    })
    .select(
      "id,kind,name,email,company,website,phone,notes,starts_at,ends_at,cancel_token"
    )
    .single();
  if (insert.error || !insert.data) {
    console.error("bookings: insert failed", insert.error?.message);
    return json({ error: "Your booking wasn’t saved. Please try again." }, 503);
  }
  const booking = insert.data as BookingForEmail;

  // Transaction-ish race check: if another confirmed booking overlaps and was
  // created before ours, we lost — remove ours and ask for another slot.
  const clash = await db
    .from("bookings")
    .select("id,created_at")
    .eq("status", "confirmed")
    .lt("starts_at", slot.endsAt)
    .gt("ends_at", slot.startsAt)
    .neq("id", booking.id)
    .order("created_at", { ascending: true })
    .limit(1);
  if (clash.data && clash.data.length) {
    await db.from("bookings").delete().eq("id", booking.id);
    return json(
      {
        error: "That time has just been taken. Please choose another slot.",
        code: "taken",
      },
      409
    );
  }

  const meetingLink = input.settings.meeting_link;
  let confirmationSent = false;
  try {
    const confirm = confirmationEmail(booking, meetingLink);
    const [sent] = await Promise.all([
      sendEmail({
        to: booking.email,
        subject: confirm.subject,
        html: confirm.html,
        text: confirm.text,
        purpose: "transactional",
        replyTo: NOTIFY_EMAIL,
        attachments: [
          {
            filename: "nullshift-call.ics",
            content: bookingIcs(booking, meetingLink),
            contentType: "text/calendar",
          },
        ],
      }),
      (() => {
        const n = notifyEmail(booking, meetingLink);
        return sendEmail({
          to: NOTIFY_EMAIL,
          subject: n.subject,
          html: n.html,
          text: n.text,
          purpose: "transactional",
          replyTo: booking.email,
        });
      })(),
    ]);
    confirmationSent = sent;
  } catch (e) {
    console.error("bookings: saved; email delivery needs attention", e);
  }

  return json({
    ok: true,
    booking: {
      id: booking.id,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      date: slot.date,
      time: slot.time,
      meetingLink,
      googleCalendarUrl: googleCalendarUrl(booking, meetingLink),
      cancelPath: `/book/cancel/${encodeURIComponent(cancelToken)}`,
      confirmationSent,
    },
  });
}
