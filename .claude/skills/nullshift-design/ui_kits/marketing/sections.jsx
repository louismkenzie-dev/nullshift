/* Nullshift marketing site — section components.
   Composes the design-system primitives from the bundle namespace. */
const NS = window.NullshiftDesignSystem_7b523b;
const { Logo, Button, Eyebrow, Tag, PricingCard, Input, Textarea, Card } = NS;

/* ── Top nav ──────────────────────────────────────────────── */
function MarketingNav({ onBook }) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const root = document.querySelector("[data-scroll-root]");
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > 40);
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);
  const links = ["Services", "Process", "Pricing"];
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, padding: "8px 12px" }}>
      <nav style={{
        maxWidth: scrolled ? 900 : 1180, margin: "0 auto", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingInline: 20,
        background: scrolled ? "color-mix(in oklab, var(--bg) 85%, transparent)" : "transparent",
        border: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
        borderRadius: "var(--radius-lg)",
        backdropFilter: scrolled ? "var(--blur-nav)" : "none",
        transition: "all var(--motion-slow) var(--easing-standard)",
      }}>
        <Logo size={22} />
        <ul style={{ display: "flex", gap: 30, listStyle: "none", margin: 0, padding: 0 }} className="ns-hide-sm">
          {links.map((l) => (
            <li key={l}><a href={"#" + l.toLowerCase()} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--muted)", textDecoration: "none" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted)"}>{l}</a></li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" className="ns-hide-sm">Client login</Button>
          <Button size="sm" onClick={onBook}>Book a call</Button>
        </div>
      </nav>
    </header>
  );
}

/* ── Hero ─────────────────────────────────────────────────── */
function Hero({ onBook }) {
  return (
    <section style={{ position: "relative", padding: "120px 24px 96px", overflow: "hidden",
      backgroundImage: "radial-gradient(ellipse 50% 55% at 72% 28%, color-mix(in oklab, var(--primary) 7%, transparent) 0%, transparent 70%)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Eyebrow>UK-based web &amp; brand studio</Eyebrow>
        <h1 className="ns-display" style={{ fontSize: "clamp(3rem, 8vw, 6.5rem)", marginTop: 24, marginBottom: 0 }}>
          Websites that convert,<br />built with{" "}
          <span className="ns-hero-glow" style={{ color: "var(--primary)" }}>intention.</span>
        </h1>
        <p style={{ maxWidth: "52ch", marginTop: 28, fontFamily: "var(--font-sans)", fontSize: "var(--text-lg)", lineHeight: "var(--leading-relaxed)", color: "var(--muted)" }}>
          We design and build fast, beautiful websites and brand systems for businesses doing the work.
          No templates, no bloat — every pixel considered, every line of code clean.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
          <Button size="lg" onClick={onBook} iconEnd={<span>→</span>}>Start your project</Button>
          <Button size="lg" variant="secondary">See our work</Button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 40, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)", color: "var(--muted)", letterSpacing: "0.04em" }}>
          <span className="ns-pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--primary)" }} />
          Response within 24 hours · 2–4 week turnaround
        </div>
      </div>
    </section>
  );
}

/* ── Services ─────────────────────────────────────────────── */
function Services() {
  const cards = [
    { num: "01", title: "Web design & development", desc: "From strategy to launch — fast, beautiful websites that turn visitors into customers. Custom build, no templates.", tag: "CUSTOM_BUILD / NO_TEMPLATES" },
    { num: "02", title: "Branding & identity", desc: "Logos, colour systems, and visual identity for businesses ready to show up professionally online.", tag: "IDENTITY_SYSTEMS / SCALABLE" },
    { num: "03", title: "Systems & automation", desc: "Booking systems, CRMs, client portals and automated workflows — bespoke tools that save you time.", tag: "WORKFLOWS / INTEGRATIONS" },
  ];
  return (
    <section id="services" style={{ borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px" }}>
        <Eyebrow>02 — Services</Eyebrow>
        <h2 className="ns-h2" style={{ marginTop: 18, marginBottom: 40 }}>What we do.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {cards.map((c) => (
            <Card key={c.num} interactive padding={28} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "1.5rem", color: "color-mix(in oklab, var(--primary) 40%, transparent)" }}>{c.num}</span>
              <h3 className="ns-h3" style={{ fontSize: "1.3rem" }}>{c.title}</h3>
              <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", lineHeight: 1.55, color: "var(--muted)" }}>{c.desc}</p>
              <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "var(--text-mono)", fontWeight: 500, letterSpacing: "0.06em", color: "var(--primary)" }}>
                <span style={{ width: 12, height: 1, background: "color-mix(in oklab, var(--primary) 70%, transparent)" }} />{c.tag}
              </span>
            </Card>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 32 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--faint)", marginRight: 6, alignSelf: "center" }}>Built for —</span>
          {["Retail", "Hospitality", "Trades", "Professional Services", "Health & Wellness"].map((t) => (
            <Tag key={t} interactive>{t}</Tag>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Process ──────────────────────────────────────────────── */
function Process() {
  const steps = [
    { num: "001", title: "Discovery", desc: "We learn your business, goals, and customers. No assumptions — just honest conversation." },
    { num: "002", title: "Design", desc: "A bespoke visual direction built around your brand. We present, you refine." },
    { num: "003", title: "Build", desc: "Fast, clean, mobile-first code. No templates, no page builders — crafted for you." },
    { num: "004", title: "Launch", desc: "We handle hosting, domain, deployment. You go live — with ongoing support." },
  ];
  return (
    <section id="process" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px" }}>
        <Eyebrow>03 — How it works</Eyebrow>
        <h2 className="ns-h2" style={{ marginTop: 18, marginBottom: 40 }}>The process.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
          {steps.map((s) => (
            <div key={s.num} style={{ padding: 28, borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "2rem", color: "color-mix(in oklab, var(--primary) 25%, transparent)" }}>{s.num}</span>
              <h3 className="ns-h3" style={{ fontSize: "1.25rem" }}>{s.title}</h3>
              <div style={{ width: 20, height: 1, background: "var(--border-strong)" }} />
              <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", lineHeight: 1.55, color: "var(--muted)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────────────── */
function Pricing({ onBook }) {
  return (
    <section id="pricing" style={{ borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px" }}>
        <Eyebrow>04 — Pricing</Eyebrow>
        <h2 className="ns-h2" style={{ marginTop: 18, marginBottom: 12 }}>Fixed pricing, no surprises.</h2>
        <p style={{ maxWidth: "48ch", marginTop: 0, marginBottom: 40, fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", color: "var(--muted)", lineHeight: 1.6 }}>
          You&apos;ll know exactly what you&apos;re paying before we start. No hidden fees. No surprise invoices.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "stretch" }}>
          <PricingCard tier="Starter" price="£1,200" bestFor="A clean, professional one-page launch"
            benefits={["Single-page site", "Bespoke design", "Mobile-first build", { text: "CMS / blog", checked: false }, { text: "Custom systems", checked: false }]} cta="Get started" />
          <PricingCard tier="Pro" price="£2,400" bestFor="Growing businesses ready to scale" highlighted
            benefits={["Up to 8 pages", "Bespoke design", "Mobile-first build", "CMS + blog", { text: "Custom systems", checked: false }]} cta="Start your build" />
          <PricingCard tier="Custom" price="Let's talk" bestFor="Bespoke systems & integrations"
            benefits={["Unlimited pages", "Bespoke design", "Booking / CRM systems", "Automated workflows", "Priority support"]} cta="Book a call" />
        </div>
      </div>
    </section>
  );
}

window.NSMarketing = { MarketingNav, Hero, Services, Process, Pricing };
