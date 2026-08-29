import { NextResponse } from "next/server";
import { createServiceClient } from "@nullshift/db";
import { mirrorFromWebhook, verifyVercelSignature } from "@/lib/soc2/deployMirror";
import { logSoc2Event } from "@/lib/soc2/events";

export const dynamic = "force-dynamic";

/**
 * Deploy event → SOC 2 change register mirror.
 *
 * Every PRODUCTION deployment lands here as a soc2_change_records row: commit
 * link, author, branch, deployment id, and the Claude-Session trailer when a
 * Claude Code session authored the commit. Reviewer/approval/test evidence
 * stay human; the sweep flags records still missing them after the annotation
 * grace window.
 *
 * Two transports can feed it, and the route is deliberately indifferent to
 * which — it authenticates the SIGNATURE, not the sender:
 *  - GitHub Actions (.github/workflows/soc2-change-mirror.yml), free on a
 *    public repo, signing with SOC2_DEPLOY_HOOK_SECRET. Covers this repo, and
 *    replays nightly so a missed event never leaves a silent gap.
 *  - The Vercel team webhook (paid plans): Team Settings → Webhooks, event
 *    `deployment.succeeded`. Covers every project in the team at once.
 * Either way the shared value lives in VERCEL_DEPLOY_HOOK_SECRET here.
 *
 * Idempotent: deploy_ref carries a partial unique index (0038) and the commit
 * is checked too, so retries, replays and both transports at once cannot
 * double-create a record. Rollback plan is prefilled because on Vercel it is
 * always true: instant rollback to the previous deployment.
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
  // Dedupe on the deployment AND on the commit. Two transports can feed this
  // endpoint — the Vercel team webhook (which keys a deployment by its dpl_
  // id) and the free GitHub Actions mirror (which keys it by the deployment
  // hostname) — so without the commit check a repo running both would
  // register every release twice. Redeploying an unchanged commit is likewise
  // not a new change to the system.
  const alreadyRegistered = async (column: "deploy_ref" | "change_ref", value: string) => {
    const { data } = await db
      .from("soc2_change_records")
      .select("id")
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  };
  const duplicate =
    (await alreadyRegistered("deploy_ref", mirrored.deployRef)) ||
    (mirrored.changeRef ? await alreadyRegistered("change_ref", mirrored.changeRef) : false);
  if (duplicate) return NextResponse.json({ ok: true, mirrored: false, duplicate: true });

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
