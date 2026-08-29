"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@nullshift/db";
import { rateLimitAllow } from "@nullshift/db/rateLimit";
import { legalConfig } from "@nullshift/content/legal/config";
import { sendEmail } from "@/lib/sendEmail";

/**
 * Data-protection complaint intake (spec §11).
 *
 * The obligation is to acknowledge within 30 days and to investigate without
 * undue delay — so this creates the case, stamps the acknowledgement clock, and
 * acknowledges immediately by email where it can. The complainant gets their
 * case reference on screen either way, so they always leave with evidence they
 * complained.
 *
 * Public and unauthenticated by necessity — a complaint route that required a
 * login would not be a usable complaint route — so it is rate limited and
 * writes through the service role rather than an anonymous insert policy.
 */

export type ComplaintResult =
  | { ok: true; caseRef: string; acknowledged: boolean }
  | { ok: false; error: string };

const clean = (v: FormDataEntryValue | null, max = 4000) =>
  String(v ?? "").trim().slice(0, max);

export async function submitDataComplaint(
  _prev: ComplaintResult | null,
  formData: FormData
): Promise<ComplaintResult> {
  const name = clean(formData.get("name"), 200);
  const email = clean(formData.get("email"), 320);
  const relationship = clean(formData.get("relationship"), 80);
  const nature = clean(formData.get("nature"), 8000);
  const relevantDates = clean(formData.get("relevant_dates"), 300);
  const relatedClient = clean(formData.get("related_client"), 200);

  if (!name || !email || !nature)
    return { ok: false, error: "Please give your name, an email address and what happened." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "That email address doesn't look right." };

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    (await headers()).get("x-real-ip") ??
    "unknown";

  // Generous enough that a real person is never blocked, tight enough that the
  // form can't be used to flood the case list.
  if (!(await rateLimitAllow("data_complaint", ip, 5, 3600)))
    return {
      ok: false,
      error: `Too many submissions from this connection. Please email ${legalConfig.contact.privacy} instead.`,
    };

  const service = createServiceClient();
  const { data: refData } = await service.rpc("next_complaint_ref");
  const caseRef = (refData as string | null) ?? `DPC-${Date.now()}`;

  const { error } = await service.from("data_complaints").insert({
    case_ref: caseRef,
    complainant_name: name,
    complainant_email: email,
    relationship: relationship || "not stated",
    nature,
    relevant_dates: relevantDates || null,
    related_client: relatedClient || null,
    created_ip: ip === "unknown" ? null : ip,
  });
  if (error) {
    console.error("data complaint insert failed:", error.message);
    return {
      ok: false,
      error: `We couldn't record that. Please email ${legalConfig.contact.privacy} so your complaint is not lost.`,
    };
  }

  // Acknowledge immediately where possible. Best-effort: a mail failure must
  // never lose the complaint, and the case is already recorded above.
  let acknowledged = false;
  try {
    await sendEmail({
      // They asked us something and this is the reply — transactional, and
      // never something a person could unsubscribe themselves out of.
      purpose: "transactional",
      to: email,
      subject: `We've received your data-protection complaint (${caseRef})`,
      html: `<p>Hello ${name},</p><p>We've received your data-protection complaint and logged it as <strong>${caseRef}</strong>.</p><p>We'll investigate and respond without undue delay, and we'll tell you the outcome. If you need to add anything, reply to this email quoting your case reference.</p><p>You also have the right to complain to the UK Information Commissioner's Office at ico.org.uk.</p><p>${legalConfig.entity.legalName}</p>`,
      text: `Hello ${name},\n\nWe've received your data-protection complaint and logged it as ${caseRef}.\n\nWe'll investigate and respond without undue delay, and we'll tell you the outcome. If you need to add anything, reply to this email quoting your case reference.\n\nYou also have the right to complain to the UK Information Commissioner's Office at ico.org.uk.\n\n${legalConfig.entity.legalName}`,
    });
    await service
      .from("data_complaints")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .eq("case_ref", caseRef);
    acknowledged = true;
  } catch (e) {
    console.error("complaint acknowledgement email failed (non-fatal):", e);
  }

  // Tell the team — an unread complaint inbox is how a 30-day deadline is missed.
  try {
    await sendEmail({
      purpose: "transactional",
      to: legalConfig.contact.privacy,
      subject: `[${caseRef}] Data-protection complaint received`,
      html: `<p><strong>${caseRef}</strong></p><p>From: ${name} &lt;${email}&gt; (${relationship || "not stated"})</p><p>${nature.replace(/</g, "&lt;")}</p><p>Acknowledgement due within 30 days of receipt.</p>`,
      text: `${caseRef}\nFrom: ${name} <${email}> (${relationship || "not stated"})\n\n${nature}\n\nAcknowledgement due within 30 days of receipt.`,
    });
  } catch (e) {
    console.error("complaint internal notification failed (non-fatal):", e);
  }

  return { ok: true, caseRef, acknowledged };
}
