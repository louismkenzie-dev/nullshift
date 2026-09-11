import type { Metadata } from "next";
import React from "react";
import { CLIENT_STORIES } from "@nullshift/content/clientStories";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Reveal, Section, Eyebrow, Display, Lead, CTABand } from "@/components/kyma";
import { ClientStoryGallery } from "@/components/marketing/ClientStoryGallery";
import { ClientStorySection } from "@/components/marketing/ClientStorySection";
import { validateClientStories } from "@/lib/clientStories";

// A bad entry fails `next build` rather than shipping.
validateClientStories(CLIENT_STORIES);

export const metadata: Metadata = {
  title: "Client stories — Nullshift",
  description:
    "Three businesses, three systems they own outright: The Dance Exclusive, NewFuture Therapy and Suffolk Tennis LTA. What they had, what we built, and what runs itself now — with the real numbers.",
  alternates: { canonical: "/client-stories" },
};

export default function ClientStoriesPage() {
  return (
    <>
      <Nav tone="cream" />
      <main>
        {/* Hero + gallery */}
        <Section theme="cream" pad="lg">
          <Reveal>
            <Eyebrow label="Client stories" />
            <Display size="xl" className="mt-5">
              Three businesses.{" "}
              <span style={{ color: "var(--k-muted)" }}>Three systems they own.</span>
            </Display>
            <Lead className="mt-5" style={{ maxWidth: "58ch" }}>
              Not case-study decks — the actual systems, the people running them, and the
              numbers from their own databases. Each one lives in the client&apos;s repo,
              on the client&apos;s database, taking payment through the client&apos;s own
              account.
            </Lead>
          </Reveal>
          <div className="mt-12">
            <ClientStoryGallery stories={CLIENT_STORIES} theme="cream" />
          </div>
        </Section>

        {/* One uniform section per client — dark first, then alternating */}
        {CLIENT_STORIES.map((story, i) => (
          <ClientStorySection key={story.slug} story={story} index={i} />
        ))}

        {/* CTA */}
        <div style={{ borderTop: "1px solid var(--k-border)" }}>
          <CTABand
            theme="dark"
            index={String(CLIENT_STORIES.length + 1).padStart(2, "0")}
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
