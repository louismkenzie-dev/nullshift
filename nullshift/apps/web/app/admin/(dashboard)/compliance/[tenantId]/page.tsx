import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import { sendEmail } from "@/lib/sendEmail";
import { wrap, esc, C, FONT } from "@/lib/emailLayout";
import { PLAYBOOKS, instantiate } from "@/lib/playbooks";
import {
  INTAKE_SECTIONS,
  TRIGGER_LABEL,
  answersFromForm,
  buildReviewPack,
  deriveFlags,
  type ComplianceTrigger,
  type IntakeAnswers,
} from "@/lib/compliance";

/**
 * Compliance review centre for one client (audit Phase 4.3). Issue spotting,
 * evidence gathering, drafting support, escalation — never legal conclusions.
 * Reviews run at discovery, material scope change, and pre-launch; mandatory-
 * escalation flags block "recorded" until an Administrator writes a decision
 * (attaching qualified advice where required).
 */
export const dynamic = "force-dynamic";

const TRIGGERS: ComplianceTrigger[] = ["discovery", "scope_change", "pre_launch"];

const STATUS_META: Record<
  string,
  { label: string; tone: "accent" | "success" | "warning" | "danger" | "muted" }
> = {
  draft: { label: "In progress", tone: "accent" },
  escalated: { label: "Escalated — decision required", tone: "danger" },
  decision_recorded: { label: "Decision recorded", tone: "warning" },
  recorded: { label: "Review recorded (not legal advice)", tone: "success" },
};

// ── server actions ─────────────────────────────────────────────

async function startReview(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const projectId = String(formData.get("project_id") || "") || null;
  const trigger = String(formData.get("trigger") || "") as ComplianceTrigger;
  if (!tenantId || !TRIGGERS.includes(trigger)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("compliance_reviews")
    .insert({ tenant_id: tenantId, project_id: projectId, trigger })
    .select("id")
    .single();
  await logAudit({
    action: "compliance_review.started",
    target: `tenant:${tenantId}`,
    tenantId,
    metadata: { trigger },
  });
  redirect(`/admin/compliance/${tenantId}?review=${data?.id ?? ""}`);
}

async function saveIntake(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const reviewId = String(formData.get("review_id") || "");
  if (!tenantId || !reviewId) return;
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("compliance_reviews")
    .select("id, trigger, project_id, flags, status")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review || review.status === "recorded") return;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();

  const answers = answersFromForm(formData);
  const flags = deriveFlags(answers);
  const pack = buildReviewPack({
    clientName: tenant?.name ?? "Client",
    trigger: review.trigger as ComplianceTrigger,
    answers,
    flags,
  });
  const hadFlags = ((review.flags ?? []) as string[]).length > 0;
  const status = flags.length > 0 ? "escalated" : "draft";
  await supabase
    .from("compliance_reviews")
    .update({ answers, flags, pack, status })
    .eq("id", reviewId);
  await logAudit({
    action: "compliance_review.intake_saved",
    target: `compliance_review:${reviewId}`,
    tenantId,
    metadata: { flags },
  });

  // Children's data → seed the dedicated checklist on the project (idempotent).
  if (answers.children_possible === true && review.project_id) {
    await supabase.from("checklists").insert({
      tenant_id: tenantId,
      project_id: review.project_id,
      kind: "children_data",
      title: PLAYBOOKS.children_data.title,
      items: instantiate("children_data"),
    });
  }

  // Partner alert on NEW escalation — a flag nobody hears about protects no one.
  if (flags.length > 0 && !hadFlags) {
    try {
      await sendEmail({
        purpose: "transactional",
        to: process.env.ENQUIRY_NOTIFY_EMAIL || "louis@nullshift.co.uk",
        subject: `⚑ Compliance escalation — ${tenant?.name ?? "client"} (${TRIGGER_LABEL[review.trigger as ComplianceTrigger]})`,
        html: wrap(
          `<tr><td style="padding:26px 32px"><h1 style="margin:0 0 10px;font-family:${FONT};font-size:19px;font-weight:700;color:${C.fg}">Compliance flags need an Administrator decision</h1><ul style="margin:0;padding-left:18px">${flags.map((f) => `<li style="font-family:${FONT};font-size:14px;color:${C.fg};margin:0 0 6px">${esc(f)}</li>`).join("")}</ul><p style="margin:14px 0 0;font-family:${FONT};font-size:13px;color:${C.muted}">The review cannot be marked recorded until a decision is written down. Attach qualified advice where required.</p></td></tr>`,
          "Compliance escalation"
        ),
        text: `Compliance escalation — ${flags.join("; ")}`,
      });
    } catch (e) {
      console.error("escalation email failed (non-fatal):", e);
    }
  }
  revalidatePath(`/admin/compliance/${tenantId}`);
}

