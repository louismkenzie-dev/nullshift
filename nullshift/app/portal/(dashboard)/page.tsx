import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";
import { T } from "@/lib/tokens";
import Link from "next/link";
import { ChoiceCard } from "./ChoiceCard";

// ── Types ─────────────────────────────────────────────────────────────────────
type Option = { id: string; label: string; description?: string; image_url?: string };
type ProjectUpdate = {
  id: string;
  created_at: string;
  type: "update" | "decision" | "branding";
  title: string;
  body: string | null;
  image_urls: string[];
  requires_action: boolean;
  action_resolved: boolean;
  options: Option[];
  client_choice: string | null;
};
type Proposal = {
  id: string; status: string; project_name: string | null; title: string;
  summary: string | null; total: number; currency: string;
  line_items: Array<{ label: string; qty: number; unit_price: number }>;
  accepted_at: string | null; accepted_name: string | null;
};
type BrandGuideline = {
  brand_name: string | null; tagline: string | null; mission: string | null;
  colours: Array<{ name: string; hex: string; role: string }>;
  typography: Array<{ role: string; font: string; weights: string; usage: string }>;
  voice: string | null;
  dos_donts: { dos: string[]; donts: string[] };
};

// ── Phase metadata ─────────────────────────────────────────────────────────
const PHASES = [
  { key: "discovery",   label: "Discovery" },
  { key: "design",      label: "Design" },
  { key: "development", label: "Development" },
  { key: "review",      label: "Review" },
  { key: "live",        label: "Live ✓" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function money(n: number, currency = "GBP") {
  return `${currency === "GBP" ? "£" : currency}${n.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;
}
function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHead({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", boxShadow: `0 0 0 3px ${T.primarySoft}`, flexShrink: 0 }} />
        <span style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ background: T.surface, border: `1px dashed ${T.border}`, borderRadius: T.r.md, padding: "20px 24px" }}>
      <p style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.faint }}>{message}</p>
    </div>
  );
}

// Update card for non-interactive updates
function UpdateCard({ update }: { update: ProjectUpdate }) {
  const TYPE_COLOUR: Record<string, string> = {
    update:   T.primary,
    decision: T.warning,
    branding: "#818cf8",
  };
  const colour = TYPE_COLOUR[update.type] ?? T.primary;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.r.md,
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: update.body || update.image_urls?.length ? 10 : 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <span style={{
            fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
            color: colour, background: `${colour}18`, padding: "2px 8px",
            borderRadius: T.r.full, display: "inline-block", alignSelf: "flex-start",
          }}>
            Update
          </span>
          <h4 style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em", color: T.fg, margin: 0 }}>
            {update.title}
          </h4>
        </div>
        <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.faint, flexShrink: 0, paddingTop: 2 }}>
          {relativeDate(update.created_at)}
        </span>
      </div>

      {update.body && (
        <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.65, color: T.muted, margin: "0 0 12px" }}>
          {update.body}
        </p>
      )}

      {update.image_urls?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {update.image_urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url} alt=""
                style={{ width: 120, height: 90, objectFit: "cover", borderRadius: T.r.sm, border: `1px solid ${T.border}`, display: "block" }}
              />
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: "9px", color: T.faint }}>
        {new Date(update.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
  );
}

// Brief display from brief_data JSON
function BriefSection({ brief }: { brief: Record<string, unknown> }) {
  const sections: Array<{ label: string; key: string }> = [
    { label: "Project type",         key: "projectType" },
    { label: "Goals",                key: "goals" },
    { label: "Target audience",      key: "targetAudience" },
    { label: "Design style",         key: "designStyle" },
    { label: "Competitors",          key: "competitors" },
    { label: "Budget",               key: "budget" },
    { label: "Timeline",             key: "timeline" },
    { label: "Pages / features",     key: "pages" },
    { label: "Additional notes",     key: "notes" },
  ];

  const filled = sections.filter(s => {
    const v = brief[s.key];
    return v && (Array.isArray(v) ? v.length > 0 : String(v).trim());
  });

  if (!filled.length) return (
    <p style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.faint }}>Brief submitted — details will appear here.</p>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {filled.map(s => {
        const val = brief[s.key];
        const text = Array.isArray(val) ? val.join(", ") : String(val);
        return (
          <div key={s.key} style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
            <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>
              {s.label}
            </div>
            <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.6, color: T.fg, margin: 0 }}>{text}</p>
          </div>
        );
      })}
    </div>
  );
}

// Proposal / quote section
function ProposalSection({ proposal }: { proposal: Proposal }) {
  const statusColour: Record<string, string> = {
    draft:    T.faint,
    sent:     "#facc15",
    accepted: T.primary,
    declined: T.danger,
  };
  const status = proposal.status ?? "draft";
  const colour = statusColour[status] ?? T.muted;
  const regular  = (proposal.line_items ?? []).filter(li => (li.unit_price ?? 0) >= 0);
  const discount = (proposal.line_items ?? []).find(li => (li.unit_price ?? 0) < 0);
  const subtotal = regular.reduce((s, li) => s + (li.qty ?? 0) * (li.unit_price ?? 0), 0);
  const discountAmt = discount ? subtotal * (Math.abs(discount.unit_price) / 100) : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.01em", color: T.fg, margin: "0 0 4px" }}>
            {proposal.project_name || proposal.title}
          </h3>
          {proposal.summary && (
            <p style={{ fontFamily: T.sans, fontSize: "0.875rem", lineHeight: 1.6, color: T.muted, margin: 0, maxWidth: "52ch" }}>
              {proposal.summary}
            </p>
          )}
        </div>
        <span style={{
          fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase",
          color: colour, background: `${colour}18`, padding: "4px 10px", borderRadius: T.r.full,
          flexShrink: 0,
        }}>
          {status === "accepted" ? "Accepted ✓" : status}
        </span>
      </div>

      {/* Line items */}
      {regular.length > 0 && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r.md, overflow: "hidden", marginBottom: 16 }}>
          {regular.map((li, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < regular.length - 1 ? `1px solid ${T.border}` : "none" }}
            >
              <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.fg }}>{li.label}</span>
              <span style={{ fontFamily: T.mono, fontSize: "0.875rem", color: T.muted, flexShrink: 0 }}>
                {money((li.qty ?? 0) * (li.unit_price ?? 0), proposal.currency)}
              </span>
            </div>
          ))}
          {discount && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: T.elevated, borderTop: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: T.mono, fontSize: "0.8rem", color: T.muted }}>Subtotal</span>
                <span style={{ fontFamily: T.mono, fontSize: "0.8rem", color: T.muted }}>{money(subtotal, proposal.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: T.elevated, borderTop: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.warning }}>{discount.label || "Discount"} (−{Math.abs(discount.unit_price)}%)</span>
                <span style={{ fontFamily: T.mono, fontSize: "0.875rem", color: T.warning }}>−{money(discountAmt, proposal.currency)}</span>
              </div>
            </>
          )}
          {/* Total */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px", background: T.elevated, borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9rem", color: T.fg }}>Total investment</span>
            <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.25rem", color: T.primary }}>
              {money(proposal.total ?? 0, proposal.currency)}
            </span>
          </div>
        </div>
      )}

      {/* View link */}
      {status !== "draft" && (
        <Link
          href={`/proposal/${proposal.id}`}
          target="_blank"
          style={{ fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, color: T.primary, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          View full proposal ↗
        </Link>
      )}
    </div>
  );
}

// Brand guidelines display
function BrandSection({ brand }: { brand: BrandGuideline }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {brand.brand_name && (
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>Brand name</div>
          <p style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.5rem", letterSpacing: "-0.02em", color: T.fg, margin: 0 }}>{brand.brand_name}</p>
          {brand.tagline && <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted, margin: "6px 0 0" }}>{brand.tagline}</p>}
        </div>
      )}
      {brand.mission && (
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 6 }}>Mission</div>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.7, color: T.muted, margin: 0 }}>{brand.mission}</p>
        </div>
      )}
      {brand.colours?.length > 0 && (
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Colours</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {brand.colours.map((c, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: T.r.md, background: c.hex, border: `1px solid ${T.borderStr}`, marginBottom: 6 }} />
                <div style={{ fontFamily: T.mono, fontSize: "9px", color: T.fg }}>{c.name}</div>
                <div style={{ fontFamily: T.mono, fontSize: "9px", color: T.muted }}>{c.hex}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {brand.typography?.length > 0 && (
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Typography</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {brand.typography.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.primary, minWidth: 80, textTransform: "uppercase" }}>{t.role}</span>
                <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.fg }}>{t.font}</span>
                <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>{t.weights}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {brand.voice && (
        <div>
          <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 6 }}>Brand voice</div>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.7, color: T.muted, margin: 0 }}>{brand.voice}</p>
        </div>
      )}
    </div>
  );
}

function SetupMessage() {
  return (
    <div style={{ padding: 40 }}>
      <p style={{ fontFamily: T.sans, color: T.muted }}>Portal unavailable — Supabase not configured.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default async function PortalDashboard() {
  if (!hasSupabaseBrowserConfig()) return <SetupMessage />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return <SetupMessage />;

  const service = createServiceClient();

  // Client record
  const { data: client } = await service
    .from("clients")
    .select("id, name, business_name, email, status, project_phase, created_at")
    .eq("email", user.email)
    .maybeSingle();

  // Project updates
  const { data: updatesRaw } = client
    ? await service
        .from("project_updates")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const updates = (updatesRaw ?? []) as ProjectUpdate[];

  // Proposal (latest)
  const { data: proposal } = client
    ? await service
        .from("proposals")
        .select("id, title, project_name, summary, status, total, currency, line_items, accepted_at, accepted_name")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Brief
  const { data: briefRow } = client
    ? await service
        .from("enquiries")
        .select("id, created_at, brief_data")
        .eq("client_id", client.id)
        .eq("source", "brief")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Brand guidelines
  const { data: brand } = client
    ? await service
        .from("brand_guidelines")
        .select("brand_name, tagline, mission, colours, typography, voice, dos_donts")
        .eq("client_id", client.id)
        .maybeSingle()
    : { data: null };

  const displayName  = client?.name ?? user.email.split("@")[0];
  const currentPhase = client?.project_phase ?? null;
  const phaseIndex   = PHASES.findIndex(p => p.key === currentPhase);

  // Split updates into action-required vs. informational
  const actionItems = updates.filter(u => u.requires_action && !u.action_resolved && (u.type === "decision" || u.type === "branding"));
  const feedUpdates = updates.filter(u => !(u.requires_action && !u.action_resolved && (u.type === "decision" || u.type === "branding")));

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "40px 24px", maxWidth: 860, margin: "0 auto" }}>

      {/* ── Welcome header ──────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 3px ${T.primarySoft}`, display: "inline-block" }} />
          <span style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
            Client portal
          </span>
        </div>
        <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.03em", lineHeight: 1.04, color: T.fg, margin: "0 0 6px" }}>
          Welcome back, {displayName}.
        </h1>
        {client?.business_name && (
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted, margin: 0 }}>{client.business_name}</p>
        )}
      </div>

      {!client ? (
        /* No client record yet */
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.lg, padding: 32, maxWidth: 480 }}>
          <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.primary, marginBottom: 12 }}>
            Account pending
          </p>
          <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.65, color: T.muted, margin: "0 0 20px" }}>
            Your account is set up and your project will appear here once it&apos;s been activated by our team. If you have any questions in the meantime, get in touch.
          </p>
          <Link href="/contact" style={{ fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500, color: T.primary, textDecoration: "none" }}>
            Contact us →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

          {/* ── Project status & phase ─────────────────────────── */}
          <section>
            <div
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.r.lg,
                padding: "24px 28px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Subtle glow behind phase */}
              {currentPhase && (
                <div style={{ position: "absolute", top: 0, right: 0, width: "40%", height: "100%", background: `radial-gradient(ellipse 80% 80% at 100% 50%, ${T.primary}10, transparent)`, pointerEvents: "none" }} />
              )}

              <div style={{ position: "relative" }}>
                {/* Phase label */}
                <div style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: 6 }}>
                  Project status
                </div>

                {currentPhase ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 3px ${T.primarySoft}`, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.5rem", letterSpacing: "-0.02em", color: T.fg }}>
                        {PHASES.find(p => p.key === currentPhase)?.label ?? currentPhase}
                      </span>
                    </div>

                    {/* Phase stepper */}
                    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      {PHASES.map((phase, i) => {
                        const isActive   = i === phaseIndex;
                        const isComplete = i < phaseIndex;
                        return (
                          <div key={phase.key} style={{ display: "flex", alignItems: "center", flex: i < PHASES.length - 1 ? 1 : 0, minWidth: 0 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <div style={{
                                width: isActive ? 14 : 10,
                                height: isActive ? 14 : 10,
                                borderRadius: "50%",
                                background: isActive ? T.primary : isComplete ? `${T.primary}60` : T.border,
                                boxShadow: isActive ? `0 0 0 4px ${T.primarySoft}` : "none",
                                transition: "all 0.2s",
                              }} />
                              <span style={{ fontFamily: T.mono, fontSize: "8px", letterSpacing: "0.06em", textTransform: "uppercase", color: isActive ? T.primary : isComplete ? T.muted : T.faint, whiteSpace: "nowrap" }}>
                                {phase.label}
                              </span>
                            </div>
                            {i < PHASES.length - 1 && (
                              <div style={{ flex: 1, height: 1, background: i < phaseIndex ? `${T.primary}60` : T.border, margin: "0 4px", marginBottom: 18 }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted, margin: "6px 0 0" }}>
                    Your project hasn&apos;t kicked off yet — we&apos;ll update this as soon as it begins.
                  </p>
                )}

                {/* Latest update preview */}
                {updates.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                    <span style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>
                      Latest —{" "}
                    </span>
                    <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>
                      {updates[0].title}
                    </span>
                    <span style={{ fontFamily: T.mono, fontSize: "9px", color: T.faint, marginLeft: 8 }}>
                      {relativeDate(updates[0].created_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Action items ──────────────────────────────────── */}
          {actionItems.length > 0 && (
            <section>
              <SectionHead label={`Action required — ${actionItems.length} item${actionItems.length > 1 ? "s" : ""}`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {actionItems.map(u => (
                  <ChoiceCard
                    key={u.id}
                    updateId={u.id}
                    type={u.type as "decision" | "branding"}
                    title={u.title}
                    body={u.body}
                    options={u.options ?? []}
                    currentChoice={u.client_choice}
                    resolved={u.action_resolved}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Project updates feed ──────────────────────────── */}
          <section>
            <SectionHead label="Project updates" />
            {feedUpdates.length === 0 ? (
              <EmptyState message="Updates from our team will appear here as your project progresses." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {feedUpdates.map(u =>
                  (u.type === "decision" || u.type === "branding") ? (
                    <ChoiceCard
                      key={u.id}
                      updateId={u.id}
                      type={u.type}
                      title={u.title}
                      body={u.body}
                      options={u.options ?? []}
                      currentChoice={u.client_choice}
                      resolved={u.action_resolved}
                    />
                  ) : (
                    <UpdateCard key={u.id} update={u} />
                  )
                )}
              </div>
            )}
          </section>

          {/* ── Two-column lower sections ─────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>

            {/* Brief */}
            <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.lg, padding: "24px 28px" }}>
              <SectionHead label="Your brief">
                {briefRow?.created_at && (
                  <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.faint }}>
                    Submitted {new Date(briefRow.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </SectionHead>
              {briefRow?.brief_data ? (
                <BriefSection brief={briefRow.brief_data as Record<string, unknown>} />
              ) : (
                <EmptyState message="Your project brief hasn't been submitted yet." />
              )}
            </section>

            {/* Proposal & investment */}
            <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.lg, padding: "24px 28px" }}>
              <SectionHead label="Proposal & investment" />
              {proposal ? (
                <ProposalSection proposal={proposal as Proposal} />
              ) : (
                <EmptyState message="Your proposal will appear here once it's been prepared." />
              )}
            </section>

            {/* Brand guidelines */}
            {brand && (
              <section style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.lg, padding: "24px 28px" }}>
                <SectionHead label="Brand guidelines" />
                <BrandSection brand={brand as BrandGuideline} />
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
