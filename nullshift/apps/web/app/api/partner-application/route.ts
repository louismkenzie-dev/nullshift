import { createHash } from "node:crypto";
import { createServiceClient } from "@nullshift/db";
import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { requestIp } from "@nullshift/db/rateLimit";
import { legalConfig } from "@nullshift/content/legal/config";
import {
  partnerApplicationRow,
  validatePartnerApplication,
} from "@/lib/partnerApplication";
import {
  partnerApplicationOwnerEmail,
  partnerApplicationReceiptEmail,
} from "@/lib/partnerApplicationEmail";
import { sendEmail } from "@/lib/sendEmail";

/**
 * Public partner-programme application intake (/partners). Mirrors the
 * project-enquiry endpoint: same-origin check, bounded JSON body, honeypot,
 * durable rate limit that fails closed, service-role insert, then two
 * transactional emails. An application is never an acceptance.
 */

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      const host = request.headers.get("host") || new URL(request.url).host;
      if (!/^https?:$/.test(source.protocol) || source.host !== host)
        return json({ error: "Please submit the form from the Nullshift website." }, 403);
    } catch {
      return json({ error: "Please submit the form from the Nullshift website." }, 403);
    }
  }
  if (!request.headers.get("content-type")?.includes("application/json"))
    return json({ error: "Invalid request format." }, 415);

  let body: Record<string, unknown>;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Please complete the application." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        return json({ error: "This application is too long." }, 413);
      }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "Please complete the application." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Please complete the application." }, 400);
  }

  // Honeypot. The visible form never has a "company_url" field.
  if (body.company_url)
    return json(
      { error: "Unable to submit this application. Please contact us directly." },
      400
    );

  const result = validatePartnerApplication(body);
  if (!result.ok)
    return json(
      { error: "Please check the highlighted fields.", errors: result.errors },
      400
    );

  if (body.preview === true) {
    if (process.env.NODE_ENV === "development" && !hasSupabaseServerConfig())
      return json({ ok: true, preview: true, receiptEmailSent: false });
    return json({ error: "Preview submission is unavailable here." }, 400);
  }
  if (!hasSupabaseServerConfig())
    return json(
      {
        error:
          "Online applications are temporarily unavailable. Please email us directly.",
      },
      503
    );

  const data = result.data;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const ip = requestIp(request);
  try {
    const db = createServiceClient();
    for (const identity of ["ip:" + ip, "email:" + data.email]) {
      const limit = await db.rpc("rate_limit_hit", {
        p_key: "partner-application:" + hash(identity),
        p_limit: 5,
        p_window_seconds: 3600,
      });
      if (limit.error)
        return json(
          { error: "We couldn’t submit this just now. Please try again shortly." },
          503
        );
      if (limit.data !== true)
        return json(
          { error: "Too many attempts. Please try again later or email us directly." },
          429
        );
    }
    const { error } = await db
      .from("partner_applications")
      .insert(partnerApplicationRow(data, ip && ip !== "unknown" ? ip : null));
    if (error) throw error;
  } catch {
    return json(
      {
        error: "Your application wasn’t saved. Please try again or email us directly.",
      },
      503
    );
  }

  // Transactional only: a receipt to the applicant and a heads-up to the
  // partner inbox. Neither subscribes anyone to anything.
  const notify = process.env.PARTNER_NOTIFY_EMAIL || legalConfig.contact.general;
  const owner = partnerApplicationOwnerEmail(data);
  const receipt = partnerApplicationReceiptEmail(data);
  const [receiptEmailSent] = await Promise.all([
    sendEmail({
      to: data.email,
      purpose: "transactional",
      replyTo: notify,
      ...receipt,
    }),
    sendEmail({ to: notify, purpose: "transactional", replyTo: data.email, ...owner }),
  ]);
  return json({ ok: true, preview: false, receiptEmailSent });
}
