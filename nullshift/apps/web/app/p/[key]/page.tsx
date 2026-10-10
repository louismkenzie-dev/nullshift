import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePublicEmbed } from "@/lib/plan-embed/data";
import { PlanQuestionnaire } from "@/components/plan-embed/PlanQuestionnaire";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PlanEmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ embed?: string; ref?: string }>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const hit = await resolvePublicEmbed(key);
  if (!hit) notFound();
  const embedded = sp.embed === "1";
  const dark = hit.embed.brand.dark;
  return (
    <div
      style={{
        minHeight: embedded ? undefined : "100vh",
        background: embedded ? "transparent" : dark ? "#0a0b0f" : "#f4f4f1",
        padding: embedded ? 4 : "48px 16px",
        display: "flex",
        justifyContent: "center",
        alignItems: embedded ? "flex-start" : "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <PlanQuestionnaire
          brand={hit.embed.brand}
          intro={hit.embed.intro}
          publicKey={key}
          poweredBy={hit.trialing || !hit.embed.hide_powered_by}
          embedded={embedded}
          sourceUrl={sp.ref ?? null}
        />
      </div>
    </div>
  );
}
