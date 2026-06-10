import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";
import { T } from "@/lib/tokens";
import Link from "next/link";

export default async function PortalDashboard() {
  if (!hasSupabaseBrowserConfig()) {
    return <SetupMessage />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return <SetupMessage />;

  const service = createServiceClient();

  // Look up the client record by email
  const { data: client } = await service
    .from("clients")
    .select("id, name, business_name, email, status, created_at")
    .eq("email", user.email)
    .maybeSingle();

  // Fetch proposals linked to this client
  const { data: proposals } = client
    ? await service
        .from("proposals")
        .select("id, title, summary, status, sent_at, accepted_at, total, currency, project_name")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Fetch calls linked to this client
  const { data: calls } = client
    ? await service
        .from("calls")
        .select("id, call_date, call_time, duration_min, status, notes, meeting_link")
        .eq("client_id", client.id)
        .order("call_date", { ascending: false })
    : { data: [] };

  // Fetch submitted briefs for this client
  const { data: briefs } = client
    ? await service
        .from("enquiries")
        .select("id, created_at, source, brief_data, message, status")
        .eq("client_id", client.id)
        .in("source", ["brief", "booking", "contact"])
        .order("created_at", { ascending: false })
    : { data: [] };

  const displayName = client?.name ?? user.email.split("@")[0];
  const businessName = client?.business_name;

  return (
    <div style={{ padding: "40px 32px", maxWidth: 1000, margin: "0 auto" }}>

      {/* Welcome */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary, marginBottom: 8 }}>
          CLIENT PORTAL
        </p>
        <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(1.8rem, 3vw, 2.6rem)", letterSpacing: "-0.03em", color: T.fg, lineHeight: 1, marginBottom: 8 }}>
          Welcome back, {displayName}.
        </h1>
        {businessName && (
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>{businessName}</p>
        )}
      </div>

      {!client ? (
        // No client record yet — account exists but not yet linked by admin
        <div
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: T.r.lg,
            padding: 32,
            maxWidth: 520,
          }}
        >
          <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: T.primary, marginBottom: 12 }}>
            ACCOUNT PENDING
          </p>
          <p style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.65, color: T.muted }}>
            Your account is set up and your project will appear here once it&apos;s been created. If you have any questions in the meantime, get in touch.
          </p>
          <Link
            href="/contact"
            style={{ display: "inline-block", marginTop: 20, fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary, textDecoration: "none" }}
          >
            Contact us →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          {/* Proposals */}
          <Section title="Proposals" label={`${proposals?.length ?? 0} document${proposals?.length === 1 ? "" : "s"}`}>
            {!proposals?.length ? (
              <EmptyCard message="No proposals yet — your project proposal will appear here once it's been prepared." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {proposals.map((p) => (
                  <ProposalRow key={p.id} proposal={p} />
                ))}
              </div>
            )}
          </Section>

          {/* Calls */}
          <Section title="Calls" label={`${calls?.length ?? 0} booked`}>
            {!calls?.length ? (
              <EmptyCard message="No calls scheduled yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {calls.map((c) => (
                  <CallRow key={c.id} call={c} />
                ))}
              </div>
            )}
          </Section>

          {/* Briefs */}
          <Section title="Submitted Briefs" label={`${briefs?.length ?? 0} submission${briefs?.length === 1 ? "" : "s"}`}>
            {!briefs?.length ? (
              <EmptyCard message="No briefs submitted yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {briefs.map((b) => (
                  <BriefRow key={b.id} brief={b} />
                ))}
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: "1.1rem", color: T.fg, letterSpacing: "-0.01em" }}>
          {title}
        </h2>
        <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.md,
        padding: "20px 24px",
      }}
    >
      <p style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>{message}</p>
    </div>
  );
}

function ProposalRow({ proposal }: { proposal: Record<string, unknown> }) {
  const statusColour: Record<string, string> = {
    draft: T.muted,
    sent: "#facc15",
    accepted: T.primary,
    declined: T.danger,
  };
  const status = String(proposal.status ?? "draft");
  const total = proposal.total as number | null;
  const currency = String(proposal.currency ?? "GBP");

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.md,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <p style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9rem", color: T.fg, marginBottom: 4 }}>
          {String(proposal.project_name || proposal.title || "Untitled proposal")}
        </p>
        {proposal.summary ? (
          <p style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted, lineHeight: 1.5 }}>
            {String(proposal.summary)}
          </p>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {total != null && (
          <span style={{ fontFamily: T.mono, fontSize: "0.85rem", fontWeight: 700, color: T.fg }}>
            {currency === "GBP" ? "£" : currency}{total.toLocaleString()}
          </span>
        )}
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: statusColour[status] ?? T.muted,
            background: `${statusColour[status] ?? T.muted}18`,
            padding: "3px 8px",
            borderRadius: T.r.full,
          }}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

function CallRow({ call }: { call: Record<string, unknown> }) {
  const statusColour: Record<string, string> = {
    confirmed: T.primary,
    completed: T.muted,
    cancelled: T.danger,
  };
  const status = String(call.status ?? "confirmed");
  const dateStr = call.call_date ? new Date(String(call.call_date)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.md,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <p style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.9rem", color: T.fg, marginBottom: 4 }}>
          {dateStr} at {String(call.call_time ?? "TBC")}
        </p>
        <p style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.muted }}>
          {String(call.duration_min ?? "")} min call
          {call.meeting_link ? " · " : null}
          {call.meeting_link ? (
            <a href={String(call.meeting_link)} target="_blank" rel="noreferrer" style={{ color: T.primary, textDecoration: "none" }}>
              Join meeting →
            </a>
          ) : null}
        </p>
      </div>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: statusColour[status] ?? T.muted,
          background: `${statusColour[status] ?? T.muted}18`,
          padding: "3px 8px",
          borderRadius: T.r.full,
          flexShrink: 0,
        }}
      >
        {status}
      </span>
    </div>
  );
}

function BriefRow({ brief }: { brief: Record<string, unknown> }) {
  const dateStr = brief.created_at ? new Date(String(brief.created_at)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const source = String(brief.source ?? "submission");

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r.md,
        padding: "16px 20px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: T.primary }}>
          {source}
        </span>
        <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>{dateStr}</span>
      </div>
      {brief.message ? (
        <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted, lineHeight: 1.6 }}>
          {String(brief.message).slice(0, 200)}{String(brief.message).length > 200 ? "…" : ""}
        </p>
      ) : null}
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
