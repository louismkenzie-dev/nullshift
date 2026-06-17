import { scoreLead, type Answers } from "@/lib/funnel";
import { clientEmail, ownerEmail } from "@/lib/funnelEmails";

/* Dev-only preview of the funnel emails. Visit:
 *   /api/funnel/preview?type=client&segment=qualified
 *   /api/funnel/preview?type=owner&segment=nurture
 * Returns the rendered HTML so you can eyeball the branded templates.
 * Disabled in production. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get("type") === "owner" ? "owner" : "client";
  const segment = url.searchParams.get("segment") === "nurture" ? "nurture" : "qualified";

  const answers: Answers =
    segment === "qualified"
      ? { has_site: "yes", industry: "salon", provider: "wix", build: "agency", costs: "commission", need: "new", budget: "8kplus", timeline: "asap", blocker: "noleads" }
      : { has_site: "no", industry: "other", industry_other: "Mobile dog grooming", need: "branding", budget: "under1k", timeline: "exploring", blocker: "nothing" };

  const scored = scoreLead(answers);
  const resourceUrl = "https://nullshift.co.uk/resources";
  const bookUrl = "https://nullshift.co.uk/book?segment=" + scored.segment;

  const mail =
    type === "owner"
      ? ownerEmail({ name: "Sophie Clarke", email: "sophie@bloomco.uk", phone: "07700 900123", segment: scored.segment, score: scored.score, answers, recommendation: scored.recommendation, resourceUrl })
      : clientEmail({ name: "Sophie Clarke", segment: scored.segment, recommendation: scored.recommendation, answers, resourceUrl, bookUrl });

  return new Response(mail.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
