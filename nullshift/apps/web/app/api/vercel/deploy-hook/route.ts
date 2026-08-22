import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { mirrorFromWebhook, verifyVercelSignature } from "@/lib/soc2/deployMirror";
import { logSoc2Event } from "@/lib/soc2/events";

export const dynamic = "force-dynamic";

/**
 * Vercel deploy webhook → SOC 2 change register mirror.
 *
 * Configure once, team-wide (Vercel → Team Settings → Webhooks): event
 * `deployment.succeeded`, URL https://nullshift.co.uk/api/vercel/deploy-hook,
 * and put the generated secret in VERCEL_DEPLOY_HOOK_SECRET. From then on
 * every PRODUCTION deployment in the team — this platform and every hosted
 * client system — lands as a soc2_change_records row: commit link, author,
 * branch, deployment id, and the Claude-Session trailer when a Claude Code
 * session authored the commit. Reviewer/approval/test evidence stay human;
 * the sweep flags records still missing them after the annotation grace.
 *
 * Idempotent: deploy_ref carries a partial unique index (0038), so Vercel's
 * retries and duplicate events cannot double-create a record. Rollback plan
 * is prefilled because on Vercel it is always true: instant rollback to the
 * previous deployment.
 */
export async function POST(request: Request) {
  const secret = process.env.VERCEL_DEPLOY_HOOK_SECRET;
  if (!secret) {
    // Unconfigured deployments stay honest: say so, never guess a signature.
    return NextResponse.json({ error: "mirror not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyVercelSignature(rawBody, request.headers.get("x-vercel-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: Parameters<typeof mirrorFromWebhook>[0];
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const mirrored = mirrorFromWebhook(event);
  // Non-production or unrelated events are acknowledged and ignored.
  if (!mirrored) return NextResponse.json({ ok: true, mirrored: false });

  const db = createServiceClient();
  const { data: existing } = await db
    .from("soc2_change_records")
    .select("id")
    .eq("deploy_ref", mirrored.deployRef)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, mirrored: false, duplicate: true });

  const { data: ref } = await db.rpc("next_soc2_change_ref");
  if (!ref) {
    return NextResponse.json({ error: "ref allocation failed" }, { status: 500 });
  }

  const { data: created, error } = await db
    .from("soc2_change_records")
    .insert({
      ref,
      title: mirrored.title,
      change_ref: mirrored.changeRef,
      ticket_ref: mirrored.ticketRef,
      requested_by: mirrored.requestedBy,
      rollback_plan: `Vercel instant rollback to the previous production deployment of ${mirrored.projectName}.`,
      deployed_at: mirrored.deployedAt,
      deploy_ref: mirrored.deployRef,
      status: "deployed",
    })
    .select("id, ref")
    .single();
  if (error || !created) {
    // A concurrent retry may have won the unique index — that is success.
    if (error?.code === "23505") {
      return NextResponse.json({ ok: true, mirrored: false, duplicate: true });
    }
    console.error("deploy-hook mirror insert failed:", error?.message);
    return NextResponse.json({ error: "mirror insert failed" }, { status: 500 });
  }

  await logSoc2Event({
    recordType: "change_record",
    recordId: created.id,
    type: "mirrored",
    summary: `${created.ref} mirrored from Vercel: ${mirrored.title.slice(0, 120)} (branch ${mirrored.commitRef ?? "?"}${mirrored.ticketRef ? ", Claude Code session linked" : ""}).`,
    detail: {
      deploy_ref: mirrored.deployRef,
      project: mirrored.projectName,
      branch: mirrored.commitRef,
    },
    actor: "system:deploy-hook",
    asService: true,
  });

  return NextResponse.json({ ok: true, mirrored: true, ref: created.ref });
}
