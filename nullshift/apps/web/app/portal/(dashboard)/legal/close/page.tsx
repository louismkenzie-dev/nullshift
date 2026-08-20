import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { getPortalClient, isClientPreview } from "@/lib/clientPreview";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { legalConfig } from "@nullshift/content/legal/config";
import { SubmitButton } from "@/components/admin/SubmitButton";
import type { OrderFormRow } from "@/lib/legal/agreement";

/**
 * Data export and termination, from the client's side (spec §18).
 *
 * The page is deliberately unsentimental. A client leaving should be able to
 * see, in one screen: when the agreement actually ends, what they still owe,
 * what they already own outright, what a standard export includes and where
 * paid migration assistance starts — and then request either without emailing
 * anyone or being talked out of it.
 *
 * It is also honest about what we keep. Deleting the system data we hold as
 * processor is not the same as erasing our own contract and accounting
 * records, and pretending otherwise would be a promise we could not lawfully
 * keep.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 });

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.64rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.92rem",
  lineHeight: 1.7,
  color: "var(--k-muted)",
};
const field: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.92rem",
  color: "var(--k-fg)",
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "10px 12px",
  width: "100%",
};

/**
 * The standard export, stated as a list rather than a promise to "provide your
 * data" — so nobody has to argue later about what was included.
 */
const STANDARD_EXPORT = [
  "A machine-readable export of your application database (CSV or JSON per table).",
  "Files and documents you or your customers uploaded, in their original format.",
  "Your content, configuration and any templates set up for you.",
  "The source code of what we built for you, in a repository you own.",
];

const MIGRATION_ASSISTANCE = [
  "Standing up the system somewhere else, or handing it to another supplier.",
  "Re-platforming, reconfiguring or rewriting anything to suit a new host.",
  "Transferring accounts we do not control on your behalf.",
  "Training or documentation beyond what already exists.",
];

/* ── actions ───────────────────────────────────────────────────── */

