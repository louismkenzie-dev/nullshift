import { revalidatePath } from "next/cache";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { sendEmail } from "@/lib/sendEmail";
import { esc, wrap } from "@/lib/emailLayout";
import { T } from "@nullshift/ui/tokens";
import { Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { legalConfig } from "@nullshift/content/legal/config";
import { SUBPROCESSOR_REGISTER } from "@nullshift/content/legal/subprocessors";

/**
 * Subprocessor change notices (spec §12).
 *
 * The rule the whole screen is built around: publishing to the public register
 * is not contractual notice. Notice is something sent to a named client, on a
 * date, at least 14 days before the change takes effect — so this screen sends
 * to every affected client and records each delivery, and the database refuses
 * to mark a change effective without them.
 */

const NOTICE_DAYS = 14;

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
  fontSize: "0.88rem",
  lineHeight: 1.65,
  color: "var(--k-muted)",
};
const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  color: "var(--k-fg)",
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "8px 10px",
  width: "100%",
};

const CHANGE_LABEL: Record<string, string> = {
  added: "New subprocessor",
  replaced: "Replaced",
  purpose_changed: "Purpose changed",
  location_changed: "Location changed",
  removed: "Removed",
};

async function proposeNotice(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;

  const providerId = String(formData.get("provider_id") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const impact = String(formData.get("client_impact") || "").trim();
  const changeType = String(formData.get("change_type") || "added");
  if (!providerId || !summary || !impact) return;

  const provider = SUBPROCESSOR_REGISTER.find((p) => p.id === providerId);

  // Default the effective date to the earliest lawful one. Staff can push it
  // out; the database will not let them pull it in.
  const effective = new Date();
  effective.setDate(effective.getDate() + NOTICE_DAYS + 1);

  const db = createServiceClient();
  const { data: created } = await db
    .from("subprocessor_notices")
    .insert({
      provider_id: providerId,
      provider_name: provider?.tradingName ?? provider?.legalName ?? providerId,
      change_type: changeType,
      summary,
      client_impact: impact,
      effective_from:
        String(formData.get("effective_from") || "") ||
        effective.toISOString().slice(0, 10),
      created_by: staff.userId,
    })
    .select("id, provider_name")
    .single();

  if (created)
    await logAudit({
      action: "subprocessor.change_proposed",
      target: `subprocessor_notice:${created.id}`,
      metadata: { provider: created.provider_name, changeType },
    });
  revalidatePath("/admin/compliance");
}

/**
 * Send direct notice to every affected client and record each delivery. A
 * client with no contact email is NOT silently skipped — it is left without a
 * delivery row, which is what stops the change being marked effective.
 */
async function sendNotice(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const db = createServiceClient();
  const { data: notice } = await db
    .from("subprocessor_notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!notice || notice.status !== "proposed") return;

  const { data: tenants } = await db
    .from("tenants")
    .select("id, name, contact_email")
    .eq("type", "client")
    .eq("status", "active");

  let delivered = 0;
  for (const t of tenants ?? []) {
    if (!t.contact_email) continue;
    const ok = await sendEmail({
      // A change to who processes their data, under a live agreement. Not
      // marketing, and not something they can unsubscribe from.
      purpose: "service_relationship",
      to: t.contact_email,
      subject: `Notice: a change to who processes your data (${notice.provider_name})`,
      html: wrap(
        `<tr><td style="padding:26px 32px">
          <h1 style="margin:0 0 12px;font-size:20px">A change to our subprocessors</h1>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6">${esc(notice.summary)}</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6"><strong>What this means for you:</strong> ${esc(notice.client_impact)}</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6">This takes effect on <strong>${esc(notice.effective_from)}</strong>. If you object, reply to this email before that date and we'll work it out with you.</p>
          <p style="margin:0;font-size:13px">The full register is at ${esc(legalConfig.routes.subprocessors)}.</p>
        </td></tr>`,
        "A change to our subprocessors"
      ),
      text: `A change to our subprocessors\n\n${notice.summary}\n\nWhat this means for you: ${notice.client_impact}\n\nEffective ${notice.effective_from}. If you object, reply before that date.`,
    });
    if (!ok) continue;

    await db.from("subprocessor_notice_deliveries").upsert(
      {
        notice_id: id,
        tenant_id: t.id,
        sent_to: t.contact_email,
        channel: "email",
      },
      { onConflict: "notice_id,tenant_id" }
    );
    delivered += 1;
  }

  if (delivered > 0)
    await db
      .from("subprocessor_notices")
      .update({ status: "notified", notified_at: new Date().toISOString() })
      .eq("id", id);

  await logAudit({
    action: "subprocessor.notice_sent",
    target: `subprocessor_notice:${id}`,
    metadata: { delivered, of: (tenants ?? []).length },
  });
  revalidatePath("/admin/compliance");
}

async function markEffective(formData: FormData) {
  "use server";
  const staff = await requireStaff();
  if (!staff.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const db = createServiceClient();
  // The trigger enforces notified_at, at least one delivery, and 14 clear
  // days. Its error is the authority — this only reports it.
  const { error } = await db
    .from("subprocessor_notices")
    .update({ status: "effective" })
    .eq("id", id);

  await logAudit({
    action: error ? "subprocessor.effective_blocked" : "subprocessor.effective",
    target: `subprocessor_notice:${id}`,
    metadata: error ? { reason: error.message } : undefined,
  });
  revalidatePath("/admin/compliance");
}

export async function SubprocessorNotices() {
  const db = createServiceClient();
  const [{ data: notices }, { data: deliveries }, { data: clientCount }] =
    await Promise.all([
      db
        .from("subprocessor_notices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12),
      db
        .from("subprocessor_notice_deliveries")
        .select("notice_id, tenant_id, objected_at"),
      db.from("tenants").select("id").eq("type", "client").eq("status", "active"),
    ]);

  const clients = (clientCount ?? []).length;
  const deliveredFor = (id: string) =>
    (deliveries ?? []).filter((d) => d.notice_id === id);

  return (
    <Panel label="// §12 SUBPROCESSORS" title="Change notices">
      <p style={body}>
        Publishing to the public register is not notice. Every affected client gets
        direct notice at least {NOTICE_DAYS} days before a change takes effect, each
        delivery is recorded, and the database refuses to mark a change effective
        without them.
      </p>

      <form action={proposeNotice} className="mt-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label>
            <span style={{ ...mono, display: "block", marginBottom: 6 }}>Provider</span>
            <select name="provider_id" style={{ ...inp, height: 36 }}>
              {SUBPROCESSOR_REGISTER.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tradingName ?? p.legalName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ ...mono, display: "block", marginBottom: 6 }}>Change</span>
            <select name="change_type" style={{ ...inp, height: 36 }}>
              {Object.entries(CHANGE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ ...mono, display: "block", marginBottom: 6 }}>
              Effective from
            </span>
            <input name="effective_from" type="date" style={inp} />
          </label>
        </div>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            What is changing
          </span>
          <input name="summary" required style={inp} />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>
            What it means for the client
          </span>
          <input
            name="client_impact"
            required
            placeholder="In their words, not ours"
            style={inp}
          />
        </label>
        <div>
          <SubmitButton className="kb kb-outline kb-sm" pendingLabel="Creating…">
            Propose change
          </SubmitButton>
        </div>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {(notices ?? []).map((n) => {
          const sent = deliveredFor(n.id);
          const objections = sent.filter((d) => d.objected_at).length;
          return (
            <div
              key={n.id}
              style={{ border: "1px solid var(--k-border)", padding: "14px 16px" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span style={{ ...mono, color: "var(--k-fg)" }}>
                  {n.provider_name} · {CHANGE_LABEL[n.change_type] ?? n.change_type}
                </span>
                <StatusChip
                  tone={
                    n.status === "effective"
                      ? "success"
                      : n.status === "notified"
                        ? "accent"
                        : "muted"
                  }
                >
                  {n.status}
                </StatusChip>
              </div>
              <p style={{ ...body, marginTop: 8, color: "var(--k-fg)" }}>{n.summary}</p>
              <p style={{ ...body, fontSize: "0.82rem", marginTop: 6 }}>
                Effective {n.effective_from} · notified {sent.length} of {clients}{" "}
                client{clients === 1 ? "" : "s"}
                {objections > 0 ? ` · ${objections} objection(s)` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {n.status === "proposed" && (
                  <form action={sendNotice}>
                    <input type="hidden" name="id" value={n.id} />
                    <SubmitButton className="kb kb-primary kb-sm" pendingLabel="Sending…">
                      Send direct notice
                    </SubmitButton>
                  </form>
                )}
                {n.status === "notified" && (
                  <form action={markEffective}>
                    <input type="hidden" name="id" value={n.id} />
                    <SubmitButton className="kb kb-outline kb-sm" pendingLabel="…">
                      Mark effective
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
        {(notices ?? []).length === 0 && (
          <p style={{ ...body, color: "var(--k-faint)" }}>
            No subprocessor changes proposed.
          </p>
        )}
      </div>
    </Panel>
  );
}
