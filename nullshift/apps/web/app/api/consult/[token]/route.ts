import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import {
  researchBusiness,
  generateConsultation,
  streamMockup,
  sanitizeMockupHtml,
  type ConsultationPlan,
  type MockupSpec,
} from "@nullshift/agents/consultation";
import { logAgentRun } from "@nullshift/agents/runs";

/** Agent Consultation generation, keyed by the unguessable plan_token.
 *
 *  GET  → current state ({ status, plan?, hasMockup }) — cheap poll.
 *  POST ?phase=plan   → research the business online + draft the tailored plan
 *                       (SSE: status research/planning → plan → done)
 *  POST ?phase=mockup → build the bespoke frontend mockup
 *                       (SSE: status building → mockup_delta* → mockup_ready → done)
 *
 *  Two phases = two serverless invocations, so research+plan and the mockup
 *  each get a full execution window. DB status drives the claim locks:
 *    pending → generating → plan_ready → building → ready | failed
 *  Generation happens on first /plan view; the token is the capability.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN_RE = /^[0-9a-f-]{8,64}$/i;

type Lead = {
  id: string;
  name: string | null;
  quiz_answers: { answers?: Record<string, string> } | null;
  plan: { businessName?: string; name?: string; segment?: string } | null;
};

async function loadLead(token: string): Promise<Lead | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, quiz_answers, plan")
    .eq("plan_token", token)
    .maybeSingle();
  return (data as Lead | null) ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_RE.test(token))
    return NextResponse.json({ error: "bad token" }, { status: 400 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_consultations")
    .select("status, plan, mockup_html")
    .eq("plan_token", token)
    .maybeSingle();

  if (!data) return NextResponse.json({ status: "pending" });
  return NextResponse.json({
    status: data.status,
    plan: (data.plan as ConsultationPlan | null) ?? null,
    hasMockup: Boolean(data.mockup_html),
  });
}

const sseHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_RE.test(token))
    return NextResponse.json({ error: "bad token" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "agent not configured" }, { status: 503 });

  const phase = new URL(req.url).searchParams.get("phase") ?? "plan";
  const lead = await loadLead(token);
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const supabase = createServiceClient();
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

  const currentState = async () => {
    const { data } = await supabase
      .from("agent_consultations")
      .select("status, plan, mockup_html")
      .eq("plan_token", token)
      .maybeSingle();
    return NextResponse.json({
      status: data?.status ?? "pending",
      plan: data?.plan ?? null,
      hasMockup: Boolean(data?.mockup_html),
    });
  };

  const answers = lead.quiz_answers?.answers ?? {};
  const businessName = lead.plan?.businessName ?? null;
  const segment = lead.plan?.segment ?? null;

  /* ── Phase 1: research + tailored plan ─────────────────────────── */
  if (phase === "plan") {
    await supabase
      .from("agent_consultations")
      .upsert(
        { plan_token: token },
        { onConflict: "plan_token", ignoreDuplicates: true }
      );

    // Claim pending/failed rows — or rescue a 'generating' row whose invocation
    // died (updated_at older than the 300s execution cap + margin).
    const staleIso = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const { data: claimed } = await supabase
      .from("agent_consultations")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("plan_token", token)
      .or(
        `status.in.(pending,failed),and(status.eq.generating,updated_at.lt.${staleIso})`
      )
      .select("plan_token");
    if (!claimed || claimed.length === 0) return currentState();

    const stream = new ReadableStream({
      async start(controller) {
        const fail = async (message: string) => {
          await supabase
            .from("agent_consultations")
            .update({
              status: "failed",
              error: message,
              updated_at: new Date().toISOString(),
            })
            .eq("plan_token", token);
          send(controller, { type: "error", message });
          controller.close();
        };

        try {
          // ── Research: find the business online (best-effort — a research
          //    failure never blocks the plan). ──
          send(controller, { type: "status", status: "researching" });
          let research: string | null = null;
          const t0 = Date.now();
          try {
            const r = await researchBusiness({
              businessName,
              websiteUrl: answers.website_url ?? null,
              answers,
            });
            research = r.brief;
            await logAgentRun({
              agent: "consultation.research",
              trigger: "plan_view",
              planToken: token,
              status: "ok",
              usage: r.usage,
              durationMs: Date.now() - t0,
            });
          } catch (e) {
            await logAgentRun({
              agent: "consultation.research",
              trigger: "plan_view",
              planToken: token,
              status: "error",
              durationMs: Date.now() - t0,
              error: e instanceof Error ? e.message : "unknown",
            });
          }

          // ── Tailored plan + CRM enrichment ──
          send(controller, { type: "status", status: "planning" });
          const t1 = Date.now();
          let consultation;
          try {
            consultation = await generateConsultation({
              answers,
              name: lead.name,
              businessName,
              segment,
              research,
            });
          } catch (e) {
            await logAgentRun({
              agent: "consultation.plan",
              trigger: "plan_view",
              planToken: token,
              status: "error",
              durationMs: Date.now() - t1,
              error: e instanceof Error ? e.message : "unknown",
            });
            await fail("The agent couldn't draft your plan just now. Refresh to retry.");
            return;
          }
          await logAgentRun({
            agent: "consultation.plan",
            trigger: "plan_view",
            planToken: token,
            status: "ok",
            usage: consultation.usage,
            durationMs: Date.now() - t1,
          });

          await supabase
            .from("agent_consultations")
            .update({
              plan: consultation.plan,
              enrichment: consultation.enrichment,
              mockup_spec: consultation.mockupSpec,
              research,
              status: "plan_ready",
              error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("plan_token", token);

          // CRM autofill — server-side write; the model never touches the DB.
          await supabase
            .from("leads")
            .update({ agent_enrichment: consultation.enrichment })
            .eq("id", lead.id);

          send(controller, { type: "plan", plan: consultation.plan });
          send(controller, { type: "done", phase: "plan" });
          controller.close();
        } catch (e) {
          console.error("consult plan phase failed:", e);
          try {
            await fail("Something went wrong. Refresh to retry.");
          } catch {
            controller.close();
          }
        }
      },
    });
    return new Response(stream, { headers: sseHeaders });
  }

  /* ── Phase 2: the bespoke mockup ───────────────────────────────── */
  if (phase === "mockup") {
    const staleIso = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const { data: claimed } = await supabase
      .from("agent_consultations")
      .update({ status: "building", updated_at: new Date().toISOString() })
      .eq("plan_token", token)
      .or(`status.eq.plan_ready,and(status.eq.building,updated_at.lt.${staleIso})`)
      .select("mockup_spec");
    if (!claimed || claimed.length === 0) return currentState();

    const spec = claimed[0].mockup_spec as MockupSpec | null;
    if (!spec) {
      await supabase
        .from("agent_consultations")
        .update({ status: "ready", error: "mockup_spec_missing" })
        .eq("plan_token", token);
      return NextResponse.json({ status: "ready", hasMockup: false });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const t0 = Date.now();
        let raw = "";
        try {
          send(controller, { type: "status", status: "building" });
          const mockupStream = streamMockup({ spec, answers });
          mockupStream.on("text", (delta) => {
            raw += delta;
            send(controller, { type: "mockup_delta", chars: raw.length });
          });
          const final = await mockupStream.finalMessage();
          if (final.stop_reason === "refusal") throw new Error("mockup_refused");
          if (final.stop_reason === "max_tokens") throw new Error("mockup_truncated");

          const html = sanitizeMockupHtml(raw);
          if (!html) throw new Error("mockup_invalid");

          await supabase
            .from("agent_consultations")
            .update({
              mockup_html: html,
              status: "ready",
              error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("plan_token", token);

          await logAgentRun({
            agent: "consultation.mockup",
            trigger: "plan_view",
            planToken: token,
            status: "ok",
            usage: final.usage,
            durationMs: Date.now() - t0,
          });
          send(controller, { type: "mockup_ready" });
          send(controller, { type: "done", phase: "mockup" });
          controller.close();
        } catch (e) {
          await logAgentRun({
            agent: "consultation.mockup",
            trigger: "plan_view",
            planToken: token,
            status: "error",
            durationMs: Date.now() - t0,
            error: e instanceof Error ? e.message : "unknown",
          });
          // The plan is safe — surface ready-without-mockup rather than failed.
          await supabase
            .from("agent_consultations")
            .update({
              status: "ready",
              error: "mockup_failed",
              updated_at: new Date().toISOString(),
            })
            .eq("plan_token", token);
          send(controller, { type: "mockup_error" });
          send(controller, { type: "done", phase: "mockup" });
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: sseHeaders });
  }

  return NextResponse.json({ error: "bad phase" }, { status: 400 });
}
