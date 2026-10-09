import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import { PRODUCT_SLUGS, formatMonthly, productBySlug } from "@nullshift/content/products";
import {
  Reveal,
  Section,
  Container,
  Eyebrow,
  Display,
  Lead,
  SectionHeader,
  CTABand,
  Accordion,
  BtnPrimary,
  BtnGhost,
  MonoTag,
  type FAQItem,
} from "@/components/kyma";

export function generateStaticParams() {
  return PRODUCT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = productBySlug(slug);
  if (!p) return {};
  return {
    title: `${p.title} — ${p.tagline}`,
    description: `${p.tagline} ${p.audience} ${formatMonthly(p.pricePence)}, ${p.trialDays}-day free trial.`,
    alternates: { canonical: `/products/${p.slug}` },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = productBySlug(slug);
  if (!p) notFound();
  const faqs: FAQItem[] = p.faqs.map((f) => ({ q: f.q, a: f.a }));
  const signup = `/app/signup?next=${encodeURIComponent(`/app?start=${p.slug}`)}`;

  return (
    <>
      <Nav />
      <main>
        <Section theme="dark" pad="lg" grid>
          <Reveal>
            <Eyebrow index={p.index} label={p.title} />
            <div style={{ marginTop: 20, maxWidth: "20ch" }}>
              <Display as="h1" size="hero" caps={false}>
                {p.tagline}
              </Display>
            </div>
            <Lead style={{ marginTop: 24 }}>{p.audience}</Lead>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <BtnPrimary href={signup}>Start {p.trialDays}-day free trial</BtnPrimary>
              <BtnGhost href="/products">All products</BtnGhost>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.7rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                }}
              >
                Then {formatMonthly(p.pricePence)} · cancel any month
              </span>
            </div>
          </Reveal>
        </Section>

        <Section theme="cream" pad="md" topBorder>
          <Container>
            <SectionHeader index="01" label="How it works" title="Three steps" />
            <div
              className="mt-12 grid gap-px md:grid-cols-3"
              style={{ background: "var(--k-border)" }}
            >
              {p.steps.map((s, i) => (
                <Reveal key={s.title}>
                  <div
                    className="flex h-full flex-col gap-4 p-8"
                    style={{ background: "var(--k-bg)" }}
                  >
                    <MonoTag>{String(i + 1).padStart(2, "0")}</MonoTag>
                    <Display as="h3" size="sm">
                      {s.title}
                    </Display>
                    <p
                      style={{
                        fontFamily: T.sans,
                        lineHeight: 1.65,
                        color: "var(--k-muted)",
                      }}
                    >
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        <Section theme="dark" pad="md" topBorder>
          <Container>
            <SectionHeader
              index="02"
              label="What you get"
              title={`Everything in ${p.name}`}
            />
            <ul className="mt-10 grid gap-x-10 gap-y-5 md:grid-cols-2">
              {p.features.map((f) => (
                <Reveal key={f}>
                  <li
                    className="flex gap-4"
                    style={{
                      fontFamily: T.sans,
                      fontSize: "1.05rem",
                      lineHeight: 1.6,
                      color: "var(--k-fg)",
                      borderTop: "1px solid var(--k-border)",
                      paddingTop: 16,
                    }}
                  >
                    <span style={{ color: "var(--k-accent)" }} aria-hidden>
                      ↳
                    </span>
                    {f}
                  </li>
                </Reveal>
              ))}
            </ul>
          </Container>
        </Section>

        <Section theme="cream" pad="md" topBorder>
          <Container width="narrow">
            <SectionHeader
              index="03"
              label="Price"
              title={formatMonthly(p.pricePence)}
              lead={`One flat monthly price. ${p.trialDays}-day free trial with no card. ${Object.entries(
                p.limits
              )
                .map(([k, v]) => `${v} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`)
                .join(", ")} included.`}
            />
            <div className="mt-8">
              <BtnPrimary href={signup}>Start free trial</BtnPrimary>
            </div>
          </Container>
        </Section>

        <Section theme="dark" pad="md" topBorder>
          <Container width="narrow">
            <SectionHeader index="04" label="FAQ" title="Questions" />
            <div className="mt-10">
              <Accordion items={faqs} />
            </div>
          </Container>
        </Section>

        <CTABand
          index="05"
          label="Ready?"
          title={`Try ${p.title} free`}
          lead={`${p.trialDays} days, no card, cancel any month. Or book a call if you need something bespoke.`}
          primary={{ label: "Start free trial", href: signup }}
          secondary={{ label: "Book a call", href: "/book/call" }}
        />
      </main>
      <Footer />
    </>
  );
}
