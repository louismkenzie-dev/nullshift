import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Parallax } from "@/components/Parallax";
import { NeuralField } from "@/components/NeuralField";
import { ClipReveal } from "@/components/anim/ClipReveal";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  BtnGhost,
  Accordion,
  CTABand,
  Watermark,
  type FAQItem,
} from "@/components/kyma";

export const metadata: Metadata = {
  title: "FAQ — Nullshift",
  description:
    "Everything you need to know about agentic AI automation — bringing just a pain point, why not DIY, who carries the liability, ownership, scaling past your ceiling, data and the care plan.",
  alternates: { canonical: "/faq" },
};

const FAQS: FAQItem[] = [
  {
    cat: "No idea?",
    q: "I just have problems, not a spec — can you still help?",
    a: "That's the ideal starting point. You don't need an idea, a brief or a tech background — just point at what's painful. Our automation consultants deep-dive your operations, work out what can and should become a system, and rank it by impact. You bring the pain points; we bring the ideas, the build and the agents that run it. Start with a free tailored plan and we'll show you exactly what we'd automate and what it would save.",
  },
  {
    cat: "Why us",
    q: "Why not just build it myself with AI tools?",
    a: "AI tools can draft code — they can't take responsibility for it. This is more than you'd get wiring it together yourself: we're a team of senior developers with a real R&D background applying cutting-edge AI and agentic techniques to automate businesses. We build complex, pioneering systems — the ones others can't — fast and at low cost, then carry the liability for security and compliance. You end up with a watertight, production-grade system that scales, not a fragile prototype you have to babysit.",
  },
  {
    cat: "Liability",
    q: "Who's responsible if something goes wrong?",
    a: "We are. We take responsibility for data breaches, security and compliance on the systems we build and run for you — a watertight system, not a prototype you're left to defend. We host in the UK/EU, encrypt data in transit and at rest, keep a full audit trail, and sign a DPA before anything goes live. The liability sits with us, not on your shoulders.",
  },
  {
    cat: "Ownership",
    q: "Do I actually own what you build?",
    a: "Yes — completely. You own the code, the data and every account the system runs on. No per-seat fees, no lock-in, no holding your business hostage. You can cancel the care plan at any time and keep everything, with a full export of your data and the running system handed over — you'd just take over hosting and maintenance yourself.",
  },
  {
    cat: "Scale",
    q: "We've hit a ceiling — everything refers back to us. Can you fix that?",
    a: "That's exactly what we're for. Many businesses stall because they're too bureaucratic and every decision funnels back to the founders. We automate those bottlenecks and hand-offs, turn the manual work into agents and systems, and optimise your operations for scale — so growth stops stalling under its own weight and your business is set up for exponential, not linear, growth. You know you need to move into the AI era; we do the how.",
  },
  {
    cat: "Any industry",
    q: "Does this work for my industry?",
    a: "Yes. The work that drains staff cost, time and revenue — admin, ops, data entry, follow-ups, document processing, customer handling — looks similar across every sector. We've automated it for businesses as different as professional services, e-commerce and clinics; the agentic approach adapts to whatever your operation actually does, not the other way around.",
  },
  {
    cat: "Data & GDPR",
    q: "Is my data safe and GDPR-compliant?",
    a: "Yes. We act as your data processor under a signed DPA, host your system in the UK/EU, and encrypt data in transit and at rest with a full audit trail. Your data lives in a system you own — GDPR-compliant, exportable any time, never sold and never locked in. You stay the data controller; we run the infrastructure on your behalf and carry the security and compliance responsibility for it.",
  },
  {
    cat: "Pricing",
    q: "How does pricing work — and why a care plan if I own it?",
    a: "Two simple parts. A one-off build to design, build and integrate the systems and agents — when it's done, the code, data and accounts are yours outright (no per-seat fees, no from-price; every project is scoped to you). Then a monthly care plan, because owning the system and running it are different things: it covers the running costs — hosting, storage, email and servers — plus our liability and compliance cover and ongoing optimisation. Cancel whenever you like and you keep everything.",
  },
  {
    cat: "How it works",
    q: "What does working with you actually look like?",
    a: "A clear path from a first conversation to a system that runs itself. Our specialists deep-dive your operations and find what should become a system, we design the agents and scope it tightly so you see what you'll get before a line is built, our developers build it fast and wire it into your existing tools and data with no downtime, and then we run it, carry the liability and keep optimising as you scale. You bring the problem; we bring the system.",
  },
];

