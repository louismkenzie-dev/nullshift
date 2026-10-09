"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { NOTIFY_EMAIL, cancelledEmail, type BookingForEmail } from "@/lib/booking/emails";
import { sendEmail } from "@/lib/sendEmail";

/**
 * Cancel a website booking by its unguessable cancel_token (the only thing
 * the booker holds). Idempotent: a second submit on an already-cancelled
 * booking just shows the cancelled state again.
 */
export async function cancelBooking(formData: FormData) {
  const token = String(formData.get("token") || "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !hasSupabaseServerConfig())
    redirect(`/book/cancel/${encodeURIComponent(token)}?state=error`);
  const db = createServiceClient();
  const { data } = await db
    .from("bookings")
    .select(
      "id,kind,name,email,company,website,phone,notes,starts_at,ends_at,cancel_token,status"
    )
    .eq("cancel_token", token)
    .maybeSingle();
  if (!data) redirect(`/book/cancel/${encodeURIComponent(token)}?state=error`);
  if (data.status === "confirmed") {
    const { error } = await db
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "confirmed");
    if (error) redirect(`/book/cancel/${encodeURIComponent(token)}?state=error`);
    const mail = cancelledEmail(data as BookingForEmail);
    await sendEmail({
      to: NOTIFY_EMAIL,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      purpose: "transactional",
      replyTo: data.email,
    });
  }
  redirect(`/book/cancel/${encodeURIComponent(token)}?state=cancelled`);
}
