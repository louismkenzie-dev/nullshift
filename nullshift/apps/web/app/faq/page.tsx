"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@nullshift/ui/tokens";
import Link from "next/link";

const faqs = [
  {
    category: "Process",
    q: "How does the project process work?",
    a: "We follow a four-step process: Discovery (we learn your business and goals), Design (a bespoke visual direction built around your brand), Build (clean, hand-written code, mobile-first), and Launch (we handle deployment and hand everything over to you). Each stage has clear milestones and checkpoints so you're never in the dark.",
  },
  {
    category: "Process",
    q: "How long does a typical project take?",
    a: "Most projects are delivered in 2–4 weeks from the time we have all the content and sign-off on the design direction. Larger or more complex projects may take 6–8 weeks. We'll give you a clear timeline in your proposal before anything starts.",
  },
  {
    category: "Process",
    q: "How many revisions do I get?",
    a: "Starter plans include 2 rounds of revisions, Standard includes 3, and Premium includes unlimited revisions. A 'revision round' means a consolidated set of feedback that we action together — not individual one-off changes. We find this keeps projects moving efficiently.",
  },
  {
    category: "Pricing & Ownership",
    q: "Do I own my website when it's done?",
    a: "Yes — completely and absolutely. All code, design assets, and content are transferred to you on project completion. You're free to host it anywhere, modify it, or hand it to another developer. There are no ongoing fees to Nullshift unless you choose a maintenance plan.",
  },
  {
    category: "Pricing & Ownership",
    q: "Why is bespoke code cheaper than Wix in the long run?",
    a: "Wix, Squarespace, and similar platforms charge monthly fees that compound over years. A $30/month Wix plan costs $360/year — over 5 years, that's $1,800 before any premium apps or upgrades. A bespoke site has a one-time cost and then minimal ongoing hosting fees (typically $5–$20/month for fast, reliable hosting). The maths works in your favour quickly.",
  },
  {
    category: "Pricing & Ownership",
    q: "Do you offer payment plans?",
    a: "Yes. We typically work on a 50% deposit to start, 50% on completion model. For larger projects, staged milestone payments can be arranged. We're flexible — just discuss it with us on the discovery call.",
  },
  {
    category: "Technical",
    q: "What technology do you use to build websites?",
    a: "We build with modern, industry-standard technologies — typically React/Next.js for the frontend, paired with whatever backend or CMS makes sense for your project. Everything is optimised for performance, accessibility, and search engine visibility. No proprietary systems, no lock-in.",
  },
  {
    category: "Technical",
    q: "Will my website work on mobile?",
    a: "Absolutely — mobile-first is our default approach. We design and build for small screens first, then scale up. Your site will look and perform perfectly on any device or screen size.",
  },
  {
    category: "Technical",
    q: "Do you handle hosting and domain setup?",
    a: "Yes. We guide you through setting up hosting (we recommend fast, affordable options like Vercel or Netlify) and connect your domain. Hosting accounts are registered in your name so you own them outright. We can manage this for you or hand over instructions — whatever you prefer.",
  },
  {
    category: "After Launch",
    q: "What happens after my site goes live?",
    a: "Every plan includes a post-launch support window (30–60 days depending on tier) where we fix any bugs or make minor adjustments at no cost. After that, we offer monthly maintenance packages for updates, security patches, and content changes — or you're free to manage it yourself.",
  },
  {
    category: "After Launch",
    q: "Can I update my website myself after it's built?",
    a: "Yes. If your project includes a CMS (content management system), you'll be able to update text, images, and blog posts yourself without any coding knowledge. We'll walk you through how to use it. For more structural changes, we're always available to help.",
  },
  {
    category: "General",
    q: "Do I need to provide my own content?",
    a: "For most projects, yes — you'll provide your text, images, and any existing brand assets. We can advise on what you need and how to structure it. If you need copywriting or photography, we can recommend trusted collaborators, though these aren't included in our standard scope.",
  },
];

function AccordionItem({ item, index }: { item: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={index * 0.04}>
      <div style={{ borderBottom: `1px solid ${T.border}` }}>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-start justify-between gap-6 text-left py-6 px-10 md:px-16"
          style={{ background: "transparent", cursor: "pointer", transition: `background ${T.duration.base} ${T.ease}` }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.surface}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
        >
          <div className="flex flex-col gap-1.5">
            <span style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary }}>{item.category}</span>
            <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(1rem, 1.8vw, 1.2rem)", letterSpacing: "-0.015em", lineHeight: 1.3, color: T.fg }}>{item.q}</span>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: "1.2rem", color: open ? T.primary : T.muted, flexShrink: 0, marginTop: "14px", transition: `transform ${T.duration.base}, color ${T.duration.base}`, transform: open ? "rotate(45deg)" : "rotate(0deg)", display: "inline-block" }}>+</span>
        </button>
        {open && (
          <div className="px-10 md:px-16 pb-7">
            <p style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.7, letterSpacing: "-0.005em", color: T.muted, maxWidth: "72ch" }}>{item.a}</p>
          </div>
        )}
      </div>
    </Reveal>
  );
}

export default function FaqPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-20 px-8 md:px-16" style={{
          backgroundImage: `radial-gradient(ellipse 50% 55% at 65% 35%, ${T.primarySoft} 0%, transparent 70%)`,
        }}>
          <div className="mb-7">
            <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
              <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, display: "inline-block" }} />
              Frequently asked
            </span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(3rem, 9vw, 7rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Everything<br /><span className="hero-glow" style={{ color: T.primary }}>you need to know.</span>
          </h1>
          <p className="mt-6 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.65, letterSpacing: "-0.005em", color: T.muted }}>
            Can&apos;t find your answer? Book a call and we&apos;ll answer everything directly.
          </p>
        </section>

        {/* Accordion */}
        <section style={{ borderTop: `1px solid ${T.border}` }}>
          {faqs.map((item, i) => (
            <AccordionItem key={i} item={item} index={i} />
          ))}
        </section>

        {/* CTA */}
        <section className="px-10 md:px-16 py-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-8" style={{ borderTop: `1px solid ${T.border}`, background: T.surface }}>
          <Reveal>
            <div>
              <h2 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.025em", color: T.fg }}>
                Still have <span style={{ color: T.primary }}>questions?</span>
              </h2>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.9375rem", lineHeight: 1.55, letterSpacing: "-0.005em", color: T.muted }}>Book a free 30-minute discovery call and ask us anything.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/book" className="inline-flex items-center gap-2"
              style={{ fontFamily: T.sans, fontSize: "0.9375rem", fontWeight: 500, letterSpacing: "-0.005em", height: 48, paddingInline: 24, background: T.primary, color: T.primaryFg, borderRadius: T.r.md, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`, whiteSpace: "nowrap", textDecoration: "none", transition: `background ${T.duration.base} ${T.ease}` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.primaryHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = T.primary}
            >
              Book a discovery call →
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
