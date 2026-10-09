import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import { PRODUCT_LIST, formatMonthly } from "@nullshift/content/products";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  CTABand,
  MonoTag,
} from "@/components/kyma";

export const metadata: Metadata = {
  title: "Products — Nullshift",
  description:
    "Off-the-shelf Nullshift tools for small businesses: an instant quote widget for trades, hosted legal documents, website monitoring, an AI plan generator and a white-label client portal. From £12 a month, fourteen-day free trials.",
  alternates: { canonical: "/products" },
};

export default function ProductsPage() {
  return (
    <>
      <Nav />
      <main>
        <Section theme="dark" pad="lg" grid>
          <Reveal>
            <Eyebrow index="00" label="Products" />
            <div style={{ marginTop: 20 }}>
              <Display as="h1" size="hero">
                Small tools.
                <br />
                Monthly price.
              </Display>
            </div>
            <Lead style={{ marginTop: 24 }}>
              Not every business needs a bespoke build. These are the pieces we kept
              rebuilding for clients, packaged so you can switch one on this afternoon.
              Fourteen-day free trial on every product, no card to start, cancel any
              month.
            </Lead>
          </Reveal>
        </Section>

        <Section theme="cream" pad="md" topBorder>
          <div
            className="grid gap-px md:grid-cols-2 lg:grid-cols-3"
            style={{ background: "var(--k-border)" }}
          >
            {PRODUCT_LIST.map((p) => (
              <Reveal key={p.slug}>
                <Link
                  href={`/products/${p.slug}`}
                  className="flex h-full flex-col gap-5 p-8 transition-colors"
                  style={{
                    background: "var(--k-bg)",
                    textDecoration: "none",
                    color: "var(--k-fg)",
                    minHeight: 320,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <MonoTag>{p.index}</MonoTag>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: "0.7rem",
                        letterSpacing: "0.08em",
                        color: "var(--k-muted)",
                      }}
                    >
                      {formatMonthly(p.pricePence)}
                    </span>
                  </div>
                  <Display as="h2" size="md">
                    {p.title}
                  </Display>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "1rem",
                      lineHeight: 1.6,
                      color: "var(--k-muted)",
                    }}
                  >
                    {p.tagline}
                  </p>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.875rem",
                      lineHeight: 1.6,
                      color: "var(--k-faint)",
                    }}
                  >
                    {p.audience}
                  </p>
                  <span
                    className="mt-auto"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.68rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                    }}
                  >
                    See how it works →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section theme="dark" pad="md" topBorder>
          <Container>
            <SectionHeader
              index="06"
              label="Why from us"
              title="Built from the systems we ship to clients"
              lead="Every product here started life inside a bespoke Nullshift build. The pricing engine, the legal pack, the monitoring, the proposal flow: all of it has run in production for paying clients before it became a product."
            />
          </Container>
        </Section>

        <CTABand
          index="07"
          label="Need more than a tool?"
          title="Bespoke is still what we do best"
          lead="If a product here gets you eighty percent of the way, we can build the rest. Start a trial, or book a call about a custom system."
          primary={{ label: "Start a free trial", href: "/app/signup" }}
          secondary={{ label: "Book a call", href: "/book/call" }}
        />
      </main>
      <Footer />
    </>
  );
}
