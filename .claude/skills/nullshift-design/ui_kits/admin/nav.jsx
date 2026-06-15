/* Nullshift admin — internal CRM dashboard.
   Faithful recreation of the live /admin surface. */
const NSA = window.NullshiftDesignSystem_7b523b;
const { LogoMark, Button, Badge, StatCard, Eyebrow } = NSA;

const NAV = [
  { label: "Dashboard", icon: "○" },
  { label: "Users", icon: "◫" },
  { label: "Enquiries", icon: "◈" },
  { label: "Clients", icon: "◇" },
  { label: "Calendar", icon: "◻" },
  { label: "Quotes", icon: "◈" },
  { label: "Proposals", icon: "◈" },
];

/* ── Topbar + drawer ──────────────────────────────────────── */
function AdminTopbar({ active, onNavigate }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, background: "color-mix(in oklab, var(--bg) 94%, transparent)", borderBottom: "1px solid var(--border)", backdropFilter: "var(--blur-nav)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={20} />
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1rem", color: "var(--fg)" }}>Nullshift</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.1em", color: "var(--primary)", textTransform: "uppercase" }}>/ admin</span>
        </span>
        <button onClick={() => setOpen((v) => !v)} aria-label="Menu" style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: open ? "var(--elevated)" : "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 5 }}>
          {[0, 1, 2].map((i) => <span key={i} style={{ width: 20, height: 1.5, background: "var(--fg)", borderRadius: 2 }} />)}
        </button>
      </nav>
      {/* backdrop */}
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity var(--motion-slow)" }} />
      {/* drawer */}
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 70, width: "min(320px, 85vw)", background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform var(--motion-slow) var(--easing-standard)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 24, borderBottom: "1px solid var(--border)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LogoMark size={18} />
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "0.95rem", color: "var(--fg)" }}>Nullshift</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-xs)", letterSpacing: "0.1em", color: "var(--primary)", textTransform: "uppercase" }}>/ admin</span>
          </span>
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "24px 16px", flex: 1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-xs)", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", paddingLeft: 12, marginBottom: 8 }}>Navigation</span>
          {NAV.map((l) => {
            const on = l.label === active;
            return (
              <button key={l.label} onClick={() => { onNavigate(l.label); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: "var(--radius-md)", border: "none", textAlign: "left", cursor: "pointer", background: on ? "color-mix(in oklab, var(--primary) 12%, transparent)" : "transparent", borderLeft: `2px solid ${on ? "var(--primary)" : "transparent"}` }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", width: 16, textAlign: "center", color: on ? "var(--primary)" : "var(--muted)" }}>{l.icon}</span>
                <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1rem", color: on ? "var(--primary)" : "var(--fg)" }}>{l.label}</span>
                {on && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: 999, background: "var(--primary)" }} />}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--muted)" }}>louis@nullshift.dev</span>
          <Button variant="secondary" size="sm">← View website</Button>
        </div>
      </aside>
    </>
  );
}

window.NSAdminNav = { AdminTopbar, NAV };
