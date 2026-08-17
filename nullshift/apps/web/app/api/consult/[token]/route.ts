import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import {
  generateConsultation,
  streamMockup,
  sanitizeMockupHtml,
  type ConsultationPlan,
} from "@nullshift/agents/consultation";
import { logAgentRun } from "@nullshift/agents/runs";

/** Agent Consultation generation, keyed by the unguessable plan_token.
 *
 *  GET  → current state ({ status, plan?, hasMockup }) — cheap, cacheable poll.
 *  POST → claims the pending row and generates live, streaming SSE events:
 *         status → plan → mockup_delta* → mockup_ready → done | error.
 *
 *  Generation happens on first /plan view (not in the funnel POST) so the
 *  funnel completes instantly and the wait becomes visible theatre on the plan
 *  page. The token is the capability; rows are written with the service role.
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

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_RE.test(token))
    return NextResponse.json({ error: "bad token" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "agent not configured" }, { status: 503 });

  const lead = await loadLead(token);
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const supabase = createServiceClient();

  // Ensure a row exists, then claim it. The conditional update is the lock:
  // only one request moves pending|failed → generating; everyone else polls.
  await supabase
    .from("agent_consultations")
    .upsert({ plan_token: token }, { onConflict: "plan_token", ignoreDuplicates: true });

  const { data: claimed } = await supabase
    .from("agent_consultations")
    .update({ status: "generating", updated_at: new Date().toISOString() })
    .eq("plan_token", token)
    .in("status", ["pending", "failed"])
    .select("plan_token");

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

  if (!claimed || claimed.length === 0) {
    // Already generating (another tab) or already ready — tell the client to poll GET.
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
  }

  const answers = lead.quiz_answers?.answers ?? {};
  const businessName = lead.plan?.businessName ?? null;
  const segment = lead.plan?.segment ?? null;

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
        send(controller, { type: "status", status: "planning" });

        // ── Call 1: tailored plan + CRM enrichment ──
        const t0 = Date.now();
        let consultation;
        try {
          consultation = await generateConsultation({
            answers,
            name: lead.name,
            businessName,
            segment,
          });
        } catch (e) {
          await logAgentRun({
            agent: "consultation.plan",
            trigger: "plan_view",
            planToken: token,
            status: "error",
            durationMs: Date.now() - t0,
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
          durationMs: Date.now() - t0,
        });

        await supabase
          .from("agent_consultations")
          .update({
            plan: consultation.plan,
            enrichment: consultation.enrichment,
            updated_at: new Date().toISOString(),
          })
          .eq("plan_token", token);

        // CRM autofill — server-side write, model never touches the DB.
        await supabase
          .from("leads")
          .update({ agent_enrichment: consultation.enrichment })
          .eq("id", lead.id);

        send(controller, { type: "plan", plan: consultation.plan });
        send(controller, { type: "status", status: "building" });

        // ── Call 2: the live mockup, streamed through to the browser ──
        const t1 = Date.now();
        let raw = "";
        try {
          const mockupStream = streamMockup({ spec: consultation.mockupSpec, answers });
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
            durationMs: Date.now() - t1,
          });
        } catch (e) {
          await logAgentRun({
            agent: "consultation.mockup",
            trigger: "plan_view",
            planToken: token,
            status: "error",
            durationMs: Date.now() - t1,
            error: e instanceof Error ? e.message : "unknown",
          });
          // The plan succeeded — keep it. Mark ready-without-mockup rather than failed.
          await supabase
            .from("agent_consultations")
            .update({
              status: "ready",
              error: "mockup_failed",
              updated_at: new Date().toISOString(),
            })
            .eq("plan_token", token);
          send(controller, { type: "mockup_error" });
          send(controller, { type: "done" });
          controller.close();
          return;
        }

        send(controller, { type: "mockup_ready" });
        send(controller, { type: "done" });
        controller.close();
      } catch (e) {
        console.error("consult generation failed:", e);
        try {
          await fail("Something went wrong. Refresh to retry.");
        } catch {
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
