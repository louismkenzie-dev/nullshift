import { NextResponse } from "next/server";
import { agentsConfigured } from "@nullshift/agents/client";
import { getLeadByToken, resolvePublicEmbed } from "@/lib/plan-embed/data";
import { generateForLead } from "@/lib/plan-embed/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const hit = await resolvePublicEmbed(key);
  if (!hit)
    return NextResponse.json({ error: "Unavailable" }, { status: 404, headers: CORS });
  let token = "";
  try {
    token = String(((await req.json()) as { token?: string }).token ?? "");
  } catch {
    /* fall through */
  }
  const lead = await getLeadByToken(token);
  if (!lead || lead.embed_id !== hit.embed.id)
    return NextResponse.json({ error: "Unknown plan" }, { status: 404, headers: CORS });
  if (!agentsConfigured())
    return NextResponse.json(
      { status: "failed", error: "Plan writing is not configured on this server." },
      { status: 503, headers: CORS }
    );
  const done = lead.status === "pending" ? await generateForLead(hit.embed, lead) : lead;
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(
    /\/$/,
    ""
  );
  return NextResponse.json(
    {
      status: done.status,
      error: done.error,
      planUrl: `${site}/p/${key}/plan/${done.token}`,
    },
    { headers: CORS }
  );
}
