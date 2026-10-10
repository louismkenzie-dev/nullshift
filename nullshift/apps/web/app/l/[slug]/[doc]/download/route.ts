import { hostedUrl, resolvePublicSite } from "@/lib/legal-docs/data";
import {
  DOC_TITLE,
  docToHtml,
  enabledDocs,
  generateDoc,
  type DocKey,
} from "@/lib/legal-docs/generate";

export const dynamic = "force-dynamic";

/** Standalone HTML of one document, for pasting into another CMS. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; doc: string }> }
) {
  const { slug, doc } = await params;
  const hit = await resolvePublicSite(slug);
  if (!hit || !(doc in DOC_TITLE)) return new Response("Not found", { status: 404 });
  const key = doc as DocKey;
  if (!enabledDocs(hit.site.facts).includes(key))
    return new Response("Not found", { status: 404 });
  const business = hit.site.facts.tradingName || hit.site.facts.legalName;
  const html = docToHtml(generateDoc(key, hit.site.facts, hostedUrl(slug)), {
    business,
    version: String(hit.site.version),
    updated: new Date(hit.site.updated_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${key}.html"`,
    },
  });
}
