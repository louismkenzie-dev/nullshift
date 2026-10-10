import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hostedUrl, resolvePublicSite } from "@/lib/legal-docs/data";
import {
  DOC_TITLE,
  enabledDocs,
  generateDoc,
  type DocKey,
} from "@/lib/legal-docs/generate";
import { HostedDoc, HostedShell } from "@/components/legal-docs/HostedDoc";

export const dynamic = "force-dynamic";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; doc: string }>;
}): Promise<Metadata> {
  const { slug, doc } = await params;
  const hit = await resolvePublicSite(slug);
  if (!hit || !(doc in DOC_TITLE)) return { robots: { index: false } };
  const b = hit.site.facts.tradingName || hit.site.facts.legalName;
  return { title: `${DOC_TITLE[doc as DocKey]} — ${b}` };
}

export default async function HostedDocPage({
  params,
}: {
  params: Promise<{ slug: string; doc: string }>;
}) {
  const { slug, doc } = await params;
  const hit = await resolvePublicSite(slug);
  if (!hit || !(doc in DOC_TITLE)) notFound();
  const key = doc as DocKey;
  const { site } = hit;
  if (!enabledDocs(site.facts).includes(key)) notFound();
  const business = site.facts.tradingName || site.facts.legalName;
  const d = generateDoc(key, site.facts, hostedUrl(slug));
  const docs = enabledDocs(site.facts).map((k) => ({ key: k, title: DOC_TITLE[k] }));
  return (
    <HostedShell
      business={business}
      slug={slug}
      docs={docs}
      colour={site.brand.colour}
      poweredBy={hit.trialing}
    >
      <HostedDoc
        doc={d}
        business={business}
        version={site.version}
        updated={fmt(site.updated_at)}
        colour={site.brand.colour}
      />
    </HostedShell>
  );
}
