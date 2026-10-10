import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePublicSite } from "@/lib/legal-docs/data";
import { DOC_TITLE, enabledDocs } from "@/lib/legal-docs/generate";
import { HostedShell } from "@/components/legal-docs/HostedDoc";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hit = await resolvePublicSite(slug);
  if (!hit) return { robots: { index: false } };
  const b = hit.site.facts.tradingName || hit.site.facts.legalName;
  return { title: `Legal — ${b}`, description: `Privacy, cookies and terms for ${b}.` };
}

export default async function HostedIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hit = await resolvePublicSite(slug);
  if (!hit) notFound();
  const { site } = hit;
  const business = site.facts.tradingName || site.facts.legalName;
  const docs = enabledDocs(site.facts).map((k) => ({ key: k, title: DOC_TITLE[k] }));
  return (
    <HostedShell
      business={business}
      slug={slug}
      docs={docs}
      colour={site.brand.colour}
      poweredBy={hit.trialing}
    >
      <div
        style={{ maxWidth: 760, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}
      >
        <h1 style={{ fontSize: "1.8rem", marginBottom: 8 }}>Legal</h1>
        <p style={{ color: "#4b5563" }}>
          How {business} handles your data and the rules for using {site.facts.websiteUrl}
          .
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: 24,
            display: "grid",
            gap: 10,
          }}
        >
          {docs.map((d) => (
            <li key={d.key}>
              <a
                href={`/l/${slug}/${d.key}`}
                style={{
                  display: "block",
                  padding: "16px 18px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  color: "#111",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {d.title} →
              </a>
            </li>
          ))}
        </ul>
      </div>
    </HostedShell>
  );
}
