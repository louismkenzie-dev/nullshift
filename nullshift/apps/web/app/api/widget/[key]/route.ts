import { NextResponse } from "next/server";
import { resolvePublicWidget } from "@/lib/quote-widget/data";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60, s-maxage=60",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Public widget config. Nothing private lives in config; notify_email is never sent. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const hit = await resolvePublicWidget(key);
  if (!hit)
    return NextResponse.json(
      { error: "Widget unavailable" },
      { status: 404, headers: CORS }
    );
  return NextResponse.json(
    { key, config: hit.widget.config, poweredBy: hit.trialing },
    { headers: CORS }
  );
}
