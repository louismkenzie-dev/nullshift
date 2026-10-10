import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { rateLimitAllow, requestIp } from "@nullshift/db/rateLimit";
import { PRODUCTS } from "@nullshift/content/products";
import { sendEmail } from "@/lib/sendEmail";
import { sha256 } from "@/lib/products/keys";
import { estimate } from "@/lib/quote-widget/engine";
import { countLeadsThisMonth, resolvePublicWidget } from "@/lib/quote-widget/data";
import {
  leadConfirmationEmail,
  leadNotificationEmail,
} from "@/lib/quote-widget/leadEmail";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Body = {
  serviceId?: string;
  quantity?: number;
  answers?: Record<string, string>;
  name?: string;
  email?: string;
  phone?: string;
  postcode?: string;
  message?: string;
  sourceUrl?: string;
  website?: string; // honeypot
  startedAt?: number; // time trap
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/**
 * Record a lead. The estimate is recomputed HERE from the stored config — the
 * browser's figure is never trusted or even read. Honeypot + time trap drop
 * obvious bots; a durable per-IP limiter stops the rest.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const hit = await resolvePublicWidget(key);
  if (!hit)
    return NextResponse.json(
      { error: "Widget unavailable" },
      { status: 404, headers: CORS }
    );

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400, headers: CORS });
  }

  // Bots: pretend it worked.
  if (body.website) return NextResponse.json({ ok: true }, { headers: CORS });
  if (typeof body.startedAt === "number" && Date.now() - body.startedAt < 3000)
    return NextResponse.json({ ok: true }, { headers: CORS });

  const ip = requestIp(req);
  if (!(await rateLimitAllow("widget-lead", `${key}:${ip}`, 8, 3600)))
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: CORS }
    );

  const name = s(body.name, 120);
  const email = s(body.email, 200).toLowerCase();
  if (!name || !EMAIL_RE.test(email))
    return NextResponse.json(
      { error: "Please give your name and a valid email." },
      { status: 400, headers: CORS }
    );

  const { widget } = hit;
  const answers = typeof body.answers === "object" && body.answers ? body.answers : {};
  const est = estimate(widget.config, {
    serviceId: s(body.serviceId, 40),
    quantity: typeof body.quantity === "number" ? body.quantity : undefined,
    answers: Object.fromEntries(
      Object.entries(answers).map(([k, v]) => [s(k, 40), s(v, 40)])
    ),
  });
  if (!est.ok)
    return NextResponse.json({ error: est.error }, { status: 400, headers: CORS });

  // Monthly allowance: the widget keeps showing prices, we just stop storing
  // beyond the limit and tell the owner in the console.
  const used = await countLeadsThisMonth(widget.tenant_id);
  const limit = PRODUCTS.quote.limits.leadsPerMonth;
  const stored = used < limit;

  const db = createServiceClient();
  if (stored) {
    await db.from("widget_leads").insert({
      widget_id: widget.id,
      tenant_id: widget.tenant_id,
      name,
      email,
      phone: s(body.phone, 40) || null,
      postcode: s(body.postcode, 12).toUpperCase() || null,
      message: s(body.message, 1000) || null,
      service_id: est.service.id,
      service_name: est.service.name,
      quantity: est.quantity,
      answers: est.answerSummary,
      low_pence: est.lowPence,
      base_pence: est.basePence,
      high_pence: est.highPence,
      source_url: s(body.sourceUrl, 500) || null,
      ip_hash: sha256(ip).slice(0, 32),
    });
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  const lead = {
    name,
    email,
    phone: s(body.phone, 40) || null,
    postcode: s(body.postcode, 12) || null,
    message: s(body.message, 1000) || null,
  };
  if (widget.notify_email) {
    const m = leadNotificationEmail({
      businessName: widget.config.businessName,
      lead,
      estimate: est,
      sourceUrl: s(body.sourceUrl, 500) || null,
      dashboardUrl: `${site}/app/quote/leads`,
    });
    void sendEmail({
      to: widget.notify_email,
      subject: m.subject,
      html: m.html,
      text: m.text,
      purpose: "transactional",
      replyTo: email,
    });
  }
  const c = leadConfirmationEmail({
    businessName: widget.config.businessName,
    lead,
    estimate: est,
    disclaimer: widget.config.disclaimer,
  });
  void sendEmail({
    to: email,
    subject: c.subject,
    html: c.html,
    text: c.text,
    purpose: "transactional",
    replyTo: widget.notify_email ?? undefined,
  });

  return NextResponse.json(
    {
      ok: true,
      lowPence: est.lowPence,
      highPence: est.highPence,
      includesVat: est.includesVat,
    },
    { headers: CORS }
  );
}
