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
import { VENDOR_STATUS_TONE, type ChipTone } from "@/lib/soc2/ui";
import { addDays, toDateOnly } from "@/lib/soc2/schedule";
import {
  inp,
  textarea,
  primaryBtn,
  dangerBtn,
  Field,
  shortDate,
  EmptyRow,
  HeaderRow,
  monoLabel,
  faintMono,
  bodyText,
} from "../shared";

/**
 * Vendor & sub-processor register — the risk and review side of the vendor
 * estate: what each third party does for us, what data it can touch, how hard
 * we depend on it, whether a DPA is in place, and when it was last reviewed.
 * The public sub-processor register (packages/content legal) stays the
 * client-facing publication and its 14-day change-notice machinery is
 * unchanged. Seeded entries arrive PROPOSED because the legal register itself
 * marks them unverified — approval here is a real Programme Owner review, not
 * a data migration. Approvals and periodic reviews each file an evidence item
 * against the vendor-management controls (VND-02 / VND-03).
 */

export const dynamic = "force-dynamic";

const PAGE = "/admin/soc2/vendors";

const DATA_ACCESS = ["none", "internal", "confidential", "personal", "special_category"] as const;
type DataAccess = (typeof DATA_ACCESS)[number];

const LEVELS = ["low", "medium", "high", "critical"] as const;
type Level = (typeof LEVELS)[number];

const DPA_STATUSES = ["unknown", "not_required", "pending", "in_place"] as const;
type DpaStatus = (typeof DPA_STATUSES)[number];

const CONTRACT_STATUSES = ["unknown", "none", "standard_terms", "negotiated"] as const;
type ContractStatus = (typeof CONTRACT_STATUSES)[number];

type VendorStatus = "proposed" | "approved" | "conditional" | "rejected" | "offboarded";

type SecurityDoc = { kind?: string; reference?: string; expires_on?: string | null };

type VendorRow = {
  id: string;
  name: string;
  service: string;
  subprocessor_id: string | null;
  data_access: DataAccess;
  service_dependency: Level | null;
  owner_email: string | null;
  risk_level: Level | null;
  security_docs: SecurityDoc[] | null;
  dpa_status: DpaStatus;
  contract_status: ContractStatus;
  transfer_note: string | null;
  status: VendorStatus;
  approved_by: string | null;
  approved_at: string | null;
  last_review_at: string | null;
  review_due_at: string | null;
  notes: string | null;
  created_at: string;
};

type ControlRef = { id: string; key: string };

const docsOf = (v: VendorRow): SecurityDoc[] =>
  Array.isArray(v.security_docs) ? v.security_docs : [];

const docExpired = (d: SecurityDoc, today: string): boolean =>
  typeof d.expires_on === "string" && d.expires_on !== "" && d.expires_on.slice(0, 10) < today;

const dataAccessTone = (d: DataAccess): ChipTone =>
  d === "special_category" || d === "personal"
    ? "warning"
    : d === "confidential"
      ? "accent"
      : "muted";

const dpaTone = (dpa: DpaStatus, dataAccess: DataAccess): ChipTone => {
  if (dpa === "in_place") return "success";
  if (dpa === "pending") return "warning";
  if (dpa === "unknown") {
    return ["personal", "special_category", "confidential"].includes(dataAccess)
      ? "danger"
      : "muted";
  }
  return "muted"; // not_required
};

// ── server actions ─────────────────────────────────────────────

