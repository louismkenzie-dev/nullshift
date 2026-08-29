import { createServiceClient } from "@nullshift/db";

/** Serves the generated mockup document for the sandboxed iframe on
 *  /plan/[token]. Defence in depth, in order of importance:
 *   1. The embedding iframe uses sandbox="allow-scripts" WITHOUT
 *      allow-same-origin — the document runs in an opaque origin.
 *   2. The CSP below denies every network direction the document could take
 *      (no fetch/XHR/WS, no external scripts/styles/frames; images data: only).
 *   3. sanitizeMockupHtml() already rejected documents with network calls.
 *  The token is the capability; no auth cookie is ever relevant here.
 */

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f-]{8,64}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return new Response("Bad token", { status: 400 });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_consultations")
    .select("mockup_html")
    .eq("plan_token", token)
    .maybeSingle();

  if (!data?.mockup_html) return new Response("Not found", { status: 404 });

  return new Response(data.mockup_html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, max-age=300",
    },
  });
}
