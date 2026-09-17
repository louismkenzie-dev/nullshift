import { createHash } from "node:crypto";
import { createServiceClient } from "@nullshift/db";
import { recordLead } from "@nullshift/db/leads";
import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { requestIp } from "@nullshift/db/rateLimit";
import { projectEnquiryLead, validateProjectEnquiry } from "@/lib/projectEnquiry";
import { projectEnquiryEmails } from "@/lib/projectEnquiryEmail";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  // Next can expose an internal hostname in request.url behind a proxy (and
  // localhost when the browser visits 127.0.0.1). Compare the actual Host header.
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
    if (!reader) return json({ error: "Please complete the enquiry." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        return json({ error: "This enquiry is too long." }, 413);
      }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "Please complete the enquiry." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Please complete the enquiry." }, 400);
  }
  if (body.website)
    return json(
      { error: "Unable to submit this enquiry. Please contact us directly." },
      400
    );
  const result = validateProjectEnquiry(body);
  if (!result.ok)
    return json(
      { error: "Please check the highlighted fields.", errors: result.errors },
      400
    );

  // Explicit local demo only; never silently pretend an enquiry was saved.
  if (body.preview === true) {
    if (process.env.NODE_ENV === "development" && !hasSupabaseServerConfig())
      return json({ ok: true, preview: true, receiptEmailSent: false });
    return json({ error: "Preview submission is unavailable here." }, 400);
  }
  if (!hasSupabaseServerConfig())
    return json(
      {
        error: "Online enquiries are temporarily unavailable. Please email us directly.",
      },
      503
    );
  const data = result.data;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  try {
    // This endpoint fails closed if its durable spam protection is unavailable.
    const db = createServiceClient();
    for (const identity of ["ip:" + requestIp(request), "email:" + data.email]) {
      const limit = await db.rpc("rate_limit_hit", {
        p_key: "project-enquiry:" + hash(identity),
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
    const lead = await recordLead(projectEnquiryLead(data));
    if (!lead.ok)
      return json(
        { error: "Your enquiry wasn’t saved. Please try again or email us directly." },
        503
      );
  } catch {
    return json(
      { error: "Your enquiry wasn’t saved. Please try again or email us directly." },
      503
    );
  }

  // Transactional acknowledgement only. No audience subscription, account,
  // generated plan, or paid AI work is triggered by a project enquiry.
  let receiptEmailSent = false;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const emails = projectEnquiryEmails(data);
      const from = process.env.ENQUIRY_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
      const notify = process.env.ENQUIRY_NOTIFY_EMAIL;
      const key = hash(JSON.stringify(data) + new Date().toISOString().slice(0, 10));
      if (from) {
        const results = await Promise.all([
          resend.emails.send(
            {
              from,
              to: data.email,
              ...emails.receipt,
              ...(notify ? { replyTo: notify } : {}),
            },
            { idempotencyKey: `project-receipt/${key}` }
          ),
          notify
            ? resend.emails.send(
                { from, to: notify, replyTo: data.email, ...emails.owner },
                { idempotencyKey: `project-owner/${key}` }
              )
            : Promise.resolve(null),
        ]);
        receiptEmailSent = Boolean(results[0]?.data && !results[0]?.error);
        if (results.some((item) => item?.error))
          console.error("Project enquiry saved; email delivery needs attention.");
      }
    } catch {
      console.error("Project enquiry saved; email delivery unavailable.");
    }
  }
  return json({ ok: true, preview: false, receiptEmailSent });
}