async function createVendor(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const name = String(formData.get("name") || "").trim();
  const service = String(formData.get("service") || "").trim();
  const dataAccess = String(formData.get("data_access") || "");
  const dependency = String(formData.get("service_dependency") || "");
  const ownerEmail = String(formData.get("owner_email") || "").trim();
  const dpaStatus = String(formData.get("dpa_status") || "");
  const contractStatus = String(formData.get("contract_status") || "");
  const transferNote = String(formData.get("transfer_note") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  if (!name || !service) return;
  if (!(DATA_ACCESS as readonly string[]).includes(dataAccess)) return;
  if (!(LEVELS as readonly string[]).includes(dependency)) return;
  if (!(DPA_STATUSES as readonly string[]).includes(dpaStatus)) return;
  if (!(CONTRACT_STATUSES as readonly string[]).includes(contractStatus)) return;

  const db = createServiceClient();
  const { data: created, error } = await db
    .from("soc2_vendors")
    .insert({
      name,
      service,
      data_access: dataAccess,
      service_dependency: dependency,
      owner_email: ownerEmail || null,
      dpa_status: dpaStatus,
      contract_status: contractStatus,
      transfer_note: transferNote || null,
      notes: notes || null,
      status: "proposed",
    })
    .select("id")
    .single();
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;

  await logSoc2Event({
    recordType: "vendor",
    recordId: created.id,
    type: "created",
    summary: `Vendor ${name} added to the register as proposed (data access ${dataAccess.replace(/_/g, " ")}, dependency ${dependency}).`,
    detail: {
      service: service.slice(0, 200),
      data_access: dataAccess,
      service_dependency: dependency,
      dpa_status: dpaStatus,
      contract_status: contractStatus,
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function updateVendor(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const ownerEmail = String(formData.get("owner_email") || "").trim();
  const dataAccess = String(formData.get("data_access") || "");
  const dependency = String(formData.get("service_dependency") || "");
  const riskLevel = String(formData.get("risk_level") || "").trim();
  const dpaStatus = String(formData.get("dpa_status") || "");
  const contractStatus = String(formData.get("contract_status") || "");
  const transferNote = String(formData.get("transfer_note") || "").trim();
  const reviewDueAt = String(formData.get("review_due_at") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  if (!id) return;
  if (!(DATA_ACCESS as readonly string[]).includes(dataAccess)) return;
  if (!(LEVELS as readonly string[]).includes(dependency)) return;
  if (riskLevel && !(LEVELS as readonly string[]).includes(riskLevel)) return;
  if (!(DPA_STATUSES as readonly string[]).includes(dpaStatus)) return;
  if (!(CONTRACT_STATUSES as readonly string[]).includes(contractStatus)) return;

  const db = createServiceClient();
  const { data: vendor } = await db
    .from("soc2_vendors")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!vendor) return;

  const { error } = await db
    .from("soc2_vendors")
    .update({
      owner_email: ownerEmail || null,
      data_access: dataAccess,
      service_dependency: dependency,
      risk_level: riskLevel || null,
      dpa_status: dpaStatus,
      contract_status: contractStatus,
      transfer_note: transferNote || null,
      review_due_at: reviewDueAt || null,
      notes: notes || null,
    })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "vendor",
    recordId: id,
    type: "updated",
    summary: `${vendor.name} updated: data access ${dataAccess.replace(/_/g, " ")}, dependency ${dependency}, DPA ${dpaStatus.replace(/_/g, " ")}.`,
    detail: {
      data_access: dataAccess,
      service_dependency: dependency,
      risk_level: riskLevel || null,
      dpa_status: dpaStatus,
      contract_status: contractStatus,
      owner_email: ownerEmail || null,
      review_due_at: reviewDueAt || null,
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function addSecurityDoc(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const reference = String(formData.get("reference") || "").trim();
  const expiresOn = String(formData.get("expires_on") || "").trim();
  if (!id || !kind || !reference) return;

  const db = createServiceClient();
  const { data: vendor } = await db
    .from("soc2_vendors")
    .select("id, name, security_docs")
    .eq("id", id)
    .maybeSingle();
  if (!vendor) return;

  const docs: SecurityDoc[] = Array.isArray(vendor.security_docs)
    ? (vendor.security_docs as SecurityDoc[])
    : [];
  docs.push({ kind, reference, expires_on: expiresOn || null });

  const { error } = await db
    .from("soc2_vendors")
    .update({ security_docs: docs as never })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "vendor",
    recordId: id,
    type: "doc.added",
    summary: `Security document (${kind.slice(0, 60)}) filed against ${vendor.name}${expiresOn ? `, expires ${expiresOn}` : ""}.`,
    detail: { kind, reference: reference.slice(0, 300), expires_on: expiresOn || null },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function approveVendor(formData: FormData) {
  "use server";
  // Vendor approval is a Programme Owner review — a named decision that files
  // evidence against the vendor-management control, never a bulk migration.
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const reviewNote = String(formData.get("review_note") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id || !reviewNote || confirm !== "APPROVE") return;

  const db = createServiceClient();
  const [{ data: vendor }, { data: control }] = await Promise.all([
    db.from("soc2_vendors").select("id, name, status, notes").eq("id", id).maybeSingle(),
    db.from("soc2_controls").select("id").eq("key", "VND-02").maybeSingle(),
  ]);
  if (!vendor || vendor.status === "approved" || vendor.status === "offboarded") return;

  const today = toDateOnly(new Date());
  const nextDue = addDays(today, 366);
  const stamp = `Approval review ${today}: ${reviewNote}`;
  const notes = vendor.notes ? `${vendor.notes}\n\n${stamp}` : stamp;

  const { error } = await db
    .from("soc2_vendors")
    .update({
      status: "approved",
      approved_by: guard.email,
      approved_at: new Date().toISOString(),
      last_review_at: today,
      review_due_at: nextDue,
      notes,
    })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  // Evidence of the review, filed against VND-02. Skipped (not faked) when
  // the control library has not been installed yet.
  if (control) {
    await db.from("soc2_evidence_items").insert({
      control_id: control.id,
      title: `Vendor review: ${vendor.name}`,
      source: "vendor_review",
      source_ref: `soc2_vendors:${id}`,
      collected_by: guard.email,
      classification: "confidential",
    });
  }

  await logSoc2Event({
    recordType: "vendor",
    recordId: id,
    type: "approved",
    summary: `${vendor.name} approved by ${guard.email}; review note recorded, next review due ${nextDue}.`,
    detail: {
      previous_status: vendor.status,
      review_due_at: nextDue,
      evidence_filed: control ? "VND-02" : "skipped_control_unseeded",
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function recordReview(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const summary = String(formData.get("review_summary") || "").trim();
  const reviewDueAt = String(formData.get("review_due_at") || "").trim();
  if (!id || !summary || !reviewDueAt) return;

  const db = createServiceClient();
  const [{ data: vendor }, { data: control }] = await Promise.all([
    db.from("soc2_vendors").select("id, name, status, notes").eq("id", id).maybeSingle(),
    db.from("soc2_controls").select("id").eq("key", "VND-03").maybeSingle(),
  ]);
  if (!vendor || vendor.status === "offboarded") return;

  const today = toDateOnly(new Date());
  const stamp = `Review ${today}: ${summary}`;
  const notes = vendor.notes ? `${vendor.notes}\n\n${stamp}` : stamp;

  const { error } = await db
    .from("soc2_vendors")
    .update({ last_review_at: today, review_due_at: reviewDueAt, notes })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  // Evidence of the periodic review, filed against VND-03 (skipped if the
  // control library is not installed yet).
  if (control) {
    await db.from("soc2_evidence_items").insert({
      control_id: control.id,
      title: `Vendor review: ${vendor.name}`,
      source: "vendor_review",
      source_ref: `soc2_vendors:${id}`,
      collected_by: guard.email,
      classification: "confidential",
    });
  }

  await logSoc2Event({
    recordType: "vendor",
    recordId: id,
    type: "reviewed",
    summary: `${vendor.name} reviewed by ${guard.email}; next review due ${reviewDueAt}.`,
    detail: {
      last_review_at: today,
      review_due_at: reviewDueAt,
      evidence_filed: control ? "VND-03" : "skipped_control_unseeded",
    },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function offboardVendor(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const id = String(formData.get("id") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!id || confirm !== "OFFBOARD") return;

  const db = createServiceClient();
  const { data: vendor } = await db
    .from("soc2_vendors")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();
  if (!vendor || vendor.status === "offboarded") return;

  const { error } = await db
    .from("soc2_vendors")
    .update({ status: "offboarded" })
    .eq("id", id);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "vendor",
    recordId: id,
    type: "offboarded",
    summary: `${vendor.name} offboarded from the vendor register.`,
    detail: { previous_status: vendor.status },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

// ── page ───────────────────────────────────────────────────────

const GRID = "1.5fr 1.2fr 120px 95px 110px 1fr 105px 150px";

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span style={monoLabel}>{label}</span>
      <span style={{ ...bodyText, whiteSpace: "pre-wrap" }}>{children}</span>
    </div>
  );
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  const supabase = await createClient();
  const [{ data: vendorRows }, { data: controlRows }] = await Promise.all([
    supabase
      .from("soc2_vendors")
      .select(
        "id, name, service, subprocessor_id, data_access, service_dependency, owner_email, risk_level, security_docs, dpa_status, contract_status, transfer_note, status, approved_by, approved_at, last_review_at, review_due_at, notes, created_at"
      )
      .order("name")
      .limit(400),
    supabase.from("soc2_controls").select("id, key").in("key", ["VND-02", "VND-03"]),
  ]);
  const vendors = (vendorRows ?? []) as VendorRow[];
  const controls = (controlRows ?? []) as ControlRef[];
  const controlKeys = new Set(controls.map((c) => c.key));
  const today = toDateOnly(new Date());

  const approved = vendors.filter((v) => v.status === "approved");
  const proposed = vendors.filter((v) => v.status === "proposed");
  const overdueReviews = vendors.filter(
    (v) =>
      v.review_due_at !== null &&
      v.review_due_at < today &&
      v.status !== "offboarded" &&
      v.status !== "rejected"
  );
  const expiredDocs = vendors
    .filter((v) => v.status !== "offboarded")
    .flatMap(docsOf)
    .filter((d) => docExpired(d, today));

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Vendor & sub-processor register"
        lead="The risk and review side of the vendor estate — data access, dependency, DPA state and review dates per third party. The public sub-processor register (packages/content legal) stays the client-facing publication with its 14-day change-notice machinery unchanged; seeded entries arrive proposed because the legal register marks them unverified, so approval here is a real review, not a data migration."
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
          <StatCard value={String(approved.length)} label="Approved vendors" />
          <StatCard
            value={String(proposed.length)}
            label="Proposed"
            sub={proposed.length ? "Each needs a Programme Owner approval review." : undefined}
          />
          <StatCard
            value={String(overdueReviews.length)}
            label="Reviews overdue"
            sub={overdueReviews.length ? "Past their review-due date." : undefined}
          />
          <StatCard
            value={String(expiredDocs.length)}
            label="Docs expired"
            sub={
              expiredDocs.length
                ? "Security documents past their expiry — request current ones."
                : undefined
            }
          />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// VENDOR REGISTER" pad={false}>
            {vendors.length === 0 ? (
              <EmptyRow>
                No vendors on the register yet — add the first third party below, or seed the
                register from the legal sub-processor list.
              </EmptyRow>
            ) : (
              <div className="flex flex-col">
                <HeaderRow
                  grid={GRID}
                  cols={[
                    "vendor",
                    "service",
                    "data access",
                    "dependency",
                    "status",
                    "owner",
                    "dpa",
                    "review",
                  ]}
                />
                {vendors.map((v, i) => {
                  const docs = docsOf(v);
                  const reviewPast =
                    v.review_due_at !== null &&
                    v.review_due_at < today &&
                    v.status !== "offboarded";
                  return (
                    <details key={v.id}>
                      <summary
                        className="grid md:grid gap-3 items-center px-4 py-2.5"
                        style={{
                          gridTemplateColumns: GRID,
                          borderTop: i ? "1px solid var(--k-border)" : "none",
                          cursor: "pointer",
                          listStyle: "none",
                        }}
                      >
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
                          title={v.name}
                        >
                          {v.name}
                        </span>
                        <span
                          className="min-w-0"
                          style={{
                            ...faintMono,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={v.service}
                        >
                          {v.service}
                        </span>
                        <span>
                          <StatusChip tone={dataAccessTone(v.data_access)}>
                            {v.data_access.replace(/_/g, " ")}
                          </StatusChip>
                        </span>
                        <span
                          style={{
                            ...faintMono,
                            color:
                              v.service_dependency === "critical" ||
                              v.service_dependency === "high"
                                ? T.warning
                                : "var(--k-muted)",
                          }}
                        >
                          {v.service_dependency ?? "—"}
                        </span>
                        <span>
                          <StatusChip tone={VENDOR_STATUS_TONE[v.status] ?? "muted"}>
                            {v.status.replace(/_/g, " ")}
                          </StatusChip>
                        </span>
                        {v.owner_email ? (
                          <span
                            className="min-w-0"
                            style={{ ...faintMono, overflow: "hidden", textOverflow: "ellipsis" }}
                            title={v.owner_email}
                          >
                            {v.owner_email}
                          </span>
                        ) : (
                          <span>
                            <StatusChip tone="warning">no owner</StatusChip>
                          </span>
                        )}
                        <span>
                          <StatusChip tone={dpaTone(v.dpa_status, v.data_access)}>
                            {v.dpa_status.replace(/_/g, " ")}
                          </StatusChip>
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span style={faintMono}>
                            {v.last_review_at ? shortDate(v.last_review_at) : "never reviewed"}
                          </span>
                          <span
                            style={{
                              ...faintMono,
                              color: reviewPast ? T.danger : "var(--k-faint)",
                            }}
                          >
                            due {v.review_due_at ? shortDate(v.review_due_at) : "—"}
                          </span>
                        </span>
                      </summary>

                      <div
                        className="grid md:grid-cols-2 gap-x-6 gap-y-3 px-4 py-4"
                        style={{
                          borderTop: "1px dashed var(--k-border)",
                          background: "var(--k-bg)",
                        }}
                      >
                        <Meta label="Transfer note (hosting / processing location + mechanism)">
                          {v.transfer_note || "—"}
                        </Meta>
                        <Meta label="Notes">{v.notes || "—"}</Meta>
                        <Meta label="Risk level">{v.risk_level ?? "—"}</Meta>
                        <Meta label="Contract">{v.contract_status.replace(/_/g, " ")}</Meta>
                        {v.subprocessor_id && (
                          <Meta label="Public sub-processor register id">
                            {v.subprocessor_id} — published client-facing entry; changes there
                            follow the 14-day notice process.
                          </Meta>
                        )}
                        {v.status === "approved" && (
                          <Meta label="Approved">
                            {v.approved_by ?? "—"} · {shortDate(v.approved_at)}
                          </Meta>
                        )}
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <span style={monoLabel}>Security documentation held (references only)</span>
                          {docs.length === 0 ? (
                            <span style={bodyText}>
                              None recorded — file where each document lives below, never its
                              contents.
                            </span>
                          ) : (
                            docs.map((d, di) => {
                              const expired = docExpired(d, today);
                              return (
                                <span
                                  key={di}
                                  className="flex flex-wrap items-center gap-2"
                                >
                                  <span
                                    style={{
                                      fontFamily: T.mono,
                                      fontSize: "10px",
                                      letterSpacing: "0.08em",
                                      textTransform: "uppercase",
                                      padding: "4px 8px",
                                      border: "1px solid var(--k-border)",
                                      color: "var(--k-muted)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {d.kind || "document"}
                                  </span>
                                  <span
                                    className="min-w-0"
                                    style={{
                                      ...bodyText,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                    title={d.reference ?? undefined}
                                  >
                                    {d.reference || "—"}
                                  </span>
                                  {d.expires_on ? (
                                    <StatusChip tone={expired ? "danger" : "muted"}>
                                      {expired ? "expired" : "expires"} {shortDate(d.expires_on)}
                                    </StatusChip>
                                  ) : (
                                    <StatusChip tone="muted">no expiry</StatusChip>
                                  )}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Update — ownership, classification, DPA/contract, review date */}
                      <form
                        action={updateVendor}
                        className="flex flex-wrap items-end gap-3 px-4 py-4"
                        style={{
                          borderTop: "1px dashed var(--k-border)",
                          background: "var(--k-bg)",
                        }}
                      >
                        <input type="hidden" name="id" value={v.id} />
                        <Field label="Owner email" grow>
                          <input
                            name="owner_email"
                            type="email"
                            style={inp}
                            defaultValue={v.owner_email ?? ""}
                            maxLength={200}
                          />
                        </Field>
                        <Field label="Data access">
                          <select name="data_access" style={inp} defaultValue={v.data_access}>
                            {DATA_ACCESS.map((d) => (
                              <option key={d} value={d}>
                                {d.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Dependency">
                          <select
                            name="service_dependency"
                            style={inp}
                            defaultValue={v.service_dependency ?? "medium"}
                          >
                            {LEVELS.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Risk level">
                          <select
                            name="risk_level"
                            style={inp}
                            defaultValue={v.risk_level ?? ""}
                          >
                            <option value="">—</option>
                            {LEVELS.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="DPA">
                          <select name="dpa_status" style={inp} defaultValue={v.dpa_status}>
                            {DPA_STATUSES.map((d) => (
                              <option key={d} value={d}>
                                {d.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Contract">
                          <select
                            name="contract_status"
                            style={inp}
                            defaultValue={v.contract_status}
                          >
                            {CONTRACT_STATUSES.map((c) => (
                              <option key={c} value={c}>
                                {c.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Review due">
                          <input
                            name="review_due_at"
                            type="date"
                            style={inp}
                            defaultValue={v.review_due_at ?? ""}
                          />
                        </Field>
                        <Field label="Transfer note" grow>
                          <textarea
                            name="transfer_note"
                            style={textarea}
                            maxLength={2000}
                            defaultValue={v.transfer_note ?? ""}
                            placeholder="Where they host/process and the transfer mechanism relied on."
                          />
                        </Field>
                        <Field label="Notes" grow>
                          <textarea
                            name="notes"
                            style={textarea}
                            maxLength={8000}
                            defaultValue={v.notes ?? ""}
                            placeholder="References only — never paste report contents or secrets."
                          />
                        </Field>
                        <SubmitButton style={primaryBtn}>Save changes</SubmitButton>
                      </form>

                      {/* File a security document reference */}
                      <form
                        action={addSecurityDoc}
                        className="flex flex-wrap items-end gap-3 px-4 py-4"
                        style={{
                          borderTop: "1px dashed var(--k-border)",
                          background: "var(--k-bg)",
                        }}
                      >
                        <input type="hidden" name="id" value={v.id} />
                        <Field label="Document kind">
                          <input
                            name="kind"
                            style={inp}
                            required
                            maxLength={60}
                            placeholder="soc2_report | iso27001 | security_page"
                          />
                        </Field>
                        <Field label="Filing reference or URL (never the document contents)" grow>
                          <input
                            name="reference"
                            style={inp}
                            required
                            maxLength={300}
                            placeholder="Where the document is filed, or its public URL"
                          />
                        </Field>
                        <Field label="Expires on">
                          <input name="expires_on" type="date" style={inp} />
                        </Field>
                        <SubmitButton style={primaryBtn}>File document</SubmitButton>
                      </form>

                      {/* Periodic review — evidence against VND-03 */}
                      {v.status !== "offboarded" && (
                        <form
                          action={recordReview}
                          className="flex flex-col gap-3 px-4 py-4"
                          style={{
                            borderTop: "1px dashed var(--k-border)",
                            background: "var(--k-bg)",
                          }}
                        >
                          <input type="hidden" name="id" value={v.id} />
                          <Field label="Review summary (appended to notes)" grow>
                            <textarea
                              name="review_summary"
                              style={textarea}
                              required
                              maxLength={4000}
                              placeholder="What was checked — security docs, DPA state, dependency, incidents — and the conclusion."
                            />
                          </Field>
                          <div className="flex flex-wrap items-end gap-3">
                            <Field label="Next review due">
                              <input name="review_due_at" type="date" style={inp} required />
                            </Field>
                            <SubmitButton style={primaryBtn}>Record review</SubmitButton>
                            <p style={faintMono}>
                              Sets last review to today and files an evidence item against
                              VND-03{controlKeys.has("VND-03")
                                ? "."
                                : " — control unseeded, so the evidence write is skipped until the control library is installed."}
                            </p>
                          </div>
                        </form>
                      )}

                      {/* Approve — Programme Owner only, a real review */}
                      {v.status !== "approved" && v.status !== "offboarded" && (
                        <form
                          action={approveVendor}
                          className="flex flex-col gap-3 px-4 py-4"
                          style={{
                            borderTop: "1px dashed var(--k-border)",
                            background: "var(--k-bg)",
                          }}
                        >
                          <input type="hidden" name="id" value={v.id} />
                          <Field label="Approval review note (appended to notes)" grow>
                            <textarea
                              name="review_note"
                              style={textarea}
                              required
                              maxLength={4000}
                              placeholder="What was actually reviewed before approving — this is the review, not a rubber stamp."
                            />
                          </Field>
                          <div className="flex flex-wrap items-center gap-3">
                            <input
                              name="confirm"
                              placeholder="type APPROVE"
                              autoComplete="off"
                              style={{ ...inp, fontFamily: T.mono, width: 140 }}
                            />
                            <SubmitButton style={primaryBtn}>Approve vendor</SubmitButton>
                            <p style={faintMono}>
                              Programme Owner only. Sets the next review due in 366 days and files
                              evidence against VND-02{controlKeys.has("VND-02")
                                ? "."
                                : " — control unseeded, so the evidence write is skipped until the control library is installed."}
                            </p>
                          </div>
                        </form>
                      )}

                      {/* Offboard */}
                      {v.status !== "offboarded" && (
                        <form
                          action={offboardVendor}
                          className="flex flex-wrap items-center gap-3 px-4 py-4"
                          style={{
                            borderTop: "1px dashed var(--k-border)",
                            background: "var(--k-bg)",
                          }}
                        >
                          <input type="hidden" name="id" value={v.id} />
                          <input
                            name="confirm"
                            placeholder="type OFFBOARD"
                            autoComplete="off"
                            style={{ ...inp, fontFamily: T.mono, width: 150 }}
                          />
                          <SubmitButton style={dangerBtn}>Offboard vendor</SubmitButton>
                          <p style={faintMono}>
                            Keeps the record and its history; removal from the public
                            sub-processor register is a separate legal-register change.
                          </p>
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

      {/* Add a vendor */}
      <Reveal delay={0.12}>
        <div style={{ marginTop: 18 }}>
          <Panel label="// ADD A VENDOR" title="New third party or sub-processor?">
            <form action={createVendor} className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <Field label="Name" grow>
                  <input name="name" style={inp} required maxLength={200} />
                </Field>
                <Field label="Service (what we use them for)" grow>
                  <input name="service" style={inp} required maxLength={300} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-3">
                <Field label="Data access">
                  <select name="data_access" style={inp} defaultValue="none">
                    {DATA_ACCESS.map((d) => (
                      <option key={d} value={d}>
                        {d.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Service dependency">
                  <select name="service_dependency" style={inp} defaultValue="medium">
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Owner email" grow>
                  <input name="owner_email" type="email" style={inp} maxLength={200} />
                </Field>
                <Field label="DPA status">
                  <select name="dpa_status" style={inp} defaultValue="unknown">
                    {DPA_STATUSES.map((d) => (
                      <option key={d} value={d}>
                        {d.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Contract status">
                  <select name="contract_status" style={inp} defaultValue="unknown">
                    {CONTRACT_STATUSES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Transfer note (hosting / processing location + transfer mechanism)">
                <textarea name="transfer_note" style={textarea} maxLength={2000} />
              </Field>
              <Field label="Notes (references only — never paste report contents or secrets)">
                <textarea name="notes" style={textarea} maxLength={8000} />
              </Field>
              <div>
                <SubmitButton style={primaryBtn}>Add as proposed</SubmitButton>
              </div>
              <p style={faintMono}>
                New vendors enter as proposed — approval is a Programme Owner review recorded
                above, with its evidence filed against the vendor-management controls.
              </p>
            </form>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
