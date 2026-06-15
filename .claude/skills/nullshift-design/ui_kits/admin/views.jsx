/* Nullshift admin — Dashboard + Enquiries views. */
const NSD = window.NullshiftDesignSystem_7b523b;
const { StatCard, Badge, Button } = NSD;

const ENQUIRIES = [
  { name: "Priya Nair", business: "Bloom Florals", date: "12 Jun", status: "new" },
  { name: "Marcus Hale", business: "Hale Joinery", date: "11 Jun", status: "new" },
  { name: "Dervla O'Brien", business: "Coast Physio", date: "10 Jun", status: "new" },
  { name: "Sam Whitfield", business: "Whitfield & Co", date: "9 Jun", status: "contacted" },
  { name: "Aisha Khan", business: "Lantern Café", date: "7 Jun", status: "contacted" },
];

const BRIEF_NEEDED = [
  { name: "Marcus Hale", business: "Hale Joinery" },
  { name: "Tom Bridges", business: "Bridges Electrical" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALL_DAYS = [4, 11, 18, 26];
const TODAY = 14;

/* ── Reusable panel ───────────────────────────────────────── */
function Panel({ marker, title, action, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 2 }}>{marker}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1rem", color: "var(--fg)" }}>{title}</div>
        </div>
        {action && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", cursor: "pointer" }}>{action} →</span>}
      </div>
      <div style={{ padding: "8px 10px" }}>{children}</div>
    </div>
  );
}

function Row({ name, business, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", borderRadius: "var(--radius-md)" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--elevated)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.95rem", color: "var(--fg)" }}>{name}</div>
        {business && <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--muted)" }}>{business}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{right}</div>
    </div>
  );
}

/* ── Dashboard view ───────────────────────────────────────── */
function Dashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>// OVERVIEW</div>
          <h1 className="ns-h1" style={{ fontSize: "2.2rem", margin: 0 }}>Dashboard</h1>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--muted)" }}>Saturday, 14 June 2025</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="Expected income" value="£8,400" sublabel="Jun 2025 · signed proposals" />
        <StatCard label="New enquiries" value="3" sublabel="Awaiting action" accent="var(--warning)" />
        <StatCard label="Missing brief link" value="2" sublabel="Active clients" accent="var(--info)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 24 }} className="ns-admin-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Panel marker="// INBOX" title="New enquiries" action="View all">
            {ENQUIRIES.filter((e) => e.status === "new").map((e) => (
              <Row key={e.name} name={e.name} business={e.business} right={
                <div style={{ textAlign: "right" }}>
                  <Badge tone="warning">new</Badge>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-xs)", color: "var(--muted)", marginTop: 4 }}>{e.date}</div>
                </div>
              } />
            ))}
          </Panel>
          <Panel marker="// ACTION NEEDED" title="Brief link not sent" action="Clients">
            {BRIEF_NEEDED.map((c) => (
              <Row key={c.name} name={c.name} business={c.business} right={
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--info)" }}>Send brief →</span>
              } />
            ))}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Next call */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--primary)", borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "0 0 30px -8px color-mix(in oklab, var(--primary) 50%, transparent)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 12 }}>// NEXT CALL</div>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1.3rem", color: "var(--fg)" }}>Bloom Florals</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--muted)", marginBottom: 12 }}>Priya Nair</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: "var(--radius-md)", background: "var(--primary-soft)", border: "1px solid color-mix(in oklab, var(--primary) 30%, transparent)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--primary)" }} />
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.88rem", fontWeight: 600, color: "var(--fg)" }}>Today</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--primary)" }}>14:30 · 30 min</div>
              </div>
            </div>
          </div>

          {/* Mini calendar */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1rem", color: "var(--fg)" }}>June <span style={{ color: "var(--muted)" }}>2025</span></span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-xs)", textTransform: "uppercase", color: "var(--muted)" }}>Full →</span>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
                {WEEKDAYS.map((w, i) => <div key={w} style={{ textAlign: "center", padding: "4px 0", fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase", color: i >= 5 ? "color-mix(in oklab, var(--muted) 55%, transparent)" : "var(--muted)" }}>{w}</div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                {Array.from({ length: 6 }).map((_, i) => <div key={"pre" + i} />)}
                {Array.from({ length: 30 }).map((_, idx) => {
                  const day = idx + 1;
                  const isToday = day === TODAY;
                  const hasCall = CALL_DAYS.includes(day);
                  return (
                    <div key={day} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", position: "relative", background: isToday ? "var(--primary)" : hasCall ? "var(--primary-soft)" : "transparent" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--primary-fg)" : "var(--fg)" }}>{day}</span>
                      {hasCall && !isToday && <span style={{ position: "absolute", bottom: 3, width: 3, height: 3, borderRadius: 999, background: "var(--primary)" }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Enquiries view ───────────────────────────────────────── */
function Enquiries() {
  const tone = { new: "warning", contacted: "info" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>// INBOX</div>
        <h1 className="ns-h1" style={{ fontSize: "2.2rem", margin: 0 }}>Enquiries</h1>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.8fr", padding: "12px 20px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-xs)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
          <span>Name</span><span>Business</span><span>Received</span><span>Status</span>
        </div>
        {ENQUIRIES.map((e, i) => (
          <div key={e.name} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.8fr", alignItems: "center", padding: "16px 20px", borderBottom: i < ENQUIRIES.length - 1 ? "1px solid var(--border)" : "none" }}
            onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--elevated)"}
            onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.95rem", color: "var(--fg)" }}>{e.name}</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--muted)" }}>{e.business}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--muted)" }}>{e.date}</span>
            <span><Badge tone={tone[e.status]}>{e.status}</Badge></span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.NSAdmin = { Dashboard, Enquiries };
