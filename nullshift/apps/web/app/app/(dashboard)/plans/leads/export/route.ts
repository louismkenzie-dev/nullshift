import { appSessionOrNull } from "@/lib/products/session";
import { entitlementFor } from "@/lib/products/entitlement";
import { listLeads } from "@/lib/plan-embed/data";

export const dynamic = "force-dynamic";
const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const session = await appSessionOrNull();
  if (!session) return new Response("Unauthorised", { status: 401 });
  if (!(await entitlementFor(session.workspace.tenantId, "plans")).entitled)
    return new Response("Forbidden", { status: 403 });
  const leads = await listLeads(session.workspace.tenantId, 5000);
  const head = [
    "created_at",
    "name",
    "email",
    "phone",
    "business",
    "sector",
    "team_size",
    "bottleneck",
    "bottleneck_detail",
    "tools",
    "goal",
    "budget",
    "plan_headline",
    "recommended",
    "lead_status",
    "source_url",
  ];
  const rows = leads.map((l) =>
    [
      l.created_at,
      l.name,
      l.email,
      l.phone,
      l.business_name,
      l.answers.sector,
      l.answers.teamSize,
      l.answers.bottleneck,
      l.answers.bottleneckDetail,
      l.answers.tools,
      l.answers.goal,
      l.answers.budget,
      l.plan?.headline,
      l.plan?.recommendedServices.map((s) => s.service).join("; "),
      l.lead_status,
      l.source_url,
    ]
      .map(cell)
      .join(",")
  );
  return new Response([head.join(","), ...rows].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plan-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
