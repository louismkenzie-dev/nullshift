import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { carePlanForNsi } from "@/lib/carePlans";
import { pricesFromAssessment } from "@/lib/pricing/contracted";
import type { AssessmentRow } from "@/lib/pricing/contractedPrice";
import {
  calculateScalePricing,
  ENTERPRISE_FLAG_LABEL,
  PLATFORM_ROLE_LABEL,
  PRICING_VERSION,
  RISK_FLAG_LABEL,
  SCALE_BAND_LABEL,
  type EnterpriseFlags,
  type PlanId,
  type PlatformRole,
  type RiskFlags,
  type ScaleBand,
  type ScaleInput,
} from "@/lib/pricing/nsi";
import { RebandPanel } from "./RebandPanel";
import { DeliverySections } from "../DeliverySections";
import { recordCompliance } from "../../../compliance/actions";
import { GDPR_CONTROLS } from "@/lib/compliance/controls";
import { latestEvidence, runAutoScore } from "@/lib/scoring/autoScore";
import { externalIntegrations, fieldsNeedingAPerson } from "@/lib/scoring/derive";
import { isSupabaseManagementConfigured } from "@/lib/scoring/collectors/supabase";
import {
  FIELD_LABEL,
  type FieldKey,
  type FieldState,
  type FieldStates,
} from "@/lib/scoring/types";

