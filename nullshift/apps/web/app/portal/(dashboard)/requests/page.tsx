import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { T } from "@nullshift/ui/tokens";
import { carePlan } from "@/lib/carePlans";
import { classifyIssue } from "@/lib/ops/classify";
import {
  CLIENT_STATUS_LABEL,
  KIND_LABEL,
  OPEN_STATUSES,
  PORTAL_KINDS,
  STATUS_TONE,
  dueAtFor,
  type IssueKind,
  type IssueRow,
} from "@/lib/ops/issues";
import { sendEmail } from "@/lib/sendEmail";
import { wrap, button, esc, C, FONT } from "@/lib/emailLayout";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";
import { RequestForm } from "./RequestForm";

/**
 * Client portal — requests. The structured intake that replaces email threads:
 * every bug, change or question lands in the issues table, gets classified and
 * put in front of us straight away, and the client watches its honest status
 * here. RLS scopes everything to the client's own tenant (clients see only
 * their client_visible rows and can insert only the plain intake shape).
 */
export const dynamic = "force-dynamic";

type PortalIssue = Pick<
  IssueRow,
  "id" | "title" | "kind" | "status" | "created_at" | "due_at"
>;

const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

async function submitRequest(formData: FormData) {
  "use server";
  const kindRaw = String(formData.get("kind") || "");
  const kind = PORTAL_KINDS.find((k) => k.id === kindRaw)?.id as IssueKind | undefined;
  const title = String(formData.get("title") || "")
    .trim()
    .slice(0, 200);
  const description = String(formData.get("description") || "").trim();
  if (!kind || !title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Their membership → tenant (RLS lets them read their own row).
  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return;
  const tenantId = membership.tenant_id as string;

  // Attach to their newest project.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Optional screenshot → private issue-attachments bucket (member policy).
  const image_urls: string[] = [];
  const file = formData.get("screenshot");
  if (file instanceof File && file.size > 0) {
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "screenshot";
    const path = `${tenantId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from("issue-attachments")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type || undefined,
        upsert: false,
      });
    if (upErr) console.error("screenshot upload failed (non-fatal):", upErr.message);
    else image_urls.push(path);
  }

  // The exact shape the client INSERT policy allows: status=new,
  // billing stays 'unclassified', no price/batch fields.
  const { data: issue, error } = await supabase
    .from("issues")
    .insert({
      tenant_id: tenantId,
      project_id: project?.id ?? null,
      submitted_by: user.id,
      source: "portal",
      kind,
      title,
      description: description || null,
      image_urls,
      status: "new",
      client_visible: true,
    })
    .select("id")
    .single();
  if (error) {
    console.error("submitRequest failed:", error.message);
    return;
  }
  await logAudit({
    action: "issue.submitted",
    target: `issue:${issue.id}`,
    tenantId,
    metadata: { kind, source: "portal" },
  });

  // Best-effort enrichment — never let a triage/email hiccup fail the submit.
  try {
    const [{ data: sub }, { data: tenant }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan")
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
      supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle(),
    ]);
    const tenantName = (tenant?.name as string | undefined) ?? "Client";

    const c = await classifyIssue({
      title,
      description: description || null,
      systemName: (project?.name as string | undefined) ?? tenantName,
      plan: carePlan(sub?.plan as string | undefined),
    });
    if (c) {
      // Billing suggestion stays inside `ai` for the admin to confirm.
      const service = createServiceClient();
      await service
        .from("issues")
        .update({ ai: c, kind: c.kind, severity: c.severity, due_at: dueAtFor(c.severity) })
        .eq("id", issue.id);
    }

    const adminUrl = "https://nullshift.co.uk/admin/issues";
    const inner = `<tr><td style="padding:26px 32px 6px">
      <h1 style="margin:0 0 10px;font-family:${FONT};font-size:20px;font-weight:700;color:${C.fg}">New ${esc(KIND_LABEL[kind])} — ${esc(tenantName)}</h1>
      <p style="margin:0 0 6px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.fg}">${esc(title)}</p>
      <p style="margin:0 0 18px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.muted}">${esc(description || "(no further detail given)")}</p>
      <div style="padding:0 0 26px">${button(adminUrl, "Open the issue queue")}</div>
    </td></tr>`;
    await sendEmail({
      to: process.env.ENQUIRY_NOTIFY_EMAIL || "louis@nullshift.co.uk",
      subject: `[${tenantName}] New ${KIND_LABEL[kind]}: ${title}`,
      html: wrap(inner, `${tenantName} — ${title}`),
      text: `${tenantName} — new ${KIND_LABEL[kind].toLowerCase()}\n\n${title}\n\n${description || "(no further detail given)"}\n\n${adminUrl}`,
    });
  } catch (e) {
    console.error("issue enrichment failed (non-fatal):", e);
  }

  revalidatePath("/portal/requests");
  revalidatePath("/portal");
}

export default async function PortalRequestsPage() {
  const supabase = await createClient();
  const { data: issues } = await supabase
    .from("issues")
    .select("id, title, kind, status, created_at, due_at")
    .order("created_at", { ascending: false });
  const issueList = (issues ?? []) as PortalIssue[];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 56px" }}>
      <PageHeader
        index="02"
        label="REQUESTS"
        title="Requests"
        lead="Spotted something broken? Want something changed? Tell us here — it goes straight onto our board and you can watch its progress below."
      />

      <div style={{ margin: "24px 0 20px" }}>
        <Reveal>
          <Panel label="// NEW REQUEST" title="Tell us what you need">
            <RequestForm action={submitRequest} />
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel label="// YOUR REQUESTS">
          {issueList.length === 0 ? (
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              Nothing here yet — when you send us a request it&apos;ll appear here so
              you can follow along.
            </p>
          ) : (
            <div className="flex flex-col">
              {issueList.map((iss, i) => {
                const open = (OPEN_STATUSES as string[]).includes(iss.status);
                return (
                  <Reveal key={iss.id} delay={Math.min(i, 8) * 0.04}>
                    <div
                      className="flex flex-col gap-1.5"
                      style={{
                        padding: "12px 0",
                        borderTop: i ? "1px solid var(--k-border)" : "none",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          style={{
                            fontFamily: T.sans,
                            fontWeight: 600,
                            fontSize: "0.92rem",
                            color: "var(--k-fg)",
                            lineHeight: 1.4,
                          }}
                        >
                          {iss.title}
                        </span>
                        <StatusChip tone={STATUS_TONE[iss.status]}>
                          {CLIENT_STATUS_LABEL[iss.status]}
                        </StatusChip>
                      </div>
                      <div
                        className="flex items-center gap-3 flex-wrap"
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.62rem",
                          fontWeight: 500,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--k-faint)",
                        }}
                      >
                        <span>{KIND_LABEL[iss.kind]}</span>
                        <span>Sent {dateGB(iss.created_at)}</span>
                        {open && iss.due_at && (
                          <span style={{ color: "var(--k-accent)" }}>
                            Expected by {dateGB(iss.due_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
