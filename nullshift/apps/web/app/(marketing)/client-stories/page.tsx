import type { Metadata } from "next";
import React from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal, Section, Eyebrow, Display, Lead, CTABand } from "@/components/kyma";
import { NFTCaseStory } from "@/components/marketing/NFTCaseStory";

export const metadata: Metadata = {
  title: "Client stories — Nullshift",
  description:
    "How we build businesses their own systems — starting with NewFuture Therapy: brand, site, SEO engine and a course platform Laura owns outright. Watch the build morph from blueprint to her live practice, then hear it from her.",
  alternates: { canonical: "/client-stories" },
};

export default function ClientStoriesPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Header */}
        <Section theme="cream" pad="lg">
          <Reveal>
            <Eyebrow label="Client stories" />
            <Display size="xl" className="mt-5">
              Real builds,{" "}
              <span style={{ color: "var(--k-muted)" }}>owned outright.</span>
            </Display>
            <Lead className="mt-5" style={{ maxWidth: "58ch" }}>
              Not case-study decks — the actual systems, and the people running them.
              First up: NewFuture Therapy — nine weeks from first commit to a production
              AI companion built to the therapists&apos; own rules. Scroll the build, then
              hear it from Laura.
            </Lead>
          </Reveal>
        </Section>

        {/* The NewFuture Therapy story — morph + Laura's testimonial */}
        <Section theme="cream" pad="md" topBorder>
          <NFTCaseStory />
        </Section>

        {/* CTA */}
        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="dark"
            index="02"
            label="Your story next"
            title={
              <>
                Your business could be the{" "}
                <span style={{ color: "var(--k-accent)" }}>next one here.</span>
              </>
            }
            lead="Start with the free Agent Consultation — a tailored plan and a live mockup of your system, in under a minute of questions."
            primary={{ label: "Start your consultation", href: "/start" }}
            secondary={{ label: "Book a call", href: "/book" }}
            note="Free · no commitment · UK-based, global reach"
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
