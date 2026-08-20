import Link from "next/link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { RISK_STATUS_TONE, type ChipTone } from "@/lib/soc2/ui";
import { toDateOnly } from "@/lib/soc2/schedule";
import {
  inp,
  textarea,
  primaryBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  monoLabel,
  faintMono,
  bodyText,
} from "../shared";

/**
 * Risk register — every identified risk with its scored likelihood and impact,
 * a treatment decision (mitigate / transfer / avoid / accept), a named owner
 * and a review date. Residual scores record what remains after treatment.
 * Accepting a risk is a management decision reserved for the Programme Owner:
 * the database refuses an acceptance without a named acceptor and time, and
 * the rationale is appended to the treatment plan so the decision carries its
 * reasoning. Every material change is written to the domain trail.
 */

export const dynamic = "force-dynamic";

const PAGE = "/admin/soc2/risks";

const CATEGORIES = [
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
  "commercial",
  "operational",
] as const;
type RiskCategory = (typeof CATEGORIES)[number];

const TREATMENTS = ["undecided", "accept", "mitigate", "transfer", "avoid"] as const;
type RiskTreatment = (typeof TREATMENTS)[number];

/** Statuses updateRisk may set — acceptance goes through acceptRisk only. */
const UPDATE_STATUSES = ["open", "treated", "closed"] as const;

type RiskStatus = "open" | "treated" | "accepted" | "closed";

const LEVELS = [1, 2, 3, 4, 5] as const;

type RiskRow = {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  treatment: RiskTreatment;
  treatment_plan: string | null;
  owner_email: string | null;
  linked_control_keys: string[];
  residual_likelihood: number | null;
  residual_impact: number | null;
  status: RiskStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  review_due_at: string | null;
  created_at: string;
};

type ControlRef = { id: string; key: string };

const isLevel = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 5;

const scoreTone = (score: number): ChipTone =>
  score >= 15 ? "danger" : score >= 8 ? "warning" : "muted";

// ── server actions ─────────────────────────────────────────────

