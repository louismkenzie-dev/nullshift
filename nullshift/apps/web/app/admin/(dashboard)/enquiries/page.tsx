"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@nullshift/db/client";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";

type Enquiry = {
  id: string;
  created_at: string;
  source: string;
  name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  referral: string | null;
  status: string;
};

const STATUSES = ["new", "in_progress", "quoted", "won", "lost"];
// Emerald is the only brand colour; everything else maps to a signal tone.
type Tone = "accent" | "success" | "warning" | "danger" | "muted";
const statusTone: Record<string, Tone> = {
  new: "accent",
  in_progress: "warning",
  quoted: "muted",
  won: "success",
  lost: "danger",
};

export default function EnquiriesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Converted enquiries live on as clients — keep them out of the inbox.
    const { data } = await supabase
      .from("enquiries")
      .select("*")
      .neq("status", "converted")
      .order("created_at", { ascending: false });
    setRows((data as Enquiry[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    setRows((r) => r.map((e) => (e.id === id ? { ...e, status } : e)));
    await supabase.from("enquiries").update({ status }).eq("id", id);
  }

  async function convertToClient(e: Enquiry) {
    // Convert into the unified multi-tenant model: reuse the client tenant with
    // the same contact email, or create one (+ its build project), then open the
    // client hub. (The Pipeline does the same for funnel leads.)
    const email = (e.email || "").trim();
    let tenantId: string | null = null;

    if (email) {
      const { data: existing } = await supabase
        .from("tenants")
        .select("id")
        .eq("type", "client")
        .ilike("contact_email", email)
        .limit(1);
      tenantId = existing?.[0]?.id ?? null;
    }

    if (!tenantId) {
      const name = e.business_name || e.name;
      const { data: created } = await supabase
        .from("tenants")
        .insert({
          name,
          type: "client",
          contact_name: e.name,
          contact_email: email || null,
          contact_phone: e.phone,
          notes: `Converted from ${e.source} enquiry.`,
        })
        .select("id")
        .single();
      tenantId = created?.id ?? null;
      if (tenantId) {
        await supabase
          .from("projects")
          .insert({ tenant_id: tenantId, name: `${name} — build`, stage: "discovery" });
      }
    }

    // Mark the enquiry converted and open the client hub.
    await supabase.from("enquiries").update({ status: "converted" }).eq("id", e.id);
    setRows((r) => r.filter((x) => x.id !== e.id));
    setOpen(null);
    if (tenantId) router.push(`/admin/clients/${tenantId}`);
  }

  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <div>
      <PageHeader
        index="01"
        label="Inbox"
        title="Enquiries"
        actions={
          <span style={{ fontFamily: T.mono, fontSize: "11px", color: "var(--k-muted)" }}>
            {rows.length} total ·{" "}
            <span style={{ color: "var(--k-accent)" }}>{newCount} new</span>
          </span>
        }
        className="mb-8"
      />

      {loading ? (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
          }}
        >
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--k-muted)",
          }}
        >
          No enquiries yet.
        </p>
      ) : (
        <Reveal className="k-kard overflow-hidden">
          {/* mono uppercase column headers */}
          <div
            className="px-5 py-3 grid grid-cols-[90px_1fr_140px_120px] gap-4 items-center"
            style={{
              borderBottom: "1px solid var(--k-border)",
              fontFamily: T.mono,
              fontSize: "10px",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--k-faint)",
            }}
          >
            <span>Source</span>
            <span>Name</span>
            <span>Received</span>
            <span>Status</span>
          </div>
          {rows.map((e, i) => (
            <div
              key={e.id}
              style={{
                borderTop: i ? "1px solid var(--k-border)" : "none",
                background: "var(--k-surface)",
              }}
            >
              <button
                onClick={() => setOpen(open === e.id ? null : e.id)}
                className="w-full text-left px-5 py-4 grid grid-cols-[90px_1fr_140px_120px] gap-4 items-center transition-colors"
                style={{ background: "transparent" }}
                onMouseEnter={(ev) => {
                  ev.currentTarget.style.background = "var(--k-bg)";
                }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "10px",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--k-muted)",
                  }}
                >
                  {e.source}
                </span>
                <span>
                  <span
                    style={{
                      fontFamily: T.display,
                      fontWeight: 700,
                      fontSize: "1rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    {e.name}
                  </span>
                  {e.business_name && (
                    <span
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.85rem",
                        color: "var(--k-muted)",
                      }}
                    >
                      {" "}
                      · {e.business_name}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "10px",
                    color: "var(--k-muted)",
                  }}
                >
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
                <span className="justify-self-start">
                  <StatusChip tone={statusTone[e.status] ?? "muted"}>
                    {e.status === "new" && (
                      <span className="k-livedot" aria-hidden>
                        ●
                      </span>
                    )}
                    {e.status.replace("_", " ")}
                  </StatusChip>
                </span>
              </button>

              {open === e.id && (
                <div
                  className="px-5 pb-5 pt-1"
                  style={{
                    background: "var(--k-bg)",
                    borderTop: "1px solid var(--k-border)",
                  }}
                >
                  <div
                    className="grid md:grid-cols-2 gap-x-8 gap-y-2 mb-4 pt-4"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-muted)",
                    }}
                  >
                    <div>
                      <b style={{ color: "var(--k-fg)" }}>Email:</b>{" "}
                      <a href={`mailto:${e.email}`} style={{ color: "var(--k-accent)" }}>
                        {e.email}
                      </a>
                    </div>
                    {e.phone && (
                      <div>
                        <b style={{ color: "var(--k-fg)" }}>Phone:</b> {e.phone}
                      </div>
                    )}
                    {e.preferred_date && (
                      <div>
                        <b style={{ color: "var(--k-fg)" }}>Preferred:</b>{" "}
                        {e.preferred_date} {e.preferred_time}
                      </div>
                    )}
                    {e.referral && (
                      <div>
                        <b style={{ color: "var(--k-fg)" }}>Heard via:</b> {e.referral}
                      </div>
                    )}
                  </div>
                  {e.message && (
                    <p
                      className="mb-4"
                      style={{
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        lineHeight: 1.7,
                        color: "var(--k-fg)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {e.message}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "10px",
                        fontWeight: 500,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--k-faint)",
                        marginRight: "4px",
                      }}
                    >
                      Status:
                    </span>
                    {STATUSES.map((s) => {
                      const active = e.status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(e.id, s)}
                          className="px-3 py-1.5 transition-colors"
                          style={{
                            fontFamily: T.mono,
                            fontSize: "10px",
                            fontWeight: 500,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            borderRadius: 0,
                            background: active ? "var(--k-accent)" : "transparent",
                            color: active ? "var(--k-on-accent)" : "var(--k-muted)",
                            border: `1px solid ${
                              active ? "var(--k-accent)" : "var(--k-border)"
                            }`,
                            cursor: "pointer",
                          }}
                        >
                          {s.replace("_", " ")}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => convertToClient(e)}
                      className="kb kb-primary kb-sm ml-auto"
                    >
                      Convert to client
                      <span className="k-arrow" aria-hidden>
                        →
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Reveal>
      )}
    </div>
  );
}