/**
 * Client scale assessment — the Nullshift Scale Index in one screen.
 *
 * Score the client on the five dimensions, see the band, multiplier, margin
 * floor and recommended MRR, then save it. Every save stores the raw inputs
 * with the result and the pricing version, so any quote can be explained back
 * to the client months later. Overrides are allowed but must carry a reason.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) =>
  "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const num = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const on = (fd: FormData, k: string) => fd.get(k) === "on";

function readInput(fd: FormData): ScaleInput {
  const riskKeys = Object.keys(RISK_FLAG_LABEL) as (keyof RiskFlags)[];
  const entKeys = Object.keys(ENTERPRISE_FLAG_LABEL) as (keyof EnterpriseFlags)[];
  return {
    // The score sets the BRACKET. The plan level is the client's choice, made
    // in the portal after go-live — every assessment is anchored on Core and
    // the three prices follow from the band (lib/pricing/contractedPrice.ts).
    plan: "core" as PlanId,
    monthlyActiveUsers: num(fd.get("monthlyActiveUsers")),
    monthlySessions: num(fd.get("monthlySessions")),
    platformRole: String(fd.get("platformRole") || "informational") as PlatformRole,
    annualTurnoverGbp: num(fd.get("annualTurnoverGbp")),
    employeeCount: num(fd.get("employeeCount")),
    directMonthlyVendorCostGbp: num(fd.get("directMonthlyVendorCostGbp")),
    internalActiveUsers: num(fd.get("internalActiveUsers")),
    locationsOrUnits: num(fd.get("locationsOrUnits")),
    riskFlags: Object.fromEntries(riskKeys.map((k) => [k, on(fd, k)])) as RiskFlags,
    enterpriseFlags: Object.fromEntries(
      entKeys.map((k) => [k, on(fd, k)])
    ) as EnterpriseFlags,
  };
}

/** Score the inputs and store the assessment with its full audit trail. */
async function saveAssessment(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;

  const input = readInput(formData);
  const result = calculateScalePricing(input);
  // The scan this assessment was completed from, and which inputs a machine
  // filled vs a person — kept so a quote can be traced back to its evidence.
  const evidenceId = String(formData.get("evidence_id") || "") || null;
  let fieldStates: FieldStates = {};
  try {
    fieldStates = JSON.parse(String(formData.get("field_states") || "{}")) as FieldStates;
  } catch {
    fieldStates = {};
  }

  const service = createServiceClient();
  await service.from("scale_assessments").insert({
    tenant_id: tenantId,
    pricing_version: result.pricingVersion,
    plan: result.plan,
    inputs: input,
    score_audience: result.componentScores.audience,
    score_commercial: result.componentScores.commercialCriticality,
    score_technical: result.componentScores.technicalLoad,
    score_reach: result.componentScores.organisationReach,
    score_risk: result.componentScores.complexityRisk,
    nsi: result.nsi,
    scale_band: result.scaleBand,
    multiplier: result.multiplier,
    base_plan_price: result.basePlanPrice,
    scaled_plan_price: result.scaledPlanPrice,
    direct_cost_floor: result.directCostFloor,
    recommended_mrr: result.recommendedMrr,
    enterprise_review_required: result.enterpriseReviewRequired,
    data_quality: result.dataQuality,
    review_flags: result.reviewFlags,
    created_by: staff.userId,
    evidence_id: evidenceId,
    field_states: fieldStates,
  });
  await logAudit({
    action: "scale_assessment.saved",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: {
      nsi: result.nsi,
      band: result.scaleBand,
      recommendedMrr: result.recommendedMrr,
      pricingVersion: result.pricingVersion,
      evidence: evidenceId,
      autoFields: (Object.keys(fieldStates) as FieldKey[]).filter(
        (k) => fieldStates[k] === "auto"
      ).length,
    },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/billing/direct-debits");
}

/**
 * Read the system — repo + production database — and draft the assessment.
 * Stores a scale_evidence row; the form below is then prefilled from it and
 * only the fields a machine cannot know are left for the person saving.
 */
async function analyseSystem(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  if (!tenantId) return;
  const outcome = await runAutoScore({
    tenantId,
    trigger: "manual",
    actorId: staff.userId,
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
  revalidatePath("/admin/billing/direct-debits");
  if (!outcome.ok)
    redirect(
      `/admin/clients/${tenantId}/pricing?scan_error=${encodeURIComponent(outcome.error)}`
    );
}

/**
 * Set any of the three plan prices by hand. The score sets the bracket and the
 * three prices follow from it; this lets the owner adjust one, two or all
 * three, each with a reason the CLIENT sees next to the price on their
 * chooser and in the plan-options email. Blank price = back to the formula.
 */
async function setPlanPrices(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("assessment_id") || "");
  if (!tenantId || !id) return;

  const next: Record<
    string,
    { mrr: number; reason: string; setBy: string; setAt: string }
  > = {};
  for (const key of ["core", "pro", "max"] as const) {
    const mrr = num(formData.get(`price_${key}`));
    const reason = String(formData.get(`reason_${key}`) || "").trim();
    if (mrr === null) continue;
    // A hand-set price without a reason would show the client a figure with
    // no explanation — refuse the whole save so nothing half-applies.
    if (mrr < 0 || !reason) {
      redirect(`/admin/clients/${tenantId}/pricing?prices_error=${key}`);
    }
    next[key] = { mrr, reason, setBy: staff.userId, setAt: new Date().toISOString() };
  }

  const service = createServiceClient();
  const { data: row } = await service
    .from("scale_assessments")
    .select("plan_prices")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!row) return;
  await service
    .from("scale_assessments")
    .update({ plan_prices: next })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  await logAudit({
    action: "scale_assessment.plan_prices_set",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { assessment: id, before: row.plan_prices ?? {}, after: next },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath("/admin/billing/direct-debits");
}

/** Adopt a figure as the agreed contracted rate — what billing then charges. */
async function agreeMrr(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("assessment_id") || "");
  const amount = num(formData.get("agreed_mrr"));
  if (!tenantId || !id || amount === null || amount < 0) return;

  const service = createServiceClient();
  await service
    .from("scale_assessments")
    .update({ agreed_mrr: amount, agreed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  await logAudit({
    action: "scale_assessment.agreed",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { assessment: id, agreedMrr: amount },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
  revalidatePath(`/admin/clients/${tenantId}`);
}

/* ── Presentation helpers ────────────────────────────────────────── */

const label: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.62rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
  display: "block",
  marginBottom: 5,
};
// Sub-heading inside the Risk panel (cost guardrail / GDPR controls).
const sectionLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
};

const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  color: "var(--k-fg)",
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "7px 10px",
  width: "100%",
  height: 34,
};

/** How a field got its value: read off the system, proposed, or a person's job. */
function StateTag({ state }: { state?: FieldState }) {
  if (!state) return null;
  const look =
    state === "auto"
      ? { text: "auto", color: "var(--k-accent)" }
      : state === "estimated"
        ? { text: "estimate — confirm", color: T.warning }
        : { text: "needs you", color: "var(--k-muted)" };
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "0.56rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: look.color,
        border: `1px solid color-mix(in oklab, ${look.color} 45%, transparent)`,
        padding: "1px 5px",
        marginLeft: 6,
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      {look.text}
    </span>
  );
}

function Field({
  name,
  title,
  hint,
  defaultValue,
  placeholder,
  state,
}: {
  name: string;
  title: string;
  hint?: string;
  defaultValue?: number | null;
  placeholder?: string;
  state?: FieldState;
}) {
  return (
    <label>
      <span style={label}>
        {title}
        <StateTag state={state} />
      </span>
      <input
        name={name}
        inputMode="numeric"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        style={inp}
      />
      {hint && (
        <span
          style={{
            fontFamily: T.sans,
            fontSize: "0.72rem",
            color: "var(--k-faint)",
            display: "block",
            marginTop: 4,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid var(--k-border)" }}>
      <span style={label}>{title}</span>
      <span
        style={{
          fontFamily: T.sans,
          fontWeight: 700,
          fontSize: "1.1rem",
          color: "var(--k-fg)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ScoreCard({
  title,
  points,
  max,
}: {
  title: string;
  points: number;
  max: number;
}) {
  const pct = Math.round((points / max) * 100);
  return (
    <div style={{ padding: "12px 14px", border: "1px solid var(--k-border)" }}>
      <span style={label}>{title}</span>
      <div className="flex items-baseline gap-1.5">
        <span
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "1.5rem",
            letterSpacing: "-0.02em",
            color: "var(--k-fg)",
          }}
        >
          {points}
        </span>
        <span style={{ fontFamily: T.mono, fontSize: "0.7rem", color: "var(--k-faint)" }}>
          / {max}
        </span>
      </div>
      <div style={{ height: 3, background: "var(--k-border)", marginTop: 8 }}>
        <div
          style={{ height: "100%", width: `${pct}%`, background: "var(--k-accent)" }}
        />
      </div>
    </div>
  );
}

type Row = {
  id: string;
  created_at: string;
  pricing_version: string;
  plan: string;
  inputs: ScaleInput;
  nsi: number;
  score_audience: number;
  score_commercial: number;
  score_technical: number;
  score_reach: number;
  score_risk: number;
  scale_band: string | null;
  multiplier: number | null;
  base_plan_price: number | null;
  scaled_plan_price: number | null;
  direct_cost_floor: number | null;
  recommended_mrr: number | null;
  enterprise_review_required: boolean;
  data_quality: string;
  review_flags: string[];
  override_mrr: number | null;
  override_reason: string | null;
  agreed_mrr: number | null;
  agreed_at: string | null;
  plan_prices?: Record<
    string,
    { mrr: number | string | null; reason?: string | null }
  > | null;
};

export default async function ClientPricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scan_error?: string; prices_error?: string }>;
}) {
  const { id: tenantId } = await params;
  const { scan_error: scanError, prices_error: pricesError } = await searchParams;
  if (!(await requireStaff()).ok) notFound();

  const service = createServiceClient();
  const [
    { data: tenant },
    { data: rows },
    scan,
    { data: passport },
    { data: riskProject },
    { data: footprintRows },
    { data: complianceRows },
  ] = await Promise.all([
    service.from("tenants").select("id, name").eq("id", tenantId).maybeSingle(),
    service
      .from("scale_assessments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12),
    latestEvidence(service, tenantId),
    service
      .from("system_profiles")
      .select("project_id, repo_full_name, supabase_ref")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // The risk register hangs off the newest project (Scale and Risk tile).
    service
      .from("projects")
      .select("id, stage")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Usage footprint (cost guardrail) — the rpc returns every tenant; this
    // page keeps only this client's row.
    service.rpc("tenant_footprint"),
    service
      .from("compliance_records")
      .select("kind, recorded_at")
      .eq("tenant_id", tenantId)
      .order("recorded_at", { ascending: true }),
  ]);
  if (!tenant) notFound();

  // Cost guardrail: the same rule as the money cockpit — a real footprint on
  // a fee below the cheapest plan is a pricing trigger, never absorbed cost.
  type Footprint = {
    tenant_id: string;
    name: string;
    documents: number;
    change_requests: number;
    tasks: number;
    invoices: number;
    audit_rows: number;
    mrr: number;
  };
  const footprintRow =
    ((footprintRows ?? []) as Footprint[]).find((f) => f.tenant_id === tenantId) ?? null;
  const footprint = footprintRow
    ? (() => {
        const score =
          Number(footprintRow.documents) +
          Number(footprintRow.change_requests) +
          Number(footprintRow.tasks) +
          Number(footprintRow.audit_rows) / 10;
        return {
          ...footprintRow,
          score,
          flag: score >= 15 && Number(footprintRow.mrr) < 40,
        };
      })()
    : null;

  // Per-tenant GDPR controls. The DPA row is read-only here (recorded on the
  // Docs and Legal tile); the two operational controls are marked from here.
  const complianceList = (complianceRows ?? []) as {
    kind: string;
    recorded_at: string;
  }[];
  const controlDone = (kind: string) =>
    complianceList.find((r) => r.kind === kind)?.recorded_at ?? null;
  const controlsDone =
    (controlDone("dpa_signed") ? 1 : 0) +
    GDPR_CONTROLS.filter((c) => controlDone(c.kind)).length;
  const controlsTotal = GDPR_CONTROLS.length + 1;

  const history = (rows ?? []) as (Row & { field_states?: FieldStates | null })[];
  const latest = history[0];
  // The form is prefilled from the newest of: the last scan (its derived
  // inputs already carry the human answers from the assessment before it) or
  // the last saved assessment. Field tags come from the same source.
  const scanIsNewer =
    !!scan && (!latest || new Date(scan.collected_at) > new Date(latest.created_at));
  const prev: ScaleInput | undefined = scanIsNewer ? scan!.derived : latest?.inputs;
  const fs: FieldStates = scanIsNewer
    ? (scan!.field_states ?? {})
    : (latest?.field_states ?? {});
  const needsPerson = scan ? fieldsNeedingAPerson(scan.field_states ?? {}) : [];
  const toConfirm = needsPerson.filter((k) => scan?.field_states?.[k] === "estimated");
  const toEnter = needsPerson.filter((k) => scan?.field_states?.[k] === "human");
  const repoEv = scan?.evidence?.repo ?? null;
  const dbEv = scan?.evidence?.database ?? null;
  const services = repoEv ? externalIntegrations(repoEv.integrations) : [];

  // The figure billing will actually use for the Core anchor, mirroring
  // contractedMrr()'s order; the three client-facing prices come from the
  // same rule the portal and the Direct Debit starter use.
  const effective =
    latest?.agreed_mrr ?? latest?.override_mrr ?? latest?.recommended_mrr ?? null;
  const threePrices = latest
    ? pricesFromAssessment(latest as unknown as AssessmentRow)
    : null;

  return (
    <div
      className="px-4 sm:px-6"
      style={{ maxWidth: 1000, margin: "0 auto", paddingTop: 24, paddingBottom: 56 }}
    >
      <PageHeader
        index="02"
        label="Scale assessment"
        title={`Recurring price — ${tenant.name}`}
        lead="Score the client on the five Nullshift Scale Index dimensions. The score sets their bracket; the client picks Core, Pro or Max at the bracket's prices once their system is live."
        actions={
          <Link
            href={`/admin/clients/${tenantId}`}
            className="kb kb-outline kb-sm"
            style={{ textDecoration: "none" }}
          >
            ← {tenant.name}
          </Link>
        }
      />

      {/* ── Current standing ─────────────────────────────────────── */}
      {latest && (
        <div style={{ margin: "22px 0 20px" }}>
          <Panel label="// CURRENT ASSESSMENT">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex flex-col" style={{ gap: 3 }}>
                <span style={label}>NSI</span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {latest.nsi} / 100
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: 3 }}>
                <span style={label}>Scale band</span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {latest.enterprise_review_required
                    ? "Enterprise"
                    : `${SCALE_BAND_LABEL[latest.scale_band as keyof typeof SCALE_BAND_LABEL] ?? "—"} ×${Number(latest.multiplier ?? 0)}`}
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: 3 }}>
                <span style={label}>Cost floor</span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "var(--k-fg)",
                  }}
                >
                  {latest.direct_cost_floor === null
                    ? "—"
                    : gbp(latest.direct_cost_floor)}
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: 3 }}>
                <span style={label}>Their three options — the client picks one</span>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  {threePrices?.sellable.map((pp) => (
                    <span
                      key={pp.planId}
                      style={{ fontFamily: T.sans, color: "var(--k-fg)" }}
                    >
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.68rem",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--k-muted)",
                        }}
                      >
                        {pp.label}{" "}
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: "1.25rem",
                          letterSpacing: "-0.02em",
                          color: pp.priced ? "var(--k-accent)" : T.warning,
                        }}
                      >
                        {pp.priced && pp.mrr !== null ? gbp(pp.mrr) : "—"}
                      </span>
                      {pp.note && (
                        <span
                          title={pp.note}
                          style={{
                            fontFamily: T.mono,
                            fontSize: "0.58rem",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: T.warning,
                            marginLeft: 6,
                          }}
                        >
                          set by hand
                        </span>
                      )}
                    </span>
                  ))}
                  {latest.enterprise_review_required && (
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.82rem",
                        color: T.warning,
                      }}
                    >
                      Enterprise review — no self-serve price until a figure is agreed
                      below
                    </span>
                  )}
                </div>
              </div>
              {latest.enterprise_review_required && (
                <StatusChip tone="warning">Enterprise review required</StatusChip>
              )}
              {latest.data_quality === "low" && (
                <StatusChip tone="warning">Low data quality</StatusChip>
              )}
              {latest.agreed_mrr !== null && (
                <StatusChip tone="success">
                  Agreed {latest.agreed_at ? dateGB(latest.agreed_at) : ""}
                </StatusChip>
              )}
            </div>

            <div
              className="grid grid-cols-2 md:grid-cols-5 gap-2"
              style={{ marginTop: 18 }}
            >
              <ScoreCard title="Audience" points={latest.score_audience} max={25} />
              <ScoreCard title="Commercial" points={latest.score_commercial} max={25} />
              <ScoreCard title="Technical" points={latest.score_technical} max={20} />
              <ScoreCard title="Reach" points={latest.score_reach} max={15} />
              <ScoreCard title="Risk" points={latest.score_risk} max={15} />
            </div>

            {latest.review_flags?.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  margin: "16px 0 0",
                  padding: "12px 14px",
                  border: `1px solid color-mix(in oklab, ${T.warning} 30%, transparent)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {latest.review_flags.map((f) => (
                  <li
                    key={f}
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      color: T.warning,
                      lineHeight: 1.5,
                    }}
                  >
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {latest.override_reason && (
              <p
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.82rem",
                  color: "var(--k-muted)",
                  marginTop: 14,
                }}
              >
                <strong style={{ color: "var(--k-fg)" }}>
                  Overridden to {gbp(latest.override_mrr ?? 0)}
                </strong>{" "}
                — {latest.override_reason}
              </p>
            )}

            {/* Override the bracket; Enterprise gets its agreed figure here */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--k-border)",
              }}
            >
              <form action={setPlanPrices} className="flex flex-col gap-3">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="assessment_id" value={latest.id} />
                <span style={label}>
                  Set plan prices by hand — the client sees the reason
                </span>
                {pricesError && (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.8rem",
                      color: T.warning,
                      margin: 0,
                    }}
                  >
                    A hand-set price needs a reason ({pricesError}). Nothing was saved.
                  </p>
                )}
                {threePrices?.sellable.map((pp) => {
                  const key =
                    carePlanForNsi(latest.plan) && pp.planId
                      ? ["hosting", "hosting_api", "build_3"].indexOf(pp.planId) >= 0
                        ? (["core", "pro", "max"][
                            ["hosting", "hosting_api", "build_3"].indexOf(pp.planId)
                          ] as string)
                        : pp.planId
                      : pp.planId;
                  const current = latest.plan_prices?.[key];
                  return (
                    <div
                      key={pp.planId}
                      className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-2 items-start"
                    >
                      <label>
                        <span style={label}>{pp.label}</span>
                        <input
                          name={`price_${key}`}
                          inputMode="numeric"
                          placeholder={
                            pp.priced && pp.mrr !== null && !pp.note
                              ? `${gbp(pp.mrr)} formula`
                              : "£ / month"
                          }
                          defaultValue={current?.mrr ?? ""}
                          style={inp}
                        />
                      </label>
                      <label>
                        <span style={label}>Why — shown to the client</span>
                        <input
                          name={`reason_${key}`}
                          placeholder="e.g. Includes the extra weekly backup you asked for"
                          defaultValue={current?.reason ?? ""}
                          style={inp}
                        />
                      </label>
                    </div>
                  );
                })}
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.74rem",
                    color: "var(--k-faint)",
                  }}
                >
                  Leave a price blank to go back to the formula for that plan. Saved with
                  your name; every change is audited.
                </span>
                <SubmitButton className="kb kb-outline kb-sm">
                  Save plan prices
                </SubmitButton>
              </form>

              {latest.enterprise_review_required ? (
                <form action={agreeMrr} className="flex flex-col gap-2">
                  <input type="hidden" name="tenant_id" value={tenantId} />
                  <input type="hidden" name="assessment_id" value={latest.id} />
                  <span style={label}>Enterprise — agree the monthly figure</span>
                  <input
                    name="agreed_mrr"
                    inputMode="numeric"
                    placeholder="£ / month"
                    defaultValue={latest.agreed_mrr ?? latest.override_mrr ?? ""}
                    style={inp}
                  />
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.74rem",
                      color: "var(--k-faint)",
                    }}
                  >
                    Enterprise is never self-serve: this is the figure the Order Form
                    carries and the Direct Debit collects.
                  </span>
                  <SubmitButton className="kb kb-primary kb-sm">
                    Set agreed figure
                  </SubmitButton>
                </form>
              ) : (
                <div className="flex flex-col gap-2">
                  <span style={label}>What happens next</span>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.82rem",
                      color: "var(--k-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    The bracket is set. Once the system is live, send the client their
                    options from the Direct Debits board — they choose Core, Pro or Max at
                    these prices, agree the terms and set up the Direct Debit themselves.
                  </p>
                  {effective !== null && (
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.64rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--k-faint)",
                      }}
                    >
                      Core anchor {gbp(effective)}/mo · formula {latest.pricing_version}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ── Auto-score: read the system ──────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Panel label="// AUTO-SCORE" title="Read the system">
          <form action={analyseSystem} className="flex flex-wrap items-center gap-4">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <SubmitButton className="kb kb-outline kb-sm">
              {scan ? "Re-read the system" : "Analyse the system"}
            </SubmitButton>
            <span
              style={{ fontFamily: T.sans, fontSize: "0.78rem", color: "var(--k-muted)" }}
            >
              Reads the repository{" "}
              {passport?.repo_full_name ? (
                <strong style={{ color: "var(--k-fg)" }}>
                  {passport.repo_full_name}
                </strong>
              ) : (
                <span style={{ color: T.warning }}>(none on the passport)</span>
              )}{" "}
              and the production database{" "}
              {passport?.supabase_ref ? (
                <strong style={{ color: "var(--k-fg)" }}>{passport.supabase_ref}</strong>
              ) : (
                <span style={{ color: T.warning }}>
                  (no Supabase ref on the passport)
                </span>
              )}
              {!isSupabaseManagementConfigured() && (
                <span style={{ color: T.warning }}> · SUPABASE_ACCESS_TOKEN not set</span>
              )}
              . Fills every field it can; the rest are tagged for you below.
            </span>
            {/* The passport is where the repo and database refs live — one
                click away, so a missing ref never means hunting for it. */}
            <Link
              href={
                passport?.project_id
                  ? `/admin/systems/${passport.project_id}`
                  : "/admin/systems"
              }
              className="kb kb-outline kb-sm"
              style={{ textDecoration: "none" }}
            >
              {passport ? "Edit passport →" : "Create passport →"}
            </Link>
          </form>

          {scanError && (
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.82rem",
                color: T.warning,
                marginTop: 12,
              }}
            >
              {scanError}
            </p>
          )}

          {scan && (
            <div style={{ marginTop: 18 }}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <StatusChip tone={scan.sources?.repo?.ok ? "success" : "warning"}>
                  {scan.sources?.repo?.ok
                    ? `Repository read · ${scan.sources.repo.ref}`
                    : `Repository: ${scan.sources?.repo?.error ?? "not read"}`}
                </StatusChip>
                <StatusChip tone={scan.sources?.database?.ok ? "success" : "warning"}>
                  {scan.sources?.database?.ok
                    ? `Database read · ${scan.sources.database.ref}`
                    : `Database: ${scan.sources?.database?.error ?? "not read"}`}
                </StatusChip>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.64rem",
                    color: "var(--k-faint)",
                  }}
                >
                  {dateGB(scan.collected_at)} · {scan.trigger}
                </span>
              </div>

              <div
                className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2"
                style={{ marginTop: 14 }}
              >
                <Stat
                  title="Active users / 30d"
                  value={dbEv ? dbEv.mau30.toLocaleString("en-GB") : "—"}
                />
                <Stat
                  title="Registered users"
                  value={dbEv ? dbEv.usersTotal.toLocaleString("en-GB") : "—"}
                />
                <Stat
                  title="Dependencies"
                  value={repoEv ? String(repoEv.dependencyCount) : "—"}
                />
                <Stat
                  title="External services"
                  value={repoEv ? String(services.length) : "—"}
                />
                <Stat
                  title="Admin routes"
                  value={
                    repoEv ? `${repoEv.adminRouteCount} / ${repoEv.routeCount}` : "—"
                  }
                />
                <Stat
                  title="Staff users"
                  value={
                    dbEv?.roleModel.staffTotal != null
                      ? String(dbEv.roleModel.staffTotal)
                      : "—"
                  }
                />
                <Stat
                  title="Locations"
                  value={dbEv?.locations ? String(dbEv.locations.count) : "—"}
                />
                <Stat title="Tables" value={dbEv ? String(dbEv.publicTables) : "—"} />
              </div>

              {services.length > 0 && (
                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
                  {services.map((h) => (
                    <span
                      key={h.key}
                      title={h.via.join(", ")}
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.62rem",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--k-muted)",
                        border: "1px solid var(--k-border)",
                        padding: "2px 7px",
                      }}
                    >
                      {h.label}
                    </span>
                  ))}
                </div>
              )}

              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--k-border)",
                }}
              >
                <div>
                  <span style={label}>Provisional score — before your fields</span>
                  <div className="flex items-baseline gap-3">
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 800,
                        fontSize: "1.45rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      NSI {scan.provisional_nsi ?? "—"}
                    </span>
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "var(--k-accent)",
                      }}
                    >
                      {scan.provisional_band === "enterprise"
                        ? "Enterprise review"
                        : (SCALE_BAND_LABEL[scan.provisional_band as ScaleBand] ?? "—")}
                    </span>
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        color: "var(--k-muted)",
                      }}
                    >
                      {scan.provisional_mrr != null
                        ? `≈ ${gbp(Number(scan.provisional_mrr))}/mo on ${carePlanForNsi(scan.derived?.plan)?.label ?? scan.derived?.plan ?? "Core"}`
                        : "no price until vendor cost is confirmed"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.74rem",
                      color: "var(--k-faint)",
                      marginTop: 6,
                    }}
                  >
                    Nothing is billed from this. Fill the fields below and save to set the
                    bracket.
                  </p>
                </div>
                <div>
                  <span style={label}>Left for you ({needsPerson.length})</span>
                  {toConfirm.length > 0 && (
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.8rem",
                        color: T.warning,
                        margin: "0 0 4px",
                      }}
                    >
                      Confirm: {toConfirm.map((k) => FIELD_LABEL[k]).join(" · ")}
                    </p>
                  )}
                  {toEnter.length > 0 && (
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.8rem",
                        color: "var(--k-fg)",
                        margin: 0,
                      }}
                    >
                      Enter: {toEnter.map((k) => FIELD_LABEL[k]).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {scan.notes?.length > 0 && (
                <ul
                  style={{
                    listStyle: "none",
                    margin: "14px 0 0",
                    padding: "10px 14px",
                    border: "1px solid var(--k-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {scan.notes.map((n) => (
                    <li
                      key={n}
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.8rem",
                        color: "var(--k-muted)",
                        lineHeight: 1.5,
                      }}
                    >
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* ── The assessment form ──────────────────────────────────── */}
      <Panel
        label="// SCORE THIS CLIENT"
        title={scanIsNewer ? "Complete the assessment" : "New assessment"}
      >
        <form action={saveAssessment} className="flex flex-col gap-6">
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input type="hidden" name="evidence_id" value={scanIsNewer ? scan!.id : ""} />
          <input type="hidden" name="field_states" value={JSON.stringify(fs)} />

          <div className="grid grid-cols-1 gap-4">
            <label>
              <span style={label}>
                Platform role — what the system does for them
                <StateTag state={fs.platformRole} />
              </span>
              <select
                name="platformRole"
                defaultValue={prev?.platformRole ?? "informational"}
                style={{ ...inp, height: 34 }}
              >
                {(
                  Object.keys(PLATFORM_ROLE_LABEL) as (keyof typeof PLATFORM_ROLE_LABEL)[]
                ).map((k) => (
                  <option key={k} value={k}>
                    {PLATFORM_ROLE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field
              state={fs["monthlyActiveUsers"]}
              name="monthlyActiveUsers"
              title="Monthly active users"
              hint="Preferred over sessions"
              defaultValue={prev?.monthlyActiveUsers}
            />
            <Field
              state={fs["monthlySessions"]}
              name="monthlySessions"
              title="Monthly sessions"
              hint="Fallback when MAU is unavailable"
              defaultValue={prev?.monthlySessions}
            />
            <Field
              state={fs["annualTurnoverGbp"]}
              name="annualTurnoverGbp"
              title="Annual turnover (£)"
              hint="Never inferred — leave blank if unknown"
              defaultValue={prev?.annualTurnoverGbp}
            />
            <Field
              state={fs["employeeCount"]}
              name="employeeCount"
              title="Employees"
              hint="Turnover fallback"
              defaultValue={prev?.employeeCount}
            />
            <Field
              state={fs["directMonthlyVendorCostGbp"]}
              name="directMonthlyVendorCostGbp"
              title="Vendor cost / month (£)"
              hint="Hosting, DB, AI/API, email, monitoring"
              defaultValue={prev?.directMonthlyVendorCostGbp}
            />
            <Field
              state={fs["internalActiveUsers"]}
              name="internalActiveUsers"
              title="Internal users"
              hint="Staff who depend on it"
              defaultValue={prev?.internalActiveUsers}
            />
            <Field
              state={fs["locationsOrUnits"]}
              name="locationsOrUnits"
              title="Locations / units"
              hint="Higher of this and internal users counts"
              defaultValue={prev?.locationsOrUnits}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span style={label}>Complexity & risk — 3 points each, capped at 15</span>
              <div className="flex flex-col gap-2" style={{ marginTop: 8 }}>
                {(Object.keys(RISK_FLAG_LABEL) as (keyof RiskFlags)[]).map((k) => (
                  <label key={k} className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      name={k}
                      defaultChecked={prev?.riskFlags?.[k] ?? false}
                      style={{ marginTop: 3 }}
                    />
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.84rem",
                        color: "var(--k-fg)",
                        lineHeight: 1.45,
                      }}
                    >
                      {RISK_FLAG_LABEL[k]}
                      <StateTag state={fs[`risk.${k}`]} />
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span style={label}>
                Enterprise triggers — any one forces a manual quote
              </span>
              <div className="flex flex-col gap-2" style={{ marginTop: 8 }}>
                {(Object.keys(ENTERPRISE_FLAG_LABEL) as (keyof EnterpriseFlags)[]).map(
                  (k) => (
                    <label key={k} className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        name={k}
                        defaultChecked={prev?.enterpriseFlags?.[k] ?? false}
                        style={{ marginTop: 3 }}
                      />
                      <span
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.84rem",
                          color: "var(--k-fg)",
                          lineHeight: 1.45,
                        }}
                      >
                        {ENTERPRISE_FLAG_LABEL[k]}
                        <StateTag state={fs[`enterprise.${k}`]} />
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <SubmitButton className="kb kb-primary kb-sm">
              Score & save assessment
            </SubmitButton>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.64rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--k-faint)",
              }}
            >
              Formula {PRICING_VERSION} · stored with every quote
            </span>
          </div>
        </form>
      </Panel>

      {/* ── Risks & blockers — the delivery risk register (Scale and Risk tile) ── */}
      {riskProject && (
        <div style={{ marginTop: 20 }}>
          <DeliverySections
            tenantId={tenantId}
            projectId={(riskProject as { id: string }).id}
            stage={(riskProject as { stage: string }).stage}
            sections={["risks"]}
          />
        </div>
      )}

      {/* ── Risk — cost guardrail + per-tenant GDPR controls ─────────────── */}
      {/* The Scale and Risk tile's second half: the same usage-footprint
          guardrail the money cockpit runs, filtered to this client, and the
          compliance_records checklist from the compliance centre. */}
      <div style={{ marginTop: 20 }}>
        <Panel
          label="// RISK"
          title="Cost guardrail and GDPR controls"
          actions={
            <>
              <StatusChip tone={controlsDone === controlsTotal ? "success" : "warning"}>
                {controlsDone}/{controlsTotal} controls
              </StatusChip>
              <Link
                href={`/api/sar/${tenantId}`}
                prefetch={false}
                className="kb kb-outline kb-sm"
                style={{ textDecoration: "none" }}
                title="Subject access request — export everything held on this client"
              >
                ↓ Export data (SAR)
              </Link>
            </>
          }
        >
          {/* Cost guardrail row — this client's usage footprint vs their fee */}
          <div
            className="flex flex-col gap-2"
            style={{ paddingBottom: 14, borderBottom: "1px solid var(--k-border)" }}
          >
            <span style={sectionLabel}>Cost guardrail</span>
            <p
              style={{
                fontFamily: T.sans,
                fontSize: "0.84rem",
                lineHeight: 1.5,
                color: "var(--k-muted)",
                maxWidth: "64ch",
                margin: 0,
              }}
            >
              A proxy for this client&apos;s resource footprint vs its recurring fee. A
              flag is a pricing trigger — raise the plan, never absorb the cost.
            </p>
            {footprint ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className="flex items-center gap-4 flex-wrap"
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    letterSpacing: "0.04em",
                    color: "var(--k-muted)",
                  }}
                >
                  <span>docs {footprint.documents}</span>
                  <span>issues {footprint.change_requests}</span>
                  <span>tasks {footprint.tasks}</span>
                  <span>audit {footprint.audit_rows}</span>
                  <span style={{ color: "var(--k-fg)" }}>
                    {gbp(Number(footprint.mrr))}/mo
                  </span>
                  <span style={{ color: "var(--k-faint)" }}>
                    score {Math.round(footprint.score)} · flags at 15+ under £40/mo
                  </span>
                </div>
                {footprint.flag ? (
                  <StatusChip tone="warning">⚠ review pricing</StatusChip>
                ) : (
                  <StatusChip tone="success">✓ healthy</StatusChip>
                )}
              </div>
            ) : (
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.85rem",
                  color: "var(--k-muted)",
                }}
              >
                No footprint yet — nothing recorded against this tenant.
              </span>
            )}
          </div>

          {/* GDPR controls — the per-tenant compliance_records checklist */}
          <div className="flex flex-col" style={{ paddingTop: 14 }}>
            <span style={sectionLabel}>GDPR controls</span>
            {[
              {
                kind: "dpa_signed",
                label: "DPA signed",
                hint: "Recorded on the Docs and Legal tile (portal acceptance or an offline signature).",
                recordable: false,
              },
              ...GDPR_CONTROLS.map((c) => ({ ...c, recordable: true })),
            ].map((check, ci) => {
              const done = controlDone(check.kind);
              return (
                <div
                  key={check.kind}
                  className="flex items-center justify-between gap-3 flex-wrap"
                  style={{
                    padding: "10px 0",
                    borderTop: ci ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className="flex items-center gap-2"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: done ? "var(--k-fg)" : "var(--k-muted)",
                      }}
                    >
                      <span style={{ color: done ? T.success : "var(--k-faint)" }}>
                        {done ? "✓" : "○"}
                      </span>
                      {check.label}
                      {done && (
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontSize: "10px",
                            letterSpacing: "0.06em",
                            color: "var(--k-faint)",
                          }}
                        >
                          {dateGB(done)}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.78rem",
                        color: "var(--k-faint)",
                        paddingLeft: 20,
                      }}
                    >
                      {check.hint}
                    </span>
                  </span>
                  {!done &&
                    (check.recordable ? (
                      <form action={recordCompliance}>
                        <input type="hidden" name="tenant_id" value={tenantId} />
                        <input type="hidden" name="kind" value={check.kind} />
                        <SubmitButton className="kb kb-outline kb-sm" pendingLabel="…">
                          Mark done
                        </SubmitButton>
                      </form>
                    ) : (
                      <Link
                        href={`/admin/clients/${tenantId}/docs`}
                        className="kb kb-outline kb-sm"
                        style={{ textDecoration: "none" }}
                      >
                        Docs and Legal →
                      </Link>
                    ))}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── History ──────────────────────────────────────────────── */}
      {/* §7: the monthly shadow score and the notice workflow that stands
          between it and a changed bill. */}
      <RebandPanel
        tenantId={tenantId}
        contractedBand={(latest?.scale_band as ScaleBand | null) ?? null}
        currentMrr={effective === null ? null : Number(effective)}
      />

      {history.length > 1 && (
        <div style={{ marginTop: 20 }}>
          <Panel label="// HISTORY" title="Previous assessments">
            <div className="flex flex-col">
              {history.slice(1).map((h, i) => (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                  style={{
                    padding: "10px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.68rem",
                      color: "var(--k-muted)",
                    }}
                  >
                    {dateGB(h.created_at)} · NSI {h.nsi} ·{" "}
                    {h.enterprise_review_required
                      ? "Enterprise"
                      : (SCALE_BAND_LABEL[
                          h.scale_band as keyof typeof SCALE_BAND_LABEL
                        ] ?? "—")}
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {(h.agreed_mrr ?? h.override_mrr ?? h.recommended_mrr)
                      ? gbp(Number(h.agreed_mrr ?? h.override_mrr ?? h.recommended_mrr)) +
                        "/mo"
                      : "Quoted manually"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
