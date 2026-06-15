/* Nullshift marketing — contact section, footer, and the interactive
   "brief" modal flow. */
const NS2 = window.NullshiftDesignSystem_7b523b;
const { Logo, Button, Eyebrow, Input, Textarea } = NS2;

/* ── Contact ──────────────────────────────────────────────── */
function Contact({ onBook }) {
  return (
    <section id="contact" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, alignItems: "center" }}>
        <div>
          <Eyebrow>06 — Get in touch</Eyebrow>
          <h2 className="ns-h2" style={{ marginTop: 18, marginBottom: 16 }}>
            Ready to<br /><span className="ns-hero-glow" style={{ color: "var(--primary)" }}>go online?</span>
          </h2>
          <p style={{ maxWidth: "40ch", fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", lineHeight: 1.6, color: "var(--muted)" }}>
            Tell us about your business and we&apos;ll be in touch within 24 hours. No commitment required.
          </p>
          <div style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)", color: "var(--muted)", letterSpacing: "0.04em" }}>
              <span className="ns-pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--primary)" }} /> Response within 24 hours
            </span>
            <span style={{ paddingLeft: 16, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)", color: "color-mix(in oklab, var(--muted) 70%, transparent)", letterSpacing: "0.04em" }}>UK-based — global reach</span>
          </div>
        </div>
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: 36 }}>
          <Eyebrow>5-step brief</Eyebrow>
          <h3 className="ns-h3" style={{ marginTop: 16, marginBottom: 10, fontSize: "1.6rem" }}>Tell us about your project.</h3>
          <p style={{ marginTop: 0, marginBottom: 24, fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--muted)", lineHeight: 1.55 }}>
            A quick 2-minute brief — pages, style, budget, timeline. We&apos;ll send back a clear proposal.
          </p>
          <Button size="lg" onClick={onBook} iconEnd={<span>→</span>} style={{ width: "100%", justifyContent: "space-between" }}>Tell us more</Button>
          <div style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)", color: "color-mix(in oklab, var(--muted) 70%, transparent)", letterSpacing: "0.04em" }}>~2 min · no commitment</div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────── */
function MarketingFooter() {
  const links = ["About", "FAQ", "Brand", "Legal"];
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 24px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <Logo size={20} compact />
        <nav style={{ display: "flex", gap: 24 }}>
          {links.map((l) => (
            <a key={l} href="#" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--muted)", textDecoration: "none" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted)"}>{l}</a>
          ))}
        </nav>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--faint)" }}>© 2025 Nullshift.</span>
      </div>
    </footer>
  );
}

/* ── Brief modal — multi-step intake ──────────────────────── */
function BriefModal({ open, onClose }) {
  const STEPS = ["Contact", "Project", "Details", "Done"];
  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState({ name: "", business: "", email: "", type: "Website", budget: "£2,400 — Pro", notes: "" });
  React.useEffect(() => { if (open) { setStep(0); } }, [open]);
  if (!open) return null;
  const set = (k) => (e) => setData((d) => ({ ...d, [k]: e.target.value }));
  const types = ["Website", "Brand", "System"];
  const budgets = ["£1,200 — Starter", "£2,400 — Pro", "Let's talk — Custom"];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "var(--overlay)", backdropFilter: "var(--blur-overlay)", display: "grid", placeItems: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(520px, 100%)", background: "var(--elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        {/* header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow mono>// PROJECT BRIEF</Eyebrow>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {/* progress */}
        <div style={{ display: "flex", gap: 6, padding: "16px 24px 0" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= step ? "var(--primary)" : "var(--border)", transition: "background var(--motion-base)" }} />
          ))}
        </div>
        <div style={{ padding: 24, minHeight: 220 }}>
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Input label="Your name" placeholder="Jordan Lee" value={data.name} onChange={set("name")} />
              <Input label="Business name" placeholder="Acme Ltd" value={data.business} onChange={set("business")} />
              <Input label="Email" type="email" placeholder="jordan@acme.co.uk" value={data.email} onChange={set("email")} />
            </div>
          )}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="What do you need?">
                <Segmented options={types} value={data.type} onChange={(v) => setData((d) => ({ ...d, type: v }))} />
              </Field>
              <Field label="Rough budget">
                <Segmented options={budgets} value={data.budget} onChange={(v) => setData((d) => ({ ...d, budget: v }))} vertical />
              </Field>
            </div>
          )}
          {step === 2 && (
            <Textarea label="Anything else we should know?" rows={6} placeholder="Pages, references, timeline, must-haves…" value={data.notes} onChange={set("notes")} />
          )}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--primary-soft)", border: "1px solid color-mix(in oklab, var(--primary) 50%, transparent)", display: "grid", placeItems: "center", color: "var(--primary)", fontSize: 26 }}>✓</div>
              <h3 className="ns-h3" style={{ fontSize: "1.4rem" }}>Brief received.</h3>
              <p style={{ margin: 0, maxWidth: "34ch", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--muted)", lineHeight: 1.55 }}>
                Thanks{data.name ? `, ${data.name.split(" ")[0]}` : ""}. We&apos;ll review and send a clear proposal within 24 hours.
              </p>
            </div>
          )}
        </div>
        {/* footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--faint)" }}>
            {step < 3 ? `Step ${step + 1} of 3` : "Complete"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && step < 3 && <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>Back</Button>}
            {step < 2 && <Button size="sm" onClick={() => setStep((s) => s + 1)}>Continue</Button>}
            {step === 2 && <Button size="sm" onClick={() => setStep(3)}>Submit brief</Button>}
            {step === 3 && <Button size="sm" onClick={onClose}>Done</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--muted)" }}>{label}</span>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange, vertical = false }) {
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: 8 }}>
      {options.map((o) => {
        const active = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            flex: 1, padding: "10px 14px", textAlign: "left",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 500,
            color: active ? "var(--primary)" : "var(--fg)",
            background: active ? "var(--primary-soft)" : "var(--surface)",
            border: `1px solid ${active ? "color-mix(in oklab, var(--primary) 55%, transparent)" : "var(--border)"}`,
            borderRadius: "var(--radius-md)", cursor: "pointer",
            transition: "all var(--motion-base)",
          }}>{o}</button>
        );
      })}
    </div>
  );
}

window.NSMarketing2 = { Contact, MarketingFooter, BriefModal };
