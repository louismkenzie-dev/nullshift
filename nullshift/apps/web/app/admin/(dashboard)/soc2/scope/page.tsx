import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { requireSoc2, WRITE_ROLES } from "@/lib/soc2/guard";
import { logSoc2Event } from "@/lib/soc2/events";
import { SCOPE_STATUS_TONE } from "@/lib/soc2/ui";
import { TSC_LABEL, type TscCategory } from "@/lib/soc2/types";
import {
  inp,
  textarea,
  actionBtn,
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
 * Scope of System — the versioned statement of what the readiness programme
 * actually covers: the service described, the Trust Services categories taken
 * on, and the itemised services, systems, environments, data categories,
 * people and third parties in scope — with exclusions recorded as first-class
 * entries, because an auditor reads what was left out before what was put in.
 * Readiness is only ever reported against an APPROVED scope version; a draft
 * is a proposal until the Programme Owner approves it, which supersedes the
 * previously approved version. Every material change here is written to the
 * domain trail.
 */

export const dynamic = "force-dynamic";

const PAGE = "/admin/soc2/scope";

type ScopeStatus = "draft" | "approved" | "superseded";

type ScopeRow = {
  id: string;
  version: number;
  service_description: string;
  tsc_categories: string[];
  rationale: string | null;
  status: ScopeStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

type ScopeItemRow = {
  id: string;
  scope_id: string;
  kind: ScopeItemKind;
  label: string;
  detail: string | null;
  asset_id: string | null;
  sort: number;
};

/** Render order — exclusions deliberately LAST, as their own closing section. */
const KIND_ORDER = [
  "service",
  "system",
  "environment",
  "repository",
  "cloud_account",
  "data_category",
  "people",
  "third_party",
  "exclusion",
] as const;
type ScopeItemKind = (typeof KIND_ORDER)[number];

const TSC_ALL: TscCategory[] = [
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
];
const TSC_OPTIONAL: TscCategory[] = [
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
];

const GRID = "1.3fr 2fr 96px";

// ── server actions ──────────────────────────────────────────────

async function createDraftScope(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;

  const serviceDescription = String(formData.get("service_description") || "").trim();
  const rationale = String(formData.get("rationale") || "").trim();
  if (!serviceDescription) return;

  // Security is always in scope: force-included server-side regardless of
  // what the (disabled) checkbox submitted.
  const requested = formData.getAll("tsc").map((v) => String(v));
  const categories = TSC_ALL.filter((c) => c === "security" || requested.includes(c));

  const db = createServiceClient();
  const { data: latest } = await db
    .from("soc2_scopes")
    .select("id, version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((latest?.version as number | undefined) ?? 0) + 1;

  const { data: created, error } = await db
    .from("soc2_scopes")
    .insert({
      version,
      service_description: serviceDescription,
      tsc_categories: categories as never,
      rationale: rationale || null,
      status: "draft",
      created_by: guard.email,
    })
    .select("id")
    .single();
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;

  // Carry the latest version's items forward so a new draft starts from the
  // current picture rather than an empty page.
  let copied = 0;
  let copyError: string | null = null;
  if (latest) {
    const { data: prevItems } = await db
      .from("soc2_scope_items")
      .select("kind, label, detail, asset_id, sort")
      .eq("scope_id", latest.id);
    if (prevItems && prevItems.length > 0) {
      const { error: insErr } = await db.from("soc2_scope_items").insert(
        prevItems.map((it) => ({
          scope_id: created.id,
          kind: it.kind,
          label: it.label,
          detail: it.detail,
          asset_id: it.asset_id,
          sort: it.sort,
        }))
      );
      if (insErr) copyError = insErr.message;
      else copied = prevItems.length;
    }
  }

  await logSoc2Event({
    recordType: "scope",
    recordId: created.id,
    type: "created",
    summary: `Scope v${version} drafted covering ${categories.join(", ")}${
      copied ? `; ${copied} item(s) carried forward from v${latest?.version}` : ""
    }.`,
    detail: { version, tsc_categories: categories, items_copied: copied },
    actor: guard.email,
  });
  revalidatePath(PAGE);
  if (copyError) redirect(`${PAGE}?err=${encodeURIComponent(copyError)}`);
}

async function addScopeItem(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const scopeId = String(formData.get("scope_id") || "").trim();
  const kind = String(formData.get("kind") || "").trim();
  const label = String(formData.get("label") || "").trim();
  const detail = String(formData.get("detail") || "").trim();
  if (!scopeId || !label || !(KIND_ORDER as readonly string[]).includes(kind)) return;

  const db = createServiceClient();
  const { data: scope } = await db
    .from("soc2_scopes")
    .select("id, version, status")
    .eq("id", scopeId)
    .maybeSingle();
  if (!scope || scope.status !== "draft") return;

  const { data: created, error } = await db
    .from("soc2_scope_items")
    .insert({ scope_id: scopeId, kind, label, detail: detail || null })
    .select("id")
    .single();
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);
  if (!created) return;

  await logSoc2Event({
    recordType: "scope",
    recordId: scopeId,
    type: "item.added",
    summary: `Scope v${scope.version}: ${kind.replace(/_/g, " ")} "${label}" added.`,
    detail: { item_id: created.id, kind, label },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function removeScopeItem(formData: FormData) {
  "use server";
  const guard = await requireSoc2(...WRITE_ROLES);
  if (!guard.ok) return;

  const itemId = String(formData.get("item_id") || "").trim();
  if (!itemId) return;

  const db = createServiceClient();
  const { data: item } = await db
    .from("soc2_scope_items")
    .select("id, scope_id, kind, label")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return;
  const { data: scope } = await db
    .from("soc2_scopes")
    .select("id, version, status")
    .eq("id", item.scope_id)
    .maybeSingle();
  // Silent guard: items are only removable while the scope is a draft.
  if (!scope || scope.status !== "draft") return;

  const { error } = await db.from("soc2_scope_items").delete().eq("id", itemId);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "scope",
    recordId: scope.id,
    type: "item.removed",
    summary: `Scope v${scope.version}: ${String(item.kind).replace(/_/g, " ")} "${item.label}" removed.`,
    detail: { item_id: itemId, kind: item.kind, label: item.label },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

async function approveScope(formData: FormData) {
  "use server";
  const guard = await requireSoc2("programme_owner");
  if (!guard.ok) return;

  const scopeId = String(formData.get("scope_id") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim();
  if (!scopeId || confirm !== "APPROVE") return;

  const db = createServiceClient();
  const { data: scope } = await db
    .from("soc2_scopes")
    .select("id, version, status")
    .eq("id", scopeId)
    .maybeSingle();
  if (!scope || scope.status !== "draft") return;

  // Exactly one approved scope at a time: whatever is approved now becomes
  // superseded before this version takes over.
  const { data: current } = await db
    .from("soc2_scopes")
    .select("id, version")
    .eq("status", "approved");
  const supersededVersions = (current ?? []).map((s) => s.version as number);
  if ((current ?? []).length > 0) {
    const { error: supErr } = await db
      .from("soc2_scopes")
      .update({ status: "superseded" })
      .eq("status", "approved");
    if (supErr) redirect(`${PAGE}?err=${encodeURIComponent(supErr.message)}`);
  }

  // The DB trigger refuses an approval without a named approver and time —
  // any refusal is surfaced, never swallowed.
  const { error } = await db
    .from("soc2_scopes")
    .update({
      status: "approved",
      approved_by: guard.email,
      approved_at: new Date().toISOString(),
    })
    .eq("id", scopeId);
  if (error) redirect(`${PAGE}?err=${encodeURIComponent(error.message)}`);

  await logSoc2Event({
    recordType: "scope",
    recordId: scopeId,
    type: "approved",
    summary: `Scope v${scope.version} approved; readiness now reports against it${
      supersededVersions.length
        ? ` (superseding v${supersededVersions.join(", v")})`
        : ""
    }.`,
    detail: { version: scope.version, superseded_versions: supersededVersions },
    actor: guard.email,
  });
  revalidatePath(PAGE);
}

// ── page ────────────────────────────────────────────────────────

export default async function ScopePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  const supabase = await createClient();
  const [{ data: scopeRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from("soc2_scopes")
      .select(
        "id, version, service_description, tsc_categories, rationale, status, created_by, approved_by, approved_at, created_at"
      )
      .order("version", { ascending: false }),
    supabase
      .from("soc2_scope_items")
      .select("id, scope_id, kind, label, detail, asset_id, sort")
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  const scopes = (scopeRows ?? []) as ScopeRow[];
  const items = (itemRows ?? []) as ScopeItemRow[];
  const hasApproved = scopes.some((s) => s.status === "approved");
  const nextVersion = (scopes[0]?.version ?? 0) + 1;

  return (
    <div>
      <PageHeader
        index="12"
        label="SOC 2"
        title="Scope of System"
        lead="Defines which services, systems, data and people readiness is reported against — and what is explicitly excluded, with reasons."
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

      {!hasApproved && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "11px",
            letterSpacing: "0.05em",
            color: T.warning,
            border: `1px solid ${T.warning}55`,
            padding: "10px 14px",
            marginTop: 20,
          }}
        >
          Readiness is reported against an approved scope — approve a version below.
        </p>
      )}

      <Reveal delay={0.05}>
        <Panel label="// DRAFT NEW SCOPE VERSION" style={{ marginTop: 28 }}>
          <form action={createDraftScope} className="flex flex-col gap-4">
            <Field label="Service description" grow>
              <textarea
                name="service_description"
                required
                style={textarea}
                placeholder="The service whose controls this scope covers, in plain English."
              />
            </Field>
            <div className="flex flex-col gap-1">
              <span style={monoLabel}>Trust Services categories</span>
              <div className="flex flex-wrap gap-x-5 gap-y-2" style={{ marginTop: 4 }}>
                <label className="flex items-center gap-2" style={bodyText}>
                  <input type="checkbox" defaultChecked disabled />
                  {TSC_LABEL.security} (always in scope)
                </label>
                {TSC_OPTIONAL.map((c) => (
                  <label key={c} className="flex items-center gap-2" style={bodyText}>
                    <input type="checkbox" name="tsc" value={c} />
                    {TSC_LABEL[c]}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Rationale" grow>
              <textarea
                name="rationale"
                style={textarea}
                placeholder="Why these categories — including any narrowed or excluded ones."
              />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton style={primaryBtn}>Draft scope v{nextVersion}</SubmitButton>
              <span style={faintMono}>
                Programme Owner only · items carry forward from the latest version
              </span>
            </div>
          </form>
        </Panel>
      </Reveal>

      <div className="flex flex-col gap-5" style={{ marginTop: 20 }}>
        {scopes.length === 0 && (
          <Reveal delay={0.1}>
            <Panel label="// SCOPE VERSIONS">
              <EmptyRow>
                No scope versions yet — draft the first one above to state what the
                programme covers.
              </EmptyRow>
            </Panel>
          </Reveal>
        )}

        {scopes.map((scope, si) => {
          const scopeItems = items.filter((it) => it.scope_id === scope.id);
          const kindsPresent = KIND_ORDER.filter((k) =>
            scopeItems.some((it) => it.kind === k)
          );
          const isDraft = scope.status === "draft";
          return (
            <Reveal key={scope.id} delay={0.1 + si * 0.05}>
              <Panel
                label={`// SCOPE v${scope.version}`}
                actions={
                  <StatusChip tone={SCOPE_STATUS_TONE[scope.status] ?? "muted"}>
                    {scope.status.replace(/_/g, " ")}
                  </StatusChip>
                }
              >
                <p style={{ ...bodyText, color: "var(--k-fg)", whiteSpace: "pre-wrap" }}>
                  {scope.service_description}
                </p>

                <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
                  {scope.tsc_categories.map((c) => (
                    <span
                      key={c}
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "4px 8px",
                        border:
                          c === "security"
                            ? "1px solid var(--k-accent)"
                            : "1px solid var(--k-border)",
                        color: c === "security" ? "var(--k-accent)" : "var(--k-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {TSC_LABEL[c as TscCategory] ?? c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>

                {scope.rationale && (
                  <div style={{ marginTop: 12 }}>
                    <span style={monoLabel}>Rationale</span>
                    <p style={{ ...bodyText, marginTop: 4, whiteSpace: "pre-wrap" }}>
                      {scope.rationale}
                    </p>
                  </div>
                )}

                <p style={{ ...faintMono, marginTop: 12 }}>
                  Drafted by {scope.created_by ?? "—"} · {shortDate(scope.created_at)}
                  {scope.status === "approved" && (
                    <>
                      {" "}
                      · Approved by {scope.approved_by ?? "—"} ·{" "}
                      {shortDate(scope.approved_at)}
                    </>
                  )}
                </p>

                <div style={{ border: "1px solid var(--k-border)", marginTop: 16 }}>
                  <HeaderRow grid={GRID} cols={["item", "detail", isDraft ? "remove" : ""]} />
                  {kindsPresent.map((kind, gi) => {
                    const group = scopeItems.filter((it) => it.kind === kind);
                    return (
                      <div key={kind}>
                        <div
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2"
                          style={{
                            borderTop: gi ? "1px solid var(--k-border)" : "none",
                            background: "var(--k-surface)",
                          }}
                        >
                          <span
                            style={{
                              ...monoLabel,
                              color: kind === "exclusion" ? T.warning : "var(--k-muted)",
                            }}
                          >
                            // {kind.replace(/_/g, " ")}
                          </span>
                          {kind === "exclusion" && (
                            <span style={faintMono}>
                              Exclusions are first-class — what was left out is read
                              before what was put in.
                            </span>
                          )}
                        </div>
                        {group.map((it) => (
                          <div
                            key={it.id}
                            className="grid md:grid gap-3 items-center px-4 py-2.5"
                            style={{
                              gridTemplateColumns: GRID,
                              borderTop: "1px solid var(--k-border)",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: T.sans,
                                fontSize: "0.85rem",
                                color: "var(--k-fg)",
                              }}
                            >
                              {it.label}
                            </span>
                            <span style={bodyText}>{it.detail || "—"}</span>
                            {isDraft ? (
                              <form action={removeScopeItem}>
                                <input type="hidden" name="item_id" value={it.id} />
                                <SubmitButton style={dangerBtn}>Remove</SubmitButton>
                              </form>
                            ) : (
                              <span style={faintMono}>
                                {it.asset_id ? "linked asset" : ""}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {scopeItems.length === 0 && (
                    <EmptyRow>
                      No items yet — add the services, systems, data categories and
                      exclusions this version covers.
                    </EmptyRow>
                  )}
                </div>

                {isDraft && (
                  <>
                    <form
                      action={addScopeItem}
                      className="flex flex-wrap items-end gap-3"
                      style={{ marginTop: 14 }}
                    >
                      <input type="hidden" name="scope_id" value={scope.id} />
                      <Field label="Kind">
                        <select name="kind" defaultValue="system" style={{ ...inp, width: 180 }}>
                          {KIND_ORDER.map((k) => (
                            <option key={k} value={k}>
                              {k.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Label" grow>
                        <input
                          name="label"
                          required
                          style={inp}
                          placeholder="e.g. Supabase (production)"
                        />
                      </Field>
                      <Field label="Detail" grow>
                        <input
                          name="detail"
                          style={inp}
                          placeholder="what it is — or, for an exclusion, why it is out"
                        />
                      </Field>
                      <SubmitButton style={actionBtn}>Add item</SubmitButton>
                    </form>

                    <div
                      style={{
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop: "1px solid var(--k-border)",
                      }}
                    >
                      <p style={bodyText}>
                        Approving this version supersedes the currently approved scope
                        and readiness reports against it from then on. Programme Owner
                        only.
                      </p>
                      <form
                        action={approveScope}
                        className="flex flex-wrap items-end gap-3"
                        style={{ marginTop: 10 }}
                      >
                        <input type="hidden" name="scope_id" value={scope.id} />
                        <Field label='Type "APPROVE" to confirm'>
                          <input
                            name="confirm"
                            placeholder="APPROVE"
                            autoComplete="off"
                            style={{ ...inp, width: 160 }}
                          />
                        </Field>
                        <SubmitButton style={primaryBtn}>
                          Approve scope v{scope.version}
                        </SubmitButton>
                      </form>
                    </div>
                  </>
                )}
              </Panel>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