async function savePack(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const reviewId = String(formData.get("review_id") || "");
  const pack = String(formData.get("pack") || "");
  if (!tenantId || !reviewId) return;
  const supabase = await createClient();
  await supabase
    .from("compliance_reviews")
    .update({ pack })
    .eq("id", reviewId)
    .neq("status", "recorded");
  revalidatePath(`/admin/compliance/${tenantId}`);
}

async function recordDecision(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const reviewId = String(formData.get("review_id") || "");
  const decision = String(formData.get("decision") || "").trim();
  const decidedBy = String(formData.get("decided_by") || "").trim();
  if (!tenantId || !reviewId || !decision || !decidedBy) return;
  const supabase = await createClient();
  await supabase
    .from("compliance_reviews")
    .update({
      decision,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      status: "decision_recorded",
    })
    .eq("id", reviewId)
    .eq("status", "escalated");
  await logAudit({
    action: "compliance_review.decision_recorded",
    target: `compliance_review:${reviewId}`,
    tenantId,
    metadata: { decided_by: decidedBy },
  });
  revalidatePath(`/admin/compliance/${tenantId}`);
}

async function markRecorded(formData: FormData) {
  "use server";
  if (!(await requireStaff()).ok) return;
  const tenantId = String(formData.get("tenant_id") || "");
  const reviewId = String(formData.get("review_id") || "");
  if (!tenantId || !reviewId) return;
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("compliance_reviews")
    .select("id, flags, status, decision")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return;
  const flags = (review.flags ?? []) as string[];
  // THE gate: escalation flags block "recorded" until a decision exists.
  const allowed =
    (flags.length === 0 && review.status === "draft") ||
    review.status === "decision_recorded";
  if (!allowed) return;
  await supabase
    .from("compliance_reviews")
    .update({ status: "recorded" })
    .eq("id", reviewId);
  await logAudit({
    action: "compliance_review.recorded",
    target: `compliance_review:${reviewId}`,
    tenantId,
  });
  revalidatePath(`/admin/compliance/${tenantId}`);
}

// ── page ───────────────────────────────────────────────────────

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  padding: "8px 10px",
  background: "var(--k-bg)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  outline: "none",
  width: "100%",
};

