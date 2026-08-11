import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import { Eyebrow, Display, Lead } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";

const SITE_URL = "https://nullshift.co.uk";
// Laura West (New Future Therapy) — on-camera testimonial, shared with her
// explicit permission. Streamed via the Drive player until the self-hosted
// copy lands (swap src only).
const TESTIMONIAL_EMBED =
  "https://drive.google.com/file/d/1WQISYrokiJQjrONGmSA-p-3GCZUJfzJp/preview";

export const metadata: Metadata = {
  title: "Client stories — Nullshift",
  description:
    "Real Nullshift clients on the systems we build and run for them — including Laura West of New Future Therapy on working with us.",
  alternates: { canonical: "/work" },
};

// Video + review structured data — a named client on camera is the strongest
// citation an answer engine can pick up.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "VideoObject",
      name: "Client testimonial — Laura West, New Future Therapy",
      description:
        "Laura West of New Future Therapy shares her experience of having Nullshift design, build and run her practice's bespoke system.",
      embedUrl: TESTIMONIAL_EMBED,
      uploadDate: "2026-08-11",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Review",
      itemReviewed: { "@id": `${SITE_URL}/#organization` },
      author: { "@type": "Person", name: "Laura West" },
      name: "Video testimonial from New Future Therapy",
      reviewBody:
        "Video testimonial from Laura West of New Future Therapy on working with Nullshift.",
    },
  ],
};

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export default function WorkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />
      <main>
        <section
          className="k-dark relative overflow-hidden"
          style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
        >
          <div
            aria-hidden
            className="k-vgrid absolute inset-0 pointer-events-none"
            style={{ opacity: 0.35 }}
          />
          <div
            className="relative mx-auto px-5 sm:px-10"
            style={{ maxWidth: 1100, paddingTop: 140, paddingBottom: 90 }}
          >
            {/* ── Hero ── */}
            <Reveal>
              <div className="flex flex-col gap-4" style={{ maxWidth: 720 }}>
                <Eyebrow index="01" label="CLIENT STORIES" />
                <Display as="h1" size="lg">
                  Built for them.
                  <br />
                  <span style={{ color: "var(--k-accent)" }}>Owned by them.</span>
                </Display>
                <Lead>
                  Every Nullshift system belongs to the business it was built for — the
                  code, the data, the accounts. Here&apos;s what that&apos;s like from
                  the client&apos;s side of the table.
                </Lead>
              </div>
            </Reveal>

            {/* ── Video testimonial ── */}
            <Reveal className="block" delay={0.08}>
              <div
                className="k-kard"
                style={{
                  marginTop: 56,
                  background: "var(--k-surface)",
                  borderColor: "var(--k-accent)",
                  overflow: "hidden",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                  style={{
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--k-border)",
                  }}
                >
                  <span style={{ ...mono, color: "var(--k-accent)" }}>
                    {"// VIDEO TESTIMONIAL"}
                  </span>
                  <span style={{ ...mono, color: "var(--k-muted)" }}>
                    Laura West · New Future Therapy
                  </span>
                </div>
                <div style={{ aspectRatio: "16 / 9", background: "#000" }}>
                  <iframe
                    src={TESTIMONIAL_EMBED}
                    title="Laura West of New Future Therapy — on working with Nullshift"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                  />
                </div>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.9rem",
                    lineHeight: 1.65,
                    color: "var(--k-muted)",
                    padding: "14px 18px",
                  }}
                >
                  <span style={{ color: "var(--k-fg)", fontWeight: 600 }}>
                    Laura West
                  </span>{" "}
                  runs New Future Therapy. Nullshift designed, built and now runs her
                  practice&apos;s bespoke system — shared here with her permission.
                </p>
              </div>
            </Reveal>

            {/* ── Case snapshots ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: 28 }}>
              <Reveal delay={0.05}>
                <div
                  className="k-kard k-kard-h flex flex-col gap-2 h-full"
                  style={{ background: "var(--k-surface)", padding: "20px 22px" }}
                >
                  <span style={{ ...mono, color: "var(--k-accent)" }}>
                    New Future Therapy
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    Practice system
                  </span>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      lineHeight: 1.6,
                      color: "var(--k-muted)",
                    }}
                  >
                    A bespoke system for a therapy practice — built, hosted and cared
                    for by Nullshift, owned outright by the practice.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div
                  className="k-kard k-kard-h flex flex-col gap-2 h-full"
                  style={{ background: "var(--k-surface)", padding: "20px 22px" }}
                >
                  <span style={{ ...mono, color: "var(--k-accent)" }}>
                    Dance school · Suffolk
                  </span>
                  <span
                    style={{
                      fontFamily: T.sans,
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                    }}
                  >
                    Bookings &amp; payments
                  </span>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.88rem",
                      lineHeight: 1.6,
                      color: "var(--k-muted)",
                    }}
                  >
                    Multi-venue class booking with payments through the school&apos;s
                    own Stripe account, automated parent emails, and a simple admin
                    for staff.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* ── CTA ── */}
            <Reveal className="block" delay={0.12}>
              <div
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                style={{
                  marginTop: 48,
                  padding: "22px 24px",
                  border: "1px solid var(--k-border)",
                  background: "var(--k-surface)",
                }}
              >
                <p
                  style={{
                    fontFamily: T.sans,
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color: "var(--k-fg)",
                  }}
                >
                  Your business could be next
                </p>
                <Link href="/start" className="kb kb-primary">
                  Get my free plan
                  <span className="k-arrow" aria-hidden>
                    →
                  </span>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
