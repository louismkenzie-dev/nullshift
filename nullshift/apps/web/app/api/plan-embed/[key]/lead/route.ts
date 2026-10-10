import { NextResponse } from "next/server";
import { rateLimitAllow, requestIp } from "@nullshift/db/rateLimit";
import type { PlanAnswers } from "@nullshift/agents/partnerPlan";
import { sha256 } from "@/lib/products/keys";
import {
  createLead,
  monthlyCeiling,
  plansThisMonth,
  resolvePublicEmbed,
} from "@/lib/plan-embed/data";

export const dynamic = "force-dynamic";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const s = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const hit = await resolvePublicEmbed(key);
  if (!hit)
    return NextResponse.json({ error: "Unavailable" }, { status: 404, headers: CORS });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400, headers: CORS });
  }
  if (b.website) return NextResponse.json({ ok: true, token: "x" }, { headers: CORS });
  if (typeof b.startedAt === "number" && Date.now() - b.startedAt < 8000)
    return NextResponse.json({ ok: true, token: "x" }, { headers: CORS });
  const ip = requestIp(req);
  if (!(await rateLimitAllow("plan-lead", `${key}:${ip}`, 3, 3600)))
    return NextResponse.json(
      { error: "Too many requests from this connection. Try again later." },
      { status: 429, headers: CORS }
    );

  const name = s(b.name, 120);
  const email = s(b.email, 200).toLowerCase();
  const answers: PlanAnswers = {
    businessName: s(b.businessName, 120),
    sector: s(b.sector, 160),
    teamSize: s(b.teamSize, 40),
    bottleneck: s(b.bottleneck, 80),
    bottleneckDetail: s(b.bottleneckDetail, 1200),
    tools: s(b.tools, 300),
    goal: s(b.goal, 1200),
    budget: s(b.budget, 60),
  };
  if (
    !name ||
    !EMAIL_RE.test(email) ||
    !answers.businessName ||
    !answers.sector ||
    !answers.bottleneck ||
    !answers.goal
  )
    return NextResponse.json(
      { error: "Please complete every question." },
      { status: 400, headers: CORS }
    );

  const used = await plansThisMonth(hit.embed.tenant_id);
  if (used >= monthlyCeiling())
    return NextResponse.json(
      { error: "This form has reached its monthly limit. Please contact us directly." },
      { status: 429, headers: CORS }
    );

  const lead = await createLead({
    embed: hit.embed,
    name,
    email,
    phone: s(b.phone, 40) || null,
    answers,
    sourceUrl: s(b.sourceUrl, 500) || null,
    ipHash: sha256(ip).slice(0, 32),
  });
  return NextResponse.json({ ok: true, token: lead.token }, { headers: CORS });
}
