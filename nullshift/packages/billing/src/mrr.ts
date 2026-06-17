/**
 * MRR-to-£8k tracker (brief §5). The single number the whole business steers by:
 * current recurring MRR, active clients, average build fee this month, and the
 * gap to the £8,000/month target.
 *
 * Takes the caller's Supabase client (so it runs in their auth context — staff
 * read across tenants via RLS).
 */

export const MRR_TARGET_GBP = 8000;

// Structural minimum we use from the Supabase client. `select(...)` returns a
// PromiseLike query builder; keep it loose to avoid the generated-generic friction.
type MinimalClient = {
  from: (table: string) => {
    select: (cols: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
  };
};

export type MrrSummary = {
  mrr: number;
  activeClients: number;
  avgBuildFeeThisMonth: number;
  target: number;
  gap: number;
  pctToTarget: number;
};

export async function getMrrSummary(supabase: MinimalClient): Promise<MrrSummary> {
  const [{ data: subs }, { data: projects }] = await Promise.all([
    supabase.from("subscriptions").select("tenant_id, mrr, status"),
    supabase.from("projects").select("build_fee, started_at"),
  ]);

  const activeSubs = (
    (subs ?? []) as { tenant_id: string; mrr: number; status: string }[]
  ).filter((s) => s.status === "active" || s.status === "trialing");
  const mrr = activeSubs.reduce((sum, s) => sum + Number(s.mrr || 0), 0);
  const activeClients = new Set(activeSubs.map((s) => s.tenant_id)).size;

  // Average build fee for projects started this calendar month.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthFees = (
    (projects ?? []) as { build_fee: number | null; started_at: string | null }[]
  )
    .filter(
      (p) =>
        p.build_fee != null &&
        p.started_at &&
        new Date(p.started_at).getTime() >= monthStart
    )
    .map((p) => Number(p.build_fee));
  const avgBuildFeeThisMonth = monthFees.length
    ? Math.round(monthFees.reduce((a, b) => a + b, 0) / monthFees.length)
    : 0;

  const target = MRR_TARGET_GBP;
  const gap = Math.max(0, target - mrr);
  const pctToTarget = target > 0 ? Math.min(100, Math.round((mrr / target) * 100)) : 0;

  return { mrr, activeClients, avgBuildFeeThisMonth, target, gap, pctToTarget };
}