type Review = {
  id: string;
  trigger: ComplianceTrigger;
  project_id: string | null;
  answers: IntakeAnswers;
  flags: string[];
  status: string;
  pack: string | null;
  decision: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export default async function ComplianceReviewCentre({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const { tenantId } = await params;
  const { review: selectedId } = await searchParams;
  const supabase = await createClient();
  const [{ data: tenant }, { data: projects }, { data: reviewsRaw }] = await Promise.all([
    supabase.from("tenants").select("id, name").eq("id", tenantId).maybeSingle(),
    supabase.from("projects").select("id, name").eq("tenant_id", tenantId),
    supabase
      .from("compliance_reviews")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);
  if (!tenant) notFound();
  const reviews = (reviewsRaw ?? []) as Review[];
  const selected = reviews.find((r) => r.id === selectedId) ?? reviews[0] ?? null;
  const hidden = selected && (
    <>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="review_id" value={selected.id} />
    </>
  );

  return (
    <div>
      <PageHeader
        index="03"
        label="COMPLIANCE REVIEW"
        title={tenant.name}
        lead="Issue spotting, evidence gathering, escalation — this centre records reviews and routes material matters to an Administrator and, where needed, a qualified UK solicitor. It never declares anything compliant."
        actions={
          <Link
            href="/admin/compliance"
            style={{ ...mono, fontSize: 11, color: "var(--k-muted)" }}
          >
            ← Compliance
          </Link>
        }
      />

      {/* Start a review + list */}
      <Reveal>
        <Panel label="// REVIEWS" title="Reviews" className="mt-6 mb-4">
          <form action={startReview} className="flex items-center gap-2 flex-wrap">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <select name="trigger" style={{ ...inp, width: 200 }}>
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABEL[t]}
                </option>
              ))}
            </select>
            <select name="project_id" style={{ ...inp, width: 200 }}>
              <option value="">No specific project</option>
              {((projects ?? []) as { id: string; name: string }[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <SubmitButton
              style={{
                ...mono,
                fontSize: 11,
                height: 34,
                paddingInline: 12,
                background: "var(--k-accent)",
                color: "var(--k-on-accent)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Start review
            </SubmitButton>
          </form>
          {reviews.length > 0 && (
            <div className="flex flex-col" style={{ marginTop: 12 }}>
              {reviews.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/admin/compliance/${tenantId}?review=${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  style={{
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                    textDecoration: "none",
                    opacity: selected?.id === r.id ? 1 : 0.75,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      color: "var(--k-fg)",
                    }}
                  >
                    {TRIGGER_LABEL[r.trigger]} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </span>
                  <StatusChip tone={STATUS_META[r.status]?.tone ?? "muted"}>
                    {STATUS_META[r.status]?.label ?? r.status}
                  </StatusChip>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </Reveal>

      {selected && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {/* Intake */}
          <Reveal>
            <Panel label="// INTAKE" title={`${TRIGGER_LABEL[selected.trigger]} intake`}>
              <form action={saveIntake} className="flex flex-col gap-4">
                {hidden}
                {INTAKE_SECTIONS.map((section) => (
                  <fieldset key={section.title} style={{ border: "none", padding: 0 }}>
                    <legend
                      style={{ ...mono, color: "var(--k-accent)", marginBottom: 6 }}
                    >
                      {section.title}
                    </legend>
                    <div className="flex flex-col gap-2.5">
                      {section.fields.map((f) =>
                        f.type === "bool" ? (
                          <label
                            key={f.key}
                            className="flex items-center gap-2"
                            style={{
                              fontFamily: T.sans,
                              fontSize: "0.85rem",
                              color: "var(--k-fg)",
                            }}
                          >
                            <input
                              type="checkbox"
                              name={f.key}
                              defaultChecked={selected.answers[f.key] === true}
                              disabled={selected.status === "recorded"}
                            />
                            {f.label}
                            {f.escalates && (
                              <span style={{ ...mono, fontSize: 8, color: T.danger }}>
                                ⚑ escalates
                              </span>
                            )}
                          </label>
                        ) : (
                          <label key={f.key} className="flex flex-col gap-1">
                            <span
                              style={{ ...mono, fontSize: 9, color: "var(--k-faint)" }}
                            >
                              {f.label}
                            </span>
                            <textarea
                              name={f.key}
                              rows={2}
                              defaultValue={String(selected.answers[f.key] ?? "")}
                              disabled={selected.status === "recorded"}
                              style={{ ...inp, resize: "vertical" }}
                            />
                          </label>
                        )
                      )}
                    </div>
                  </fieldset>
                ))}
                {selected.status !== "recorded" && (
                  <SubmitButton
                    className="self-start"
                    style={{
                      ...mono,
                      fontSize: 11,
                      height: 34,
                      paddingInline: 14,
                      background: "var(--k-surface)",
                      color: "var(--k-fg)",
                      border: "1px solid var(--k-border)",
                      cursor: "pointer",
                    }}
                  >
                    Save intake — re-derive flags &amp; pack
                  </SubmitButton>
                )}
              </form>
            </Panel>
          </Reveal>

          <div className="flex flex-col gap-4">
            {/* Flags + escalation gate */}
            <Reveal>
              <Panel
                label="// ESCALATION"
                title={
                  selected.flags.length
                    ? `${selected.flags.length} mandatory flag${selected.flags.length === 1 ? "" : "s"}`
                    : "No mandatory flags"
                }
              >
                {selected.flags.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {selected.flags.map((f) => (
                      <span
                        key={f}
                        style={{
                          fontFamily: T.sans,
                          fontSize: "0.86rem",
                          color: T.danger,
                        }}
                      >
                        ⚑ {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-muted)",
                    }}
                  >
                    Nothing on the mandatory-escalation list from this intake. That is not
                    a clearance — uncertainty is a reason to escalate, not infer.
                  </p>
                )}

                {selected.status === "escalated" && (
                  <form
                    action={recordDecision}
                    className="flex flex-col gap-2"
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid var(--k-border)",
                    }}
                  >
                    {hidden}
                    <span style={{ ...mono, color: T.danger }}>
                      Administrator decision required before this review can be recorded
                    </span>
                    <textarea
                      name="decision"
                      required
                      rows={3}
                      placeholder="The decision, and where qualified advice was taken, who gave it"
                      style={{ ...inp, resize: "vertical" }}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        name="decided_by"
                        required
                        placeholder="Administrator name"
                        style={{ ...inp, width: 180 }}
                      />
                      <SubmitButton
                        style={{
                          ...mono,
                          fontSize: 11,
                          height: 34,
                          paddingInline: 14,
                          background: "var(--k-accent)",
                          color: "var(--k-on-accent)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Record decision
                      </SubmitButton>
                    </div>
                  </form>
                )}

                {selected.decision && (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-muted)",
                      marginTop: 10,
                    }}
                  >
                    <strong style={{ color: "var(--k-fg)" }}>Decision</strong> —{" "}
                    {selected.decision}
                    <span
                      style={{ ...mono, fontSize: 9, display: "block", marginTop: 4 }}
                    >
                      {selected.decided_by} ·{" "}
                      {selected.decided_at &&
                        new Date(selected.decided_at).toLocaleDateString("en-GB")}
                    </span>
                  </p>
                )}

                {(selected.status === "draft" ||
                  selected.status === "decision_recorded") && (
                  <form action={markRecorded} style={{ marginTop: 12 }}>
                    {hidden}
                    <SubmitButton
                      style={{
                        ...mono,
                        fontSize: 11,
                        height: 34,
                        paddingInline: 14,
                        background: "transparent",
                        color: T.success,
                        border: "1px solid var(--k-border)",
                        cursor: "pointer",
                      }}
                    >
                      Mark review recorded (not legal advice)
                    </SubmitButton>
                  </form>
                )}
              </Panel>
            </Reveal>

            {/* Review pack */}
            <Reveal>
              <Panel label="// REVIEW PACK" title="Evidence-linked draft pack">
                {selected.pack ? (
                  <form action={savePack} className="flex flex-col gap-2">
                    {hidden}
                    <textarea
                      name="pack"
                      rows={22}
                      defaultValue={selected.pack}
                      disabled={selected.status === "recorded"}
                      style={{
                        ...inp,
                        fontFamily: T.mono,
                        fontSize: "0.72rem",
                        lineHeight: 1.5,
                        resize: "vertical",
                      }}
                    />
                    {selected.status !== "recorded" && (
                      <SubmitButton
                        className="self-start"
                        style={{
                          ...mono,
                          fontSize: 11,
                          height: 30,
                          paddingInline: 12,
                          background: "transparent",
                          color: "var(--k-muted)",
                          border: "1px solid var(--k-border)",
                          cursor: "pointer",
                        }}
                      >
                        Save pack edits
                      </SubmitButton>
                    )}
                  </form>
                ) : (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-muted)",
                    }}
                  >
                    Save the intake once and the pack assembles itself from the answers —
                    system summary, issue register, missing questions, documents that may
                    be required, and draft questions for the client or solicitor.
                  </p>
                )}
              </Panel>
            </Reveal>
          </div>
        </div>
      )}
    </div>
  );
}