async function createRisk(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "");
  const likelihood = Number(formData.get("likelihood"));
  const impact = Number(formData.get("impact"));
  const treatment = String(formData.get("treatment") || "");
  const treatmentPlan = String(formData.get("treatment_plan") || "").trim();
  const ownerEmail = String(formData.get("owner_email") || "").trim();
  const reviewDueAt = String(formData.get("review_due_at") || "").trim();
  const linkedKeys = String(formData.get("linked_control_keys") || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (!title) return;
  if (!(CATEGORIES as readonly string[]).includes(category)) return;
  if (!isLevel(likelihood) || !isLevel(impact)) return;
  if (!(TREATMENTS as readonly string[]).includes(treatment)) return;

  const db = createServiceClient();
  const { data: ref } = await db.rpc("next_soc2_risk_ref");
  if (!ref) return;

  const { data: created, error } = await db
    .from("soc2_risks")
    .insert({
      ref,
      title,
      description: description || null,
      category,
      likelihood,
      impact,
      treatment,
      treatment_plan: treatmentPlan || null,
      owner_email: ownerEmail || null,
      linked_control_keys: linkedKeys as never,
      review_due_at: reviewDueAt || null,
      status: "open",
    })
    .select("id, ref")
    .single();
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;

  await logSoc2Event({
    recordType: "risk",
    recordId: created.id,
    type: "created",
    summary: `${created.ref} raised (${category.replace(/_/g, " ")}, score ${likelihood}×${impact}): ${title.slice(0, 120)}`,
    detail: { category, likelihood, impact, treatment, linked_control_keys: linkedKeys },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function updateRisk(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const treatment = String(formData.get("treatment") || "");
  const treatmentPlan = String(formData.get("treatment_plan") || "").trim();
  const ownerEmail = String(formData.get("owner_email") || "").trim();
  const status = String(formData.get("status") || "");
  const reviewDueAt = String(formData.get("review_due_at") || "").trim();
  const rlRaw = String(formData.get("residual_likelihood") || "").trim();
  const riRaw = String(formData.get("residual_impact") || "").trim();
  const residualLikelihood = rlRaw ? Number(rlRaw) : null;
  const residualImpact = riRaw ? Number(riRaw) : null;
  if (!id) return;
  if (!(TREATMENTS as readonly string[]).includes(treatment)) return;
  if (!(UPDATE_STATUSES as readonly string[]).includes(status)) return;
  if (residualLikelihood !== null && !isLevel(residualLikelihood)) return;
  if (residualImpact !== null && !isLevel(residualImpact)) return;

  const db = createServiceClient();
  const { data: risk } = await db
    .from("soc2_risks")
    .select("id, ref, status")
    .eq("id", id)
    .maybeSingle();
  if (!risk) return;

  const { error } = await db
    .from("soc2_risks")
    .update({
      treatment,
      treatment_plan: treatmentPlan || null,
      owner_email: ownerEmail || null,
      residual_likelihood: residualLikelihood,
      residual_impact: residualImpact,
      review_due_at: reviewDueAt || null,
      status,
    })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  const closedNow = status === "closed" && risk.status !== "closed";
  await logSoc2Event({
    recordType: "risk",
    recordId: id,
    type: closedNow ? "closed" : "updated",
    summary: closedNow
      ? `${risk.ref} closed (treatment ${treatment}).`
      : `${risk.ref} updated: treatment ${treatment}, status ${status}${
          residualLikelihood !== null && residualImpact !== null
            ? `, residual score ${residualLikelihood}×${residualImpact}`
            : ""
        }.`,
    detail: {
      treatment,
      status,
      previous_status: risk.status,
      residual_likelihood: residualLikelihood,
      residual_impact: residualImpact,
      owner_email: ownerEmail || null,
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function acceptRisk(formData: FormData) {
  "use server";
  // Risk acceptance sits with the Programme Owner — a named management
  // decision, not a status change any writer can make.
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const rationale = String(formData.get("rationale") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id || !rationale || confirm !== "ACCEPT") return;

  const db = createServiceClient();
  const { data: risk } = await db
    .from("soc2_risks")
    .select("id, ref, status, treatment_plan")
    .eq("id", id)
    .maybeSingle();
  if (!risk || risk.status === "accepted") return;

  const stamp = `Acceptance rationale (${toDateOnly(new Date())}, ${guard.email}): ${rationale}`;
  const plan = risk.treatment_plan ? `${risk.treatment_plan}\n\n${stamp}` : stamp;

  // The DB trigger refuses an acceptance without a named acceptor and time —
  // any refusal is surfaced, never swallowed.
  const { error } = await db
    .from("soc2_risks")
    .update({
      status: "accepted",
      accepted_by: guard.email,
      accepted_at: new Date().toISOString(),
      treatment_plan: plan,
    })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "risk",
    recordId: id,
    type: "accepted",
    summary: `${risk.ref} accepted by ${guard.email}; rationale recorded on the treatment plan.`,
    detail: { previous_status: risk.status },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

// ── page ───────────────────────────────────────────────────────

const GRID = "80px 1.6fr 120px 130px 100px 150px 100px 100px";

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span style={monoLabel}>{label}</span>
      <span style={{ ...bodyText, whiteSpace: "pre-wrap" }}>{children}</span>
    </div>
  );
}

export default async function RisksPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  const supabase = await createClient();
  const [{ data: riskRows }, { data: controlRows }] = await Promise.all([
    supabase
      .from("soc2_risks")
      .select(
        "id, ref, title, description, category, likelihood, impact, treatment, treatment_plan, owner_email, linked_control_keys, residual_likelihood, residual_impact, status, accepted_by, accepted_at, review_due_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(400),
    supabase.from("soc2_controls").select("id, key").order("key"),
  ]);
  const risks = (riskRows ?? []) as RiskRow[];
  const controls = (controlRows ?? []) as ControlRef[];
  const controlByKey = new Map(controls.map((c) => [c.key, c.id]));
  const today = toDateOnly(new Date());

  const open = risks.filter((r) => r.status === "open");
  const undecided = risks.filter((r) => r.treatment === "undecided" && r.status !== "closed");
  const overdue = risks.filter(
    (r) => r.review_due_at && r.review_due_at < today && r.status !== "closed"
  );
  const accepted = risks.filter((r) => r.status === "accepted");

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Risk register"
        lead="Identified risks with scored likelihood and impact, a treatment decision, a named owner and a review date — acceptance is a recorded Programme Owner decision, never a quiet status change."
      />

      {err && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.05em",
            color: T.danger,
            border: `1px solid ${T.danger}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          ERR: {err}
        </p>
      )}

      <Reveal delay={0.04}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 22 }}>
          <StatCard value={String(open.length)} label="Open risks" />
          <StatCard
            value={String(undecided.length)}
            label="Undecided treatment"
            sub={undecided.length ? "Each needs a mitigate / transfer / avoid / accept decision." : undefined}
          />
          <StatCard value={String(overdue.length)} label="Overdue reviews" />
          <StatCard
            value={String(accepted.length)}
            label="Accepted risks"
            sub={accepted.length ? "Named decisions with rationale on the treatment plan." : undefined}
          />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// RISK REGISTER" pad={false}>
            {risks.length === 0 ? (
              <EmptyRow>
                No risks recorded yet — raise the first one below with its likelihood and impact
                scores.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={GRID}
                  cols={["ref", "title", "category", "score", "treatment", "owner", "status", "review due"]}
                />
                {risks.map((r, i) => {
                  const score = r.likelihood * r.impact;
                  const residual =
                    r.residual_likelihood !== null && r.residual_impact !== null
                      ? r.residual_likelihood * r.residual_impact
                      : null;
                  const reviewPast =
                    r.review_due_at !== null && r.review_due_at < today && r.status !== "closed";
                  const keys = Array.isArray(r.linked_control_keys) ? r.linked_control_keys : [];
                  return (
                    <details key={r.id}>
                      <summary
                        className="grid md:grid gap-3 items-center px-4 py-2.5"
                        style={{
                          gridTemplateColumns: GRID,
                          borderTop: i ? "1px solid var(--k-border)" : "none",
                          cursor: "pointer",
                          listStyle: "none",
                        }}
                      >
                        <span style={{ fontFamily: T.mono, fontSize: "10px", color: "var(--k-faint)" }}>
                          {r.ref}
                        </span>
                        <span
                          className="min-w-0"
                          style={{
                            fontFamily: T.sans,
                            fontSize: "0.85rem",
                            color: "var(--k-fg)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={r.title}
                        >
                          {r.title}
                        </span>
                        <span style={faintMono}>{r.category.replace(/_/g, " ")}</span>
                        <span className="flex flex-col items-start gap-1">
                          <StatusChip tone={scoreTone(score)}>
                            {r.likelihood}×{r.impact} = {score}
                          </StatusChip>
                          {residual !== null && (
                            <StatusChip tone={scoreTone(residual)}>
                              res {r.residual_likelihood}×{r.residual_impact} = {residual}
                            </StatusChip>
                          )}
                        </span>
                        <span
                          style={{
                            ...faintMono,
                            color: r.treatment === "undecided" ? T.warning : "var(--k-muted)",
                          }}
                        >
                          {r.treatment}
                        </span>
                        {r.owner_email ? (
                          <span
                            className="min-w-0"
                            style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                            title={r.owner_email}
                          >
                            {r.owner_email}
                          </span>
                        ) : (
                          <span>
                            <StatusChip tone="warning">no owner</StatusChip>
                          </span>
                        )}
                        <span>
                          <StatusChip tone={RISK_STATUS_TONE[r.status]}>
                            {r.status.replace(/_/g, " ")}
                          </StatusChip>
                        </span>
                        <span style={{ ...faintMono, color: reviewPast ? T.danger : "var(--k-faint)" }}>
                          {r.review_due_at ? shortDate(r.review_due_at) : "—"}
                        </span>
                      </summary>

                      <div
                        className="grid md:grid-cols-2 gap-x-6 gap-y-3 px-4 py-4"
                        style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                      >
                        <Meta label="Description">{r.description || "—"}</Meta>
                        <Meta label="Treatment plan">{r.treatment_plan || "—"}</Meta>
                        <Meta label="Raised">{shortDate(r.created_at)}</Meta>
                        {r.status === "accepted" && (
                          <Meta label="Accepted">
                            {r.accepted_by ?? "—"} · {shortDate(r.accepted_at)}
                          </Meta>
                        )}
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <span style={monoLabel}>Linked controls</span>
                          {keys.length === 0 ? (
                            <span style={bodyText}>—</span>
                          ) : (
                            <span className="flex flex-wrap gap-1.5">
                              {keys.map((k) => {
                                const controlId = controlByKey.get(k);
                                return (
                                  <Link
                                    key={k}
                                    href={
                                      controlId
                                        ? `/admin/soc2/controls/${controlId}`
                                        : "/admin/soc2/controls"
                                    }
                                    style={{
                                      fontFamily: T.mono,
                                      fontSize: "10px",
                                      letterSpacing: "0.08em",
                                      textTransform: "uppercase",
                                      padding: "4px 8px",
                                      border: "1px solid var(--k-border)",
                                      color: "var(--k-accent)",
                                      textDecoration: "none",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {k}
                                  </Link>
                                );
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Update — treatment, ownership, residual scoring, status */}
                      <form
                        action={updateRisk}
                        className="flex flex-wrap items-end gap-3 px-4 py-4"
                        style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <Field label="Treatment">
                          <select name="treatment" style={inp} defaultValue={r.treatment}>
                            {TREATMENTS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Owner email" grow>
                          <input
                            name="owner_email"
                            type="email"
                            style={inp}
                            defaultValue={r.owner_email ?? ""}
                            maxLength={200}
                          />
                        </Field>
                        <Field label="Residual likelihood">
                          <select
                            name="residual_likelihood"
                            style={inp}
                            defaultValue={r.residual_likelihood !== null ? String(r.residual_likelihood) : ""}
                          >
                            <option value="">—</option>
                            {LEVELS.map((n) => (
                              <option key={n} value={String(n)}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Residual impact">
                          <select
                            name="residual_impact"
                            style={inp}
                            defaultValue={r.residual_impact !== null ? String(r.residual_impact) : ""}
                          >
                            <option value="">—</option>
                            {LEVELS.map((n) => (
                              <option key={n} value={String(n)}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Review due">
                          <input
                            name="review_due_at"
                            type="date"
                            style={inp}
                            defaultValue={r.review_due_at ?? ""}
                          />
                        </Field>
                        <Field label="Status">
                          <select
                            name="status"
                            style={inp}
                            defaultValue={r.status === "accepted" ? "open" : r.status}
                          >
                            {UPDATE_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Treatment plan" grow>
                          <textarea
                            name="treatment_plan"
                            style={textarea}
                            maxLength={4000}
                            defaultValue={r.treatment_plan ?? ""}
                            placeholder="How this risk is being mitigated, transferred or avoided — references only, never secrets."
                          />
                        </Field>
                        <SubmitButton style={primaryBtn}>Save changes</SubmitButton>
                        {r.status === "accepted" && (
                          <p className="w-full" style={faintMono}>
                            This risk is accepted. Saving a new status here reopens the decision;
                            re-acceptance needs the Programme Owner again.
                          </p>
                        )}
                      </form>

                      {/* Accept — Programme Owner only, named decision */}
                      {r.status !== "accepted" && (
                        <form
                          action={acceptRisk}
                          className="flex flex-col gap-3 px-4 py-4"
                          style={{ borderTop: "1px dashed var(--k-border)", background: "var(--k-bg)" }}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <Field label="Acceptance rationale (appended to the treatment plan)" grow>
                            <textarea
                              name="rationale"
                              style={textarea}
                              required
                              maxLength={2000}
                              placeholder="Why this risk is being carried as-is, and for how long."
                            />
                          </Field>
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              name="confirm"
                              placeholder="type ACCEPT"
                              autoComplete="off"
                              style={{ ...inp, fontFamily: T.mono, width: 130 }}
                            />
                            <SubmitButton style={primaryBtn}>Accept risk</SubmitButton>
                            <p style={faintMono}>
                              Programme Owner only — the database refuses an acceptance without a
                              named acceptor and time.
                            </p>
                          </div>
                        </form>
                      )}
                    </details>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </Reveal>

      {/* Raise a risk */}
      <Reveal delay={0.12}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// RAISE A RISK" title="Identified something the register should carry?">
            <form action={createRisk} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Title" grow>
                  <input
                    name="title"
                    style={inp}
                    required
                    maxLength={200}
                    placeholder="What could go wrong, in one sentence"
                  />
                </Field>
                <Field label="Category">
                  <select name="category" style={inp} defaultValue="security">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Likelihood (1–5)">
                  <select name="likelihood" style={inp} defaultValue="3">
                    {LEVELS.map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Impact (1–5)">
                  <select name="impact" style={inp} defaultValue="3">
                    {LEVELS.map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description (references only — never paste secrets or client personal data)">
                <textarea name="description" style={textarea} maxLength={4000} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Field label="Treatment">
                  <select name="treatment" style={inp} defaultValue="undecided">
                    {TREATMENTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Owner email" grow>
                  <input name="owner_email" type="email" style={inp} maxLength={200} />
                </Field>
                <Field label="Review due">
                  <input name="review_due_at" type="date" style={inp} />
                </Field>
                <Field label="Linked control keys (comma-separated)" grow>
                  <input
                    name="linked_control_keys"
                    style={inp}
                    maxLength={300}
                    placeholder="e.g. IAM-02, CHG-01"
                  />
                </Field>
              </div>
              <Field label="Treatment plan">
                <textarea name="treatment_plan" style={textarea} maxLength={4000} />
              </Field>
              <div>
                <SubmitButton style={primaryBtn}>Raise risk</SubmitButton>
              </div>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
