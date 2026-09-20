"use server";
import { revalidatePath } from "next/cache";
import { operationsSession } from "@/lib/next/live-data";
import { quoteBuilderEnabled } from "@/lib/next/quote-data";
import { parseQuote, quoteTotals, uuidPattern } from "@/lib/next/quote-builder";
import { isClientPreview } from "@/lib/clientPreview";

export async function saveBuilderQuote(input: {
  id: string;
  updatedAt: string | null;
  draft: unknown;
}): Promise<{ ok: true; id: string; updatedAt: string } | { ok: false; error: string }> {
  if (!quoteBuilderEnabled())
    return { ok: false, error: "Quote saving is not enabled in this environment." };
  const { db } = await operationsSession();
  if (await isClientPreview())
    return { ok: false, error: "Leave client preview before editing a quote." };
  if (
    !input ||
    typeof input.id !== "string" ||
    !uuidPattern.test(input.id) ||
    !(
      input.updatedAt === null ||
      (typeof input.updatedAt === "string" &&
        Number.isFinite(Date.parse(input.updatedAt)))
    )
  )
    return {
      ok: false,
      error: "Invalid quote reference. Reopen the quote and try again.",
    };
  const parsed = parseQuote(input.draft);
  if (!parsed.ok) return parsed;
  const { document: d, costs } = parsed.value;
  if (d.clientId) {
    const { data, error } = await db
      .from("tenants")
      .select("id")
      .eq("id", d.clientId)
      .eq("type", "client")
      .maybeSingle();
    if (error || !data)
      return {
        ok: false,
        error: "That client is no longer available. Please choose again.",
      };
  }
  const t = quoteTotals(d, costs);
  const { data, error } = await db.rpc("ops_save_quote_draft", {
    p_id: input.id,
    p_expected_updated_at: input.updatedAt,
    p_tenant_id: d.clientId || null,
    p_business: d.business,
    p_email: d.email || null,
    p_title: d.title,
    p_brief: { outcomes: [d.summary], users: "", constraints: "", confidence: "medium" },
    p_scope: {
      included: d.included.split("\n"),
      excluded: d.excluded.split("\n").filter(Boolean),
      acceptance: d.acceptance.split("\n"),
    },
    p_estimate: {
      packages: [],
      contingency_pct: costs.contingencyPct,
      warranty_reserve_minor: costs.reserveMinor,
    },
    p_commercial: {
      builder: d,
      build_price_minor: t.build,
      milestones: d.milestones,
      route: d.route,
      run_state:
        d.monthlyMinor === null
          ? "To be agreed after build acceptance"
          : "Proposed; not activated",
      grow_options: [],
      transact:
        d.transactPct === null ? "Not proposed" : `${d.transactPct}% plus processor fees`,
    },
    p_internal: {
      builderCosts: costs,
      risk_adjusted_cost_minor: t.cost,
      target_margin_pct: costs.targetMarginPct,
      min_margin_pct: 0,
      approved_price_minor: 0,
      approver: "",
      checks: [],
    },
  });
  if (error)
    return {
      ok: false,
      error: /stale|frozen|identity/i.test(error.message)
        ? "This quote changed elsewhere or is no longer editable. Reload before saving; your changes have not overwritten it."
        : "The quote could not be saved. Your inputs are still here; please retry.",
    };
  revalidatePath("/admin/next/sales");
  revalidatePath("/admin/next/quotes");
  revalidatePath(`/admin/next/quotes/${input.id}`);
  return { ok: true, id: input.id, updatedAt: String(data.updated_at) };
}
