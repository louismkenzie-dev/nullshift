import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import { requireTenantMember } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/Reveal";

/**
 * Client portal — the update feed. Progress notes from the team, newest first,
 * with any open decision pinned to the top as a card of one-tap options. RLS
 * lets members read their tenant's project_updates; the decision write goes
 * through the service client (clients have no UPDATE policy on these rows)
 * after an explicit membership check.
 */
export const dynamic = "force-dynamic";

type DecisionOption = { id: string; label: string; description?: string };
type UpdateRow = {
  id: string;
  tenant_id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
  image_urls: string[] | null;
  requires_action: boolean | null;
  action_resolved: boolean | null;
  options: DecisionOption[] | null;
  client_choice: string | null;
};

const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

async function decide(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const tenantId = String(formData.get("tenant_id") || "");
  const optionId = String(formData.get("option_id") || "");
  if (!id || !tenantId || !optionId) return;

  // Only members of this tenant (or staff) may decide.
  const guard = await requireTenantMember(tenantId);
  if (!guard.ok) return;

  // Clients have no UPDATE policy on project_updates — service client, but only
  // after checking the row really is an open decision offering this option.
  const service = createServiceClient();
  const { data: row } = await service
    .from("project_updates")
    .select("id, options, requires_action, action_resolved")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!row || !row.requires_action || row.action_resolved) return;
  const options = (row.options ?? []) as DecisionOption[];
  if (!options.some((o) => o.id === optionId)) return;

  const { error } = await service
    .from("project_updates")
    .update({ client_choice: optionId, action_resolved: true })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) {
    console.error("decide failed:", error.message);
    return;
  }
  await logAudit({
    action: "project_update.decided",
    target: `project_update:${id}`,
    tenantId,
    metadata: { choice: optionId },
  });
  revalidatePath("/portal/updates");
  revalidatePath("/portal");
}

export default async function PortalUpdatesPage() {
  const supabase = await createClient();
  const { data: updates } = await supabase
    .from("project_updates")
    .select(
      "id, tenant_id, created_at, type, title, body, image_urls, requires_action, action_resolved, options, client_choice"
    )
    .order("created_at", { ascending: false });
  const updateList = (updates ?? []) as UpdateRow[];

  const pendingDecisions = updateList.filter(
    (u) => u.requires_action === true && u.action_resolved !== true
  );
  const feed = updateList.filter(
    (u) => !(u.requires_action === true && u.action_resolved !== true)
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 56px" }}>
      <PageHeader
        index="03"
        label="UPDATES"
        title="Updates"
        lead="Progress notes from the team as we work on your system — and the odd decision we'd like you to make."
      />

      {/* Open decisions — pinned to the top */}
      {pendingDecisions.length > 0 && (
        <div className="flex flex-col gap-4" style={{ marginTop: 24 }}>
          {pendingDecisions.map((d, i) => (
            <Reveal key={d.id} delay={i * 0.05}>
              <Panel
                label="// DECISION NEEDED"
                title={d.title}
                style={{ borderColor: "rgba(245,213,71,0.45)" }}
              >
                {d.body && (
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.9rem",
                      color: "var(--k-muted)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      marginBottom: 14,
                    }}
                  >
                    {d.body}
                  </p>
                )}
                {(d.options ?? []).length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {(d.options ?? []).map((opt) => (
                      <form key={opt.id} action={decide}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="tenant_id" value={d.tenant_id} />
                        <input type="hidden" name="option_id" value={opt.id} />
                        <SubmitButton
                          className="flex flex-col gap-1 text-left w-full"
                          pendingLabel="Saving your choice…"
                          style={{
                            padding: "13px 14px",
                            background: "var(--k-bg)",
                            border: "1px solid var(--k-border)",
                            borderRadius: 0,
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: T.mono,
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--k-accent)",
                            }}
                          >
                            {opt.label}
                          </span>
                          {opt.description && (
                            <span
                              style={{
                                fontFamily: T.sans,
                                fontSize: "0.8rem",
                                lineHeight: 1.5,
                                color: "var(--k-muted)",
                              }}
                            >
                              {opt.description}
                            </span>
                          )}
                        </SubmitButton>
                      </form>
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
                    We need your input on this one — send us a request or reply on
                    your usual channel.
                  </p>
                )}
              </Panel>
            </Reveal>
          ))}
        </div>
      )}

      {/* The feed */}
      <div className="flex flex-col gap-4" style={{ marginTop: 24 }}>
        {feed.length === 0 && pendingDecisions.length === 0 ? (
          <Reveal>
            <p
              className="text-center py-7"
              style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
            >
              Updates will appear here as we work on your system.
            </p>
          </Reveal>
        ) : (
          feed.map((u, i) => {
            const chosen =
              u.client_choice != null
                ? ((u.options ?? []) as DecisionOption[]).find(
                    (o) => o.id === u.client_choice
                  )
                : null;
            const images = (u.image_urls ?? []).filter((url) =>
              url.startsWith("http")
            );
            return (
              <Reveal key={u.id} delay={Math.min(i, 8) * 0.04}>
                <div
                  className="k-kard"
                  style={{ background: "var(--k-surface)", padding: "16px 18px" }}
                >
                  <div
                    className="flex items-center justify-between gap-3"
                    style={{ marginBottom: u.body || images.length ? 8 : 0 }}
                  >
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {u.title}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.62rem",
                        letterSpacing: "0.06em",
                        color: "var(--k-faint)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dateGB(u.created_at)}
                    </span>
                  </div>
                  {u.body && (
                    <p
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.88rem",
                        color: "var(--k-muted)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {u.body}
                    </p>
                  )}
                  {images.length > 0 && (
                    <div
                      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
                      style={{ marginTop: 12 }}
                    >
                      {images.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt=""
                          style={{
                            width: "100%",
                            display: "block",
                            border: "1px solid var(--k-border)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {chosen && (
                    <div style={{ marginTop: 10 }}>
                      <StatusChip tone="success">You chose: {chosen.label}</StatusChip>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })
        )}
      </div>
    </div>
  );
}
