import { revalidatePath } from "next/cache";
import { createClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";

/**
 * Lead pipeline (CRM-lite) — a board over leads.status. Lead detail surfaces the
 * qualification signals (current software spend + biggest admin pain). Promoting
 * a won lead creates a client tenant + first project (the start of delivery).
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

async function promoteLead(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "Client").trim() || "Client";
  const vertical = String(formData.get("vertical") || "") || null;
  const supabase = await createClient();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({ name, type: "client", vertical })
    .select("id")
    .single();
  if (error || !tenant) {
    console.error("promote: tenant create failed", error?.message);
    return;
  }
  await supabase
    .from("projects")
    .insert({ tenant_id: tenant.id, name: `${name} — build`, stage: "discovery" });
  await supabase.from("leads").update({ status: "won" }).eq("id", id);
  await logAudit({
    action: "lead.promoted",
    target: `lead:${id}`,
    tenantId: tenant.id,
    metadata: { tenantName: name },
  });
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/delivery");
}

function Card({ lead }: { lead: Lead }) {
  const a = lead.quiz_answers?.answers ?? {};
  const spend = a.software_spend ? SPEND_LABEL[a.software_spend] : null;
  const pain = a.admin_pain ? PAIN_LABEL[a.admin_pain] : null;
  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: "11px 12px",
      }}
    >
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
      <div className="flex flex-wrap gap-1" style={{ marginTop: 10 }}>
        {lead.status !== "won" && (
          <form action={promoteLead}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="name" value={lead.name || "Client"} />
            <input type="hidden" name="vertical" value={lead.vertical || ""} />
            <button type="submit" style={miniBtn(T.primary, T.primaryFg)}>
              Promote → client
            </button>
          </form>
        )}
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
    .select("id, name, email, vertical, status, lead_score, quiz_answers")
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
        {leads.length} leads · qualified by cuttable software spend + admin pain.
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
