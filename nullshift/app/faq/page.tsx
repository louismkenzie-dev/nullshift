"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { T } from "@/lib/tokens";
import Link from "next/link";

const faqs = [
  {
    category: "PROCESS",
    q: "How does the project process work?",
    a: "We follow a four-step process: Discovery (we learn your business and goals), Design (a bespoke visual direction built around your brand), Build (clean, hand-written code, mobile-first), and Launch (we handle deployment and hand everything over to you). Each stage has clear milestones and checkpoints so you're never in the dark.",
  },
  {
    category: "PROCESS",
    q: "How long does a typical project take?",
    a: "Most projects are delivered in 2–4 weeks from the time we have all the content and sign-off on the design direction. Larger or more complex projects may take 6–8 weeks. We'll give you a clear timeline in your proposal before anything starts.",
  },
  {
    category: "PROCESS",
    q: "How many revisions do I get?",
    a: "Starter plans include 2 rounds of revisions, Standard includes 3, and Premium includes unlimited revisions. A 'revision round' means a consolidated set of feedback that we action together — not individual one-off changes. We find this keeps projects moving efficiently.",
  },
  {
    category: "PRICING & OWNERSHIP",
    q: "Do I own my website when it's done?",
    a: "Yes — completely and absolutely. All code, design assets, and content are transferred to you on project completion. You're free to host it anywhere, modify it, or hand it to another developer. There are no ongoing fees to Nullshift unless you choose a maintenance plan.",
  },
  {
    category: "PRICING & OWNERSHIP",
    q: "Why is bespoke code cheaper than Wix in the long run?",
    a: "Wix, Squarespace, and similar platforms charge monthly fees that compound over years. A $30/month Wix plan costs $360/year — over 5 years, that's $1,800 before any premium apps or upgrades. A bespoke site has a one-time cost and then minimal ongoing hosting fees (typically $5–$20/month for fast, reliable hosting). The maths works in your favour quickly.",
  },
  {
    category: "PRICING & OWNERSHIP",
    q: "Do you offer payment plans?",
    a: "Yes. We typically work on a 50% deposit to start, 50% on completion model. For larger projects, staged milestone payments can be arranged. We're flexible — just discuss it with us on the discovery call.",
  },
  {
    category: "TECHNICAL",
    q: "What technology do you use to build websites?",
    a: "We build with modern, industry-standard technologies — typically React/Next.js for the frontend, paired with whatever backend or CMS makes sense for your project. Everything is optimised for performance, accessibility, and search engine visibility. No proprietary systems, no lock-in.",
  },
  {
    category: "TECHNICAL",
    q: "Will my website work on mobile?",
    a: "Absolutely — mobile-first is our default approach. We design and build for small screens first, then scale up. Your site will look and perform perfectly on any device or screen size.",
  },
  {
    category: "TECHNICAL",
    q: "Do you handle hosting and domain setup?",
    a: "Yes. We guide you through setting up hosting (we recommend fast, affordable options like Vercel or Netlify) and connect your domain. Hosting accounts are registered in your name so you own them outright. We can manage this for you or hand over instructions — whatever you prefer.",
  },
  {
    category: "AFTER LAUNCH",
    q: "What happens after my site goes live?",
    a: "Every plan includes a post-launch support window (30–60 days depending on tier) where we fix any bugs or make minor adjustments at no cost. After that, we offer monthly maintenance packages for updates, security patches, and content changes — or you're free to manage it yourself.",
  },
  {
    category: "AFTER LAUNCH",
    q: "Can I update my website myself after it's built?",
    a: "Yes. If your project includes a CMS (content management system), you'll be able to update text, images, and blog posts yourself without any coding knowledge. We'll walk you through how to use it. For more structural changes, we're always available to help.",
  },
  {
    category: "GENERAL",
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
          className="w-full flex items-start justify-between gap-6 text-left py-6 px-10 md:px-16 transition-colors hover:bg-[#18181b]"
          style={{ background: "transparent", cursor: "pointer" }}>
          <div className="flex flex-col gap-1">
            <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: T.primary }}>{item.category}</span>
            <span style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(1rem,1.8vw,1.3rem)", letterSpacing: "0.01em", color: T.fg }}>{item.q}</span>
          </div>
          <span style={{ fontFamily: T.mono, fontSize: "1.2rem", color: open ? T.primary : T.muted, flexShrink: 0, marginTop: "14px", transition: "transform 0.2s, color 0.2s", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
        </button>
        {open && (
          <div className="px-10 md:px-16 pb-6">
            <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.8, color: T.muted, maxWidth: "72ch" }}>{item.a}</p>
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
          backgroundImage: `radial-gradient(ellipse 50% 55% at 65% 35%, color-mix(in oklab, ${T.primary} 5%, transparent) 0%, transparent 70%)`,
        }}>
          <div className="flex items-center gap-3 mb-6" style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
            <span className="size-1.5 rounded-full" style={{ background: T.primary }} />
            <span>SYS_06 / FAQ</span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(3.5rem,9vw,9rem)", lineHeight: 0.92, letterSpacing: "-0.01em", color: T.fg }}>
            FREQUENTLY<br /><span className="hero-glow" style={{ color: T.primary }}>ASKED.</span>
          </h1>
          <p className="mt-6 max-w-[44ch]" style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.75, color: T.muted }}>
            Everything you need to know about working with Nullshift. Can&apos;t find your answer? Book a call.
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
              <h2 style={{ fontFamily: T.display, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.5rem)", lineHeight: 0.95, letterSpacing: "-0.01em", color: T.fg }}>
                STILL HAVE <span style={{ color: T.primary }}>QUESTIONS?</span>
              </h2>
              <p className="mt-3" style={{ fontFamily: T.sans, fontSize: "0.9rem", color: T.muted }}>Book a free 30-minute discovery call and ask us anything.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Link href="/book" className="inline-flex items-center gap-3 px-6 h-12 font-semibold transition-opacity hover:opacity-90"
              style={{ fontFamily: T.mono, fontSize: "0.8rem", letterSpacing: "0.06em", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 30%, transparent)`, whiteSpace: "nowrap" }}>
              Book a discovery call →
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