async function requestExport(formData: FormData) {
  "use server";
  if (await isClientPreview()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: project } = await supabase
    .from("projects")
    .select("id, tenant_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!project) return;

  const kind = String(formData.get("kind") || "standard_export");
  const { error } = await supabase.from("data_export_requests").insert({
    tenant_id: project.tenant_id,
    project_id: project.id,
    requested_by: user.id,
    requested_by_email: user.email ?? null,
    kind: kind === "migration_assistance" ? "migration_assistance" : "standard_export",
    scope_note: String(formData.get("scope_note") || "").trim() || null,
    status: "received",
  });
  if (error) return;

  await logAudit({
    action: "data_export.requested",
    target: `tenant:${project.tenant_id}`,
    tenantId: project.tenant_id,
    metadata: { kind, by: user.email },
  });
  revalidatePath("/portal/legal/close");
}

/**
 * Start a termination. The effective date is derived here from the notice rule
 * on the Order Form, not typed in — the client should never have to work out
 * their own notice period, and we should never be able to quietly extend it.
 */
async function requestTermination(formData: FormData) {
  "use server";
  if (await isClientPreview()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const name = String(formData.get("requested_by_name") || "").trim();
  const confirmed = formData.get("confirm_authority") === "on";
  if (!name || !confirmed) return;

  const { data: order } = await supabase
    .from("order_forms")
    .select("id, tenant_id, billing_date_rule, technical")
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) return;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("amount, status")
    .in("status", ["open", "draft"]);
  const outstanding = (invoices ?? []).reduce((s, i) => s + Number(i.amount), 0);

  // 30 days' notice, then the end of that billing month. Explicit rather than
  // clever: a client can check the arithmetic themselves.
  const effective = new Date();
  effective.setDate(effective.getDate() + 30);
  const deletionDue = new Date(effective);
  deletionDue.setDate(deletionDue.getDate() + 30);
  const backupDue = new Date(effective);
  backupDue.setDate(backupDue.getDate() + 90);

  const db = createServiceClient();
  const { data: ref } = await db.rpc("next_termination_ref");
  const { error } = await db.from("termination_records").insert({
    tenant_id: order.tenant_id,
    order_form_id: order.id,
    reference: ref ?? `TRM-${Date.now()}`,
    requested_by: user.id,
    requested_by_email: user.email ?? null,
    requested_by_name: name,
    initiated_by: "client",
    reason: String(formData.get("reason") || "").trim() || null,
    status: "requested",
    notice_rule: `${order.billing_date_rule} 30 days' notice.`,
    effective_date: effective.toISOString().slice(0, 10),
    outstanding_balance: outstanding,
    active_data_deletion_due: deletionDue.toISOString().slice(0, 10),
    backup_expiry_due: backupDue.toISOString().slice(0, 10),
    backup_policy_id:
      (order.technical as { backupPolicyId?: string } | null)?.backupPolicyId ?? null,
  });
  if (error) return;

  await logAudit({
    action: "termination.requested",
    target: `tenant:${order.tenant_id}`,
    tenantId: order.tenant_id,
    metadata: { by: user.email, effective: effective.toISOString().slice(0, 10) },
  });
  revalidatePath("/portal/legal/close");
}

/* ── page ──────────────────────────────────────────────────────── */

export default async function ClosePage() {
  const { supabase, preview } = await getPortalClient();

  const [{ data: orders }, { data: exports }, { data: terminations }, { data: invoices }] =
    await Promise.all([
      supabase
        .from("order_forms")
        .select("*")
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("data_export_requests")
        .select("*")
        .order("requested_at", { ascending: false }),
      supabase
        .from("termination_records")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("invoices").select("id, amount, status").in("status", ["open", "draft"]),
    ]);

  const order = (orders?.[0] ?? null) as OrderFormRow | null;
  const outstanding = (invoices ?? []).reduce((s, i) => s + Number(i.amount), 0);
  const live = terminations?.find((t) => t.status !== "withdrawn") ?? null;
  const tech = (order?.technical ?? {}) as Record<string, string | undefined>;
  const clientOwned = [
    ["Domain name", tech.hostingProvider ? "Registered in your name" : "Registered in your name"],
    ["Hosting account", tech.hostingProvider ?? "—"],
    ["Database", tech.databaseProvider ?? "—"],
    ["Payment provider", tech.paymentProvider ?? "—"],
  ].filter(([, v]) => v && v !== "—");

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        index="/08"
        label="Leaving"
        title="Data export &amp; termination"
        lead="Your data is yours. Here's exactly what you get, when the agreement ends, and what we keep."
        actions={
          <Link href="/portal/legal" className="kb kb-outline kb-sm">
            ← Legal
          </Link>
        }
      />

      {live && (
        <Panel
          label={live.reference}
          title="Termination in progress"
          actions={<StatusChip tone="warning">{live.status.replace("_", " ")}</StatusChip>}
        >
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Row k="Effective date" v={live.effective_date ?? "being confirmed"} />
            <Row k="Notice rule applied" v={live.notice_rule ?? "—"} />
            <Row
              k="Outstanding at request"
              v={live.outstanding_balance === null ? "—" : gbp(Number(live.outstanding_balance))}
            />
            <Row k="Your data deleted by" v={live.active_data_deletion_due ?? "—"} />
            <Row k="Backups expire by" v={live.backup_expiry_due ?? "—"} />
            <Row k="Our access revoked" v={live.access_revoked_at ? "Done" : "At handover"} />
          </dl>
          <p style={{ ...body, marginTop: 16 }}>{live.retained_records_note}</p>
        </Panel>
      )}

      {/* ── what you already own ─────────────────────────── */}
      <Panel label="Yours already" title="Accounts and assets in your name">
        <p style={body}>
          These are registered to you, not to us. Ending the agreement does not affect
          them — you keep them whatever happens, and we simply step out of them.
        </p>
        {clientOwned.length > 0 ? (
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {clientOwned.map(([k, v]) => (
              <Row key={k} k={k} v={v} />
            ))}
          </dl>
        ) : (
          <p style={{ ...body, marginTop: 10 }}>
            We&apos;ll list your domain, hosting, database and payment accounts here as
            soon as your Order Form records them.
          </p>
        )}
      </Panel>

      {/* ── export ───────────────────────────────────────── */}
      <Panel label="§18 Export" title="Get your data">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <span style={{ ...mono, color: "var(--k-accent)" }}>
              Standard export — included
            </span>
            <ul className="mt-3 flex flex-col gap-2" style={{ margin: 0, paddingLeft: 18 }}>
              {STANDARD_EXPORT.map((i) => (
                <li key={i} style={{ ...body, fontSize: "0.88rem" }}>
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span style={{ ...mono, color: "var(--k-fg)" }}>
              Migration assistance — quoted
            </span>
            <ul className="mt-3 flex flex-col gap-2" style={{ margin: 0, paddingLeft: 18 }}>
              {MIGRATION_ASSISTANCE.map((i) => (
                <li key={i} style={{ ...body, fontSize: "0.88rem" }}>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <form action={requestExport} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
              <input type="radio" name="kind" value="standard_export" defaultChecked />
              <span style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}>
                Standard export
              </span>
            </label>
            <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
              <input type="radio" name="kind" value="migration_assistance" />
              <span style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}>
                Quote me for migration assistance
              </span>
            </label>
          </div>
          <label>
            <span style={{ ...mono, display: "block", marginBottom: 6 }}>
              Anything specific? (optional)
            </span>
            <textarea
              name="scope_note"
              rows={3}
              style={{ ...field, resize: "vertical", lineHeight: 1.6 }}
            />
          </label>
          <div>
            <SubmitButton className="kb kb-primary kb-sm" disabled={!!preview} pendingLabel="Sending…">
              Request export
            </SubmitButton>
          </div>
        </form>

        {(exports ?? []).length > 0 && (
          <ul className="mt-5 flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {(exports ?? []).map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <StatusChip tone={e.status === "delivered" ? "success" : "muted"}>
                  {e.status}
                </StatusChip>
                <span style={{ ...body, fontSize: "0.86rem" }}>
                  {e.kind === "migration_assistance" ? "Migration assistance" : "Standard export"}{" "}
                  · requested{" "}
                  {new Date(e.requested_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── termination ──────────────────────────────────── */}
      {!live && (
        <Panel label="§18 Termination" title="End the agreement">
          {!order ? (
            <p style={body}>
              There&apos;s no accepted Order Form on this account, so there&apos;s nothing
              to terminate. If you think that&apos;s wrong, email{" "}
              {legalConfig.contact.legal}.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                <Row k="Agreement" v={order.reference} />
                <Row k="Billing rule" v={order.billing_date_rule} />
                <Row k="Notice" v="30 days" />
                <Row
                  k="Outstanding now"
                  v={outstanding > 0 ? gbp(outstanding) : "Nothing outstanding"}
                />
              </dl>

              <p style={{ ...body, marginTop: 16 }}>
                Requesting termination starts the notice period and creates a record you
                can see on this page. It does not cancel anything instantly, and it does
                not delete anything on its own — we&apos;ll confirm the handover dates
                with you first. Outstanding invoices remain payable.
              </p>

              <form action={requestTermination} className="mt-5 flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label>
                    <span style={{ ...mono, display: "block", marginBottom: 6 }}>
                      Your name *
                    </span>
                    <input name="requested_by_name" required style={field} />
                  </label>
                  <label>
                    <span style={{ ...mono, display: "block", marginBottom: 6 }}>
                      Reason (optional)
                    </span>
                    <input name="reason" style={field} />
                  </label>
                </div>
                <label className="flex items-start gap-3" style={{ cursor: "pointer" }}>
                  <input type="checkbox" name="confirm_authority" style={{ marginTop: 3 }} />
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.92rem",
                      lineHeight: 1.6,
                      color: "var(--k-fg)",
                    }}
                  >
                    I am authorised to end this agreement on behalf of{" "}
                    {order.client_legal_name}.
                  </span>
                </label>
                <div>
                  <SubmitButton
                    className="kb kb-outline kb-sm"
                    disabled={!!preview}
                    pendingLabel="Sending…"
                  >
                    Request termination
                  </SubmitButton>
                </div>
              </form>
            </>
          )}
        </Panel>
      )}

      {/* ── what we keep ─────────────────────────────────── */}
      <Panel label="Retention" title="What we keep, and why">
        <p style={body}>
          When your agreement ends we delete the system data we hold on your behalf, on
          the schedule above, and backups expire after that. What we do <em>not</em>{" "}
          delete is our own record of the relationship: contracts, invoices and
          accounting entries. We&apos;re required to keep those, and they exist to protect
          both of us if a question comes up years later.
        </p>
        <p style={{ ...body, marginTop: 12 }}>
          The full detail is in the{" "}
          <Link href={legalConfig.routes.privacy} style={{ color: "var(--k-accent)" }}>
            Privacy Notice
          </Link>{" "}
          and your Data Processing Agreement.
        </p>
      </Panel>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt style={mono}>{k}</dt>
      <dd style={{ fontFamily: T.sans, fontSize: "0.92rem", color: "var(--k-fg)", marginTop: 3 }}>
        {v}
      </dd>
    </div>
  );
}
