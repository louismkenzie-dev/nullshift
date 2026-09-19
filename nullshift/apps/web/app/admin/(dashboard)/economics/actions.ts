"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { assessQuote, type QuoteInputs } from "@/lib/economics/quote-model";

async function assertStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorised");
  const { data: isStaff } = await supabase.rpc("is_internal_staff");
  if (!isStaff) throw new Error("Unauthorised");
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const number = (fd: FormData, key: string) => Number(fd.get(key) ?? 0);

export async function logTimeEntry(fd: FormData) {
  await assertStaff();
  const tenantId = text(fd, "tenant_id");
  const hours = number(fd, "hours");
  const internalHourlyCost = number(fd, "internal_hourly_cost") || 40;
  if (!tenantId || !Number.isFinite(hours) || hours <= 0) throw new Error("Invalid time entry");

  const service = createServiceClient();
  const { error } = await service.from("economics_time_entries").insert({
    tenant_id: tenantId,
    project_id: text(fd, "project_id") || null,
    category: text(fd, "category") || "support",
    description: text(fd, "description") || null,
    hours,
    internal_hourly_cost: internalHourlyCost,
    occurred_on: text(fd, "occurred_on") || new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  revalidatePath("/admin/economics");
}

export async function logCostEntry(fd: FormData) {
  await assertStaff();
  const tenantId = text(fd, "tenant_id");
  const amount = number(fd, "amount");
  if (!tenantId || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid cost entry");

  const service = createServiceClient();
  const { error } = await service.from("economics_cost_entries").insert({
    tenant_id: tenantId,
    project_id: text(fd, "project_id") || null,
    category: text(fd, "category") || "other",
    description: text(fd, "description") || "Direct cost",
    amount,
    recurring: fd.get("recurring") === "on",
    occurred_on: text(fd, "occurred_on") || new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  revalidatePath("/admin/economics");
}

export async function saveQuoteAssessment(fd: FormData) {
  await assertStaff();
  const input: QuoteInputs = {
    userRoles: number(fd, "user_roles"),
    integrations: number(fd, "integrations"),
    paymentFlows: number(fd, "payment_flows"),
    adminWorkflows: number(fd, "admin_workflows"),
    aiFeatures: number(fd, "ai_features"),
    authComplexity: Math.max(0, Math.min(3, number(fd, "auth_complexity"))) as 0 | 1 | 2 | 3,
    bookingOrScheduling: fd.get("booking_or_scheduling") === "on",
    subscriptionBilling: fd.get("subscription_billing") === "on",
    dataMigration: fd.get("data_migration") === "on",
    expectedMonthlyTransactions: number(fd, "expected_monthly_transactions"),
    expectedMonthlyActiveUsers: number(fd, "expected_monthly_active_users"),
    clientChangeRisk: Math.max(0, Math.min(3, number(fd, "client_change_risk"))) as 0 | 1 | 2 | 3,
  };
  const assessment = assessQuote(input);
  const prospectName = text(fd, "prospect_name") || "Untitled prospect";
  const tenantId = text(fd, "tenant_id") || null;

  const service = createServiceClient();
  const { error } = await service.from("quote_assessments").insert({
    tenant_id: tenantId,
    prospect_name: prospectName,
    complexity_score: assessment.complexityScore,
    risk_level: assessment.riskLevel,
    recommended_build_fee: assessment.recommendedBuildFee,
    recommended_monthly_fee: assessment.recommendedMonthlyFee,
    recommended_transaction_fee_bps: assessment.recommendedTransactionFeeBps,
    predicted_support_hours: assessment.predictedSupportHours,
    inputs: input,
  });
  if (error) throw error;
  revalidatePath("/admin/economics");
}