export default function FaqPage() {
  return (
    <>
      <Nav />
      <main>
        {/* ═══════════════ HERO (dark · layered WebGL depth) ═══════════════ */}
        <section
          className="k-dark relative overflow-hidden"
          style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
        >
          {/* deep layer — raw-WebGL emerald field, drifts with scroll + cursor */}
          <NeuralField className="absolute inset-0" style={{ zIndex: 0 }} />
          {/* mid layer — parallaxing hairline grid */}
          <Parallax
            distance={-28}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 1 }}
          >
            <div
              className="k-vgrid absolute inset-0"
              style={{
                opacity: 0.4,
                WebkitMaskImage: "linear-gradient(180deg,#000,transparent 82%)",
                maskImage: "linear-gradient(180deg,#000,transparent 82%)",
              }}
            />
          </Parallax>
          {/* keep the field from ever fighting the headline */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex: 1,
              background:
                "radial-gradient(125% 95% at 50% 0%, transparent 28%, var(--k-bg) 94%)",
            }}
          />
          <Container
            style={{
              paddingTop: "clamp(116px,15vh,168px)",
              paddingBottom: "clamp(40px,6vw,72px)",
              position: "relative",
              zIndex: 2,
            }}
          >
            <Reveal>
              <Eyebrow index="01" label="Frequently asked" />
            </Reveal>
            <div className="mt-7 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-8 lg:gap-12 items-end">
              <ClipReveal delay={0.05}>
                <Display as="h1" size="hero" style={{ maxWidth: "14ch" }}>
                  Everything you <span style={{ color: "var(--k-accent)" }}>[need]</span>{" "}
                  to know.
                </Display>
              </ClipReveal>
              <Reveal delay={0.1}>
                <div>
                  <Lead style={{ maxWidth: "44ch" }}>
                    Can&apos;t find your answer? Book a free 15-minute call and we&apos;ll
                    answer everything about your business directly.
                  </Lead>
                  <div className="mt-7">
                    <BtnGhost href="/book" arrow>
                      Book a call
                    </BtnGhost>
                  </div>
                </div>
              </Reveal>
            </div>
            <Parallax distance={42} className="mt-12 overflow-hidden">
              <Watermark>Questions</Watermark>
            </Parallax>
          </Container>
        </section>

        {/* ═══════════════ FAQ ACCORDION (cream) ═══════════════ */}
        <Section theme="cream" pad="lg" topBorder>
          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28 self-start">
                <SectionHeader
                  index="02"
                  label="All questions"
                  title={
                    <>
                      Answers, <span style={{ color: "var(--k-accent)" }}>in full.</span>
                    </>
                  }
                  lead="Ownership, the care plan, your data, migrating over and payments — the things businesses ask us most before they own their system."
                />
                <div className="mt-8">
                  <BtnGhost href="/start" arrow>
                    Get my free plan
                  </BtnGhost>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <Accordion items={FAQS} defaultOpen={null} />
            </Reveal>
          </div>
        </Section>

        {/* ═══════════════ FINAL CTA (dark) ═══════════════ */}
        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="dark"
            index="03"
            label="Still curious"
            title={
              <>
                Still have <span style={{ color: "var(--k-accent)" }}>questions?</span>
              </>
            }
            lead="Book a free 15-minute call and ask us anything about owning your business system."
            primary={{ label: "Book a discovery call", href: "/book" }}
            secondary={{ label: "Get my free plan", href: "/start" }}
            note="Free · No obligation · 15-minute call"
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
