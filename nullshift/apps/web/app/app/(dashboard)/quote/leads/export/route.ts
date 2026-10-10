import { appSessionOrNull } from "@/lib/products/session";
import { entitlementFor } from "@/lib/products/entitlement";
import { listLeads } from "@/lib/quote-widget/data";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const session = await appSessionOrNull();
  if (!session) return new Response("Unauthorised", { status: 401 });
  const ent = await entitlementFor(session.workspace.tenantId, "quote");
  if (!ent.entitled) return new Response("Forbidden", { status: 403 });
  const leads = await listLeads(session.workspace.tenantId, 5000);
  const head = [
    "created_at",
    "name",
    "email",
    "phone",
    "postcode",
    "service",
    "quantity",
    "answers",
    "low_gbp",
    "high_gbp",
    "status",
    "message",
    "source_url",
  ];
  const rows = leads.map((l) =>
    [
      l.created_at,
      l.name,
      l.email,
      l.phone,
      l.postcode,
      l.service_name,
      l.quantity,
      l.answers.map((a) => `${a.question}: ${a.answer}`).join("; "),
      (l.low_pence / 100).toFixed(2),
      (l.high_pence / 100).toFixed(2),
      l.status,
      l.message,
      l.source_url,
    ]
      .map(cell)
      .join(",")
  );
  const csv = [head.join(","), ...rows].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quote-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
