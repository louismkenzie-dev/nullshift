import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CARE_PLANS, carePlan } from "@/lib/carePlans";
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
  type ScaleInput,
} from "@/lib/pricing/nsi";

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
    plan: (String(fd.get("plan") || "core") as PlanId) ?? "core",
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
    },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
  revalidatePath(`/admin/clients/${tenantId}`);
}

/** Override the recommended figure — reason required, owner recorded. */
async function overrideMrr(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const id = String(formData.get("assessment_id") || "");
  const amount = num(formData.get("override_mrr"));
  const reason = String(formData.get("override_reason") || "").trim();
  // The DB constraint enforces this too — bail early so a blank reason never
  // surfaces as a failed insert.
  if (!tenantId || !id || amount === null || amount < 0 || !reason) return;

  const service = createServiceClient();
  await service
    .from("scale_assessments")
    .update({
      override_mrr: amount,
      override_reason: reason,
      overridden_by: staff.userId,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  await logAudit({
    action: "scale_assessment.overridden",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { assessment: id, overrideMrr: amount, reason },
  });
  revalidatePath(`/admin/clients/${tenantId}/pricing`);
  revalidatePath(`/admin/clients/${tenantId}`);
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

function Field({
  name,
  title,
  hint,
  defaultValue,
  placeholder,
}: {
  name: string;
  title: string;
  hint?: string;
  defaultValue?: number | null;
  placeholder?: string;
}) {
  return (
    <label>
      <span style={label}>{title}</span>
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
};

export default async function ClientPricingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tenantId } = await params;
  if (!(await requireStaff()).ok) notFound();

  const service = createServiceClient();
  const [{ data: tenant }, { data: rows }] = await Promise.all([
    service.from("tenants").select("id, name").eq("id", tenantId).maybeSingle(),
    service
      .from("scale_assessments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  if (!tenant) notFound();

  const history = (rows ?? []) as Row[];
  const latest = history[0];
  const prev = latest?.inputs;
  const plan = latest ? carePlan(latest.plan) : null;

  // The figure billing will actually use, mirroring contractedMrr()'s order.
  const effective =
    latest?.agreed_mrr ?? latest?.override_mrr ?? latest?.recommended_mrr ?? null;

  return (
    <div
      className="px-4 sm:px-6"
      style={{ maxWidth: 1000, margin: "0 auto", paddingTop: 24, paddingBottom: 56 }}
    >
      <PageHeader
        index="02"
        label="Scale assessment"
        title={`Recurring price — ${tenant.name}`}
        lead="Score the client on the five Nullshift Scale Index dimensions. The plan sets the service level; the band sets what they pay for it."
        actions={
          <Link
            href={`/admin/clients/${tenantId}`}
            className="kb kb-outline kb-sm"
            style={{ textDecoration: "none" }}
          >
            ← Client hub
          </Link>
        }
      />

      {/* ── Current standing ─────────────────────────────────────── */}
      {latest && (
        <div style={{ margin: "22px 0 20px" }}>
          <Panel label="// CURRENT ASSESSMENT">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex flex-col" style={{ gap: 3 }}>
                <span style={label}>Plan level</span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "var(--k-accent)",
                    textTransform: "uppercase",
                  }}
                >
                  {plan?.label ?? latest.plan}
                </span>
              </div>
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
                <span style={label}>Billing will charge</span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 800,
                    fontSize: "1.45rem",
                    letterSpacing: "-0.02em",
                    color: effective === null ? T.warning : "var(--k-accent)",
                  }}
                >
                  {effective === null ? "Quote manually" : `${gbp(effective)}/mo`}
                </span>
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

            {/* Override + agree, side by side */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid var(--k-border)",
              }}
            >
              <form action={overrideMrr} className="flex flex-col gap-2">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="assessment_id" value={latest.id} />
                <span style={label}>Override the recommendation</span>
                <input
                  name="override_mrr"
                  inputMode="numeric"
                  placeholder="£ / month"
                  defaultValue={latest.override_mrr ?? ""}
                  style={inp}
                />
                <input
                  name="override_reason"
                  required
                  placeholder="Reason (required, stored with your name)"
                  defaultValue={latest.override_reason ?? ""}
                  style={inp}
                />
                <SubmitButton className="kb kb-outline kb-sm">Save override</SubmitButton>
              </form>

              <form action={agreeMrr} className="flex flex-col gap-2">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="assessment_id" value={latest.id} />
                <span style={label}>Agree the contracted rate</span>
                <input
                  name="agreed_mrr"
                  inputMode="numeric"
                  placeholder="£ / month"
                  defaultValue={
                    latest.agreed_mrr ??
                    latest.override_mrr ??
                    latest.recommended_mrr ??
                    ""
                  }
                  style={inp}
                />
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.74rem",
                    color: "var(--k-faint)",
                  }}
                >
                  This is the figure every billing flow charges — Direct Debit, Stripe and
                  manually recorded plans.
                </span>
                <SubmitButton className="kb kb-primary kb-sm">
                  Set contracted rate
                </SubmitButton>
              </form>
            </div>
          </Panel>
        </div>
      )}

      {/* ── The assessment form ──────────────────────────────────── */}
      <Panel label="// SCORE THIS CLIENT" title="New assessment">
        <form action={saveAssessment} className="flex flex-col gap-6">
          <input type="hidden" name="tenant_id" value={tenantId} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label>
              <span style={label}>Plan level</span>
              <select
                name="plan"
                defaultValue={prev?.plan ?? "core"}
                style={{ ...inp, height: 34 }}
              >
                {CARE_PLANS.map((p) => (
                  <option
                    key={p.id}
                    value={
                      p.id === "hosting"
                        ? "core"
                        : p.id === "hosting_api"
                          ? "pro"
                          : p.id === "build_3"
                            ? "max"
                            : "enterprise"
                    }
                  >
                    {p.label}
                    {p.quotedOnly ? " (quoted)" : ` — from £${p.mrr}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span style={label}>Platform role — what the system does for them</span>
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
              name="monthlyActiveUsers"
              title="Monthly active users"
              hint="Preferred over sessions"
              defaultValue={prev?.monthlyActiveUsers}
            />
            <Field
              name="monthlySessions"
              title="Monthly sessions"
              hint="Fallback when MAU is unavailable"
              defaultValue={prev?.monthlySessions}
            />
            <Field
              name="annualTurnoverGbp"
              title="Annual turnover (£)"
              hint="Never inferred — leave blank if unknown"
              defaultValue={prev?.annualTurnoverGbp}
            />
            <Field
              name="employeeCount"
              title="Employees"
              hint="Turnover fallback"
              defaultValue={prev?.employeeCount}
            />
            <Field
              name="directMonthlyVendorCostGbp"
              title="Vendor cost / month (£)"
              hint="Hosting, DB, AI/API, email, monitoring"
              defaultValue={prev?.directMonthlyVendorCostGbp}
            />
            <Field
              name="internalActiveUsers"
              title="Internal users"
              hint="Staff who depend on it"
              defaultValue={prev?.internalActiveUsers}
            />
            <Field
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

      {/* ── History ──────────────────────────────────────────────── */}
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
                    {dateGB(h.created_at)} · {carePlan(h.plan)?.label ?? h.plan} · NSI{" "}
                    {h.nsi} ·{" "}
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
