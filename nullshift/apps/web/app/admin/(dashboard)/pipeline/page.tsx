import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";

/**
 * Lead pipeline (CRM-lite) — a board over leads.status. Lead detail surfaces the
 * qualification signals (current software spend + biggest admin pain). Clicking a
 * card opens that lead's full client profile (booking, brief, quote, proposal,
 * portal account): it finds the matching client by email, or creates one from the
 * lead — carrying the business name + their own description across — then jumps to
 * /admin/clients/[id]. The client record (not a "legacy" table) is the core of the
 * relationship; the pipeline is just the front door to it.
 */

export const dynamic = "force-dynamic";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  vertical: string | null;
  status: string;
  lead_score: number | null;
  quiz_answers: { answers?: Record<string, string> } | null;
  plan: { businessName?: string | null } | null;
};

const COLUMNS = ["new", "qualified", "call_booked", "won", "lost"] as const;
const SPEND_LABEL: Record<string, string> = {
  under50: "<£50/mo",
  "50to150": "£50–150/mo",
  "150to400": "£150–400/mo",
  "400plus": "£400+/mo",
  unsure: "spend ?",
};
const PAIN_LABEL: Record<string, string> = {
  noshows: "no-shows",
  reminders: "reminders",
  tools: "too many tools",
  payments: "payments",
  records: "records",
  admin_overload: "admin overload",
  nothing: "exploring",
};
async function setStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !status) return;
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ status: status as never })
    .eq("id", id);
  await logAudit({ action: `lead.${status}`, target: `lead:${id}` });
  revalidatePath("/admin/pipeline");
}

/**
 * Open a lead as a client: reuse the existing client tenant if one already shares
 * the contact email, otherwise create a tenant (+ its build project) from the lead —
 * carrying the business name, contact and their description across. Then redirect to
 * the unified client hub.
 */
async function openLead(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, vertical, quiz_answers, plan")
    .eq("id", id)
    .maybeSingle();
  if (!lead) return;

  const email = (lead.email || "").trim();
  let tenantId: string | null = null;

  // 1) Reuse an existing client tenant with the same contact email.
  if (email) {
    const { data: existing } = await supabase
      .from("tenants")
      .select("id")
      .eq("type", "client")
      .ilike("contact_email", email)
      .limit(1);
    tenantId = existing?.[0]?.id ?? null;
  }

  // 2) Otherwise create the tenant + its build project from the lead.
  if (!tenantId) {
    const answers =
      (lead.quiz_answers as { answers?: Record<string, string> } | null)?.answers ?? {};
    const describe = answers.describe?.trim();
    const businessName =
      (lead.plan as { businessName?: string | null } | null)?.businessName ?? null;
    const name = businessName || lead.name || "Client";
    const notes =
      `Converted from ${lead.vertical ? `${lead.vertical} ` : ""}funnel lead.` +
      (describe ? `\n\nIn their words:\n"${describe}"` : "");

    const { data: created } = await supabase
      .from("tenants")
      .insert({
        name,
        type: "client",
        vertical: lead.vertical,
        contact_name: lead.name,
        contact_email: email || null,
        notes,
      })
      .select("id")
      .single();
    tenantId = created?.id ?? null;

    if (tenantId) {
      await supabase
        .from("projects")
        .insert({ tenant_id: tenantId, name: `${name} — build`, stage: "discovery" });
      await logAudit({
        action: "lead.opened_as_client",
        target: `lead:${id}`,
        tenantId,
        metadata: { name },
      });
    }
  }

  if (tenantId) redirect(`/admin/clients/${tenantId}`);
}

function Card({ lead }: { lead: Lead }) {
  const a = lead.quiz_answers?.answers ?? {};
  const spend = a.software_spend ? SPEND_LABEL[a.software_spend] : null;
  const pain = a.admin_pain ? PAIN_LABEL[a.admin_pain] : null;
  const describe = a.describe?.trim();
  const business = lead.plan?.businessName?.trim();
  return (
    <div
      style={{
        position: "relative",
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "11px 12px",
      }}
    >
      {/* Stretched overlay button — clicking anywhere on the card opens the
          client profile. Sits behind the "Lost" control (which is z-indexed
          above) so that stays independently clickable. */}
      <form action={openLead}>
        <input type="hidden" name="id" value={lead.id} />
        <button
          type="submit"
          aria-label={`Open ${lead.name || "lead"}'s client profile`}
          title="Open client profile →"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            zIndex: 1,
          }}
        />
      </form>

      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: T.sans,
            fontWeight: 600,
            fontSize: "0.85rem",
            color: T.fg,
          }}
        >
          {lead.name || "—"}
        </span>
        {lead.lead_score != null && (
          <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.primary }}>
            {lead.lead_score}
          </span>
        )}
      </div>
      {business && (
        <div style={{ fontFamily: T.sans, fontSize: "11px", color: T.fg, marginTop: 1 }}>
          {business}
        </div>
      )}
      {lead.email && (
        <div
          style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted, marginTop: 2 }}
        >
          {lead.email}
        </div>
      )}
      <div className="flex flex-wrap gap-1" style={{ marginTop: 8 }}>
        {lead.vertical && <Tag>{lead.vertical}</Tag>}
        {spend && <Tag tone={T.warning}>{spend}</Tag>}
        {pain && <Tag>{pain}</Tag>}
      </div>
      {describe && (
        <p
          title={describe}
          style={{
            fontFamily: T.sans,
            fontSize: "11px",
            lineHeight: 1.45,
            color: T.muted,
            fontStyle: "italic",
            marginTop: 8,
            borderLeft: `2px solid ${T.border}`,
            paddingLeft: 8,
          }}
        >
          &ldquo;{describe}&rdquo;
        </p>
      )}
      <div
        className="flex items-center justify-between"
        style={{ marginTop: 10, position: "relative", zIndex: 2 }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "9px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: T.primary,
            pointerEvents: "none",
          }}
        >
          Open profile →
        </span>
        {lead.status !== "lost" && (
          <form action={setStatus}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="status" value="lost" />
            <button type="submit" style={miniBtn("transparent", T.muted)}>
              Lost
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Tag({ children, tone = T.muted }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: "9px",
        letterSpacing: "0.04em",
        color: tone,
        background: `${tone}14`,
        border: `1px solid ${tone}33`,
        borderRadius: 999,
        padding: "1px 7px",
        position: "relative",
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      {children}
    </span>
  );
}

const miniBtn = (bg: string, fg: string) => ({
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  height: 26,
  paddingInline: 9,
  background: bg,
  color: fg,
  border: bg === "transparent" ? `1px solid ${T.border}` : "none",
  borderRadius: 5,
  cursor: "pointer",
});

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, email, vertical, status, lead_score, quiz_answers, plan")
    .order("lead_score", { ascending: false, nullsFirst: false });
  const leads = (data ?? []) as Lead[];

  return (
    <div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
          marginBottom: 8,
        }}
      >
        // Pipeline
      </div>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.9rem",
          color: T.fg,
          marginBottom: 4,
        }}
      >
        Lead pipeline
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          marginBottom: 24,
        }}
      >
        {leads.length} leads · click any card to open their client profile (booking,
        brief, quote &amp; proposal).
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {COLUMNS.map((col) => {
          const items = leads.filter((l) => l.status === col);
          return (
            <div
              key={col}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
                padding: 12,
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 10 }}
              >
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: T.muted,
                  }}
                >
                  {col.replace(/_/g, " ")}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.faint }}>
                  {items.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((l) => (
                  <Card key={l.id} lead={l} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
