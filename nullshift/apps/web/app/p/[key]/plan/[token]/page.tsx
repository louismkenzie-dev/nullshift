import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLeadByToken, resolvePublicEmbed } from "@/lib/plan-embed/data";
import { PlanView } from "@/components/plan-embed/PlanView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function HostedPlanPage({
  params,
}: {
  params: Promise<{ key: string; token: string }>;
}) {
  const { key, token } = await params;
  const [hit, lead] = await Promise.all([resolvePublicEmbed(key), getLeadByToken(token)]);
  if (!hit || !lead || lead.embed_id !== hit.embed.id) notFound();
  if (lead.status !== "ready" || !lead.plan) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#4b5563",
          padding: 20,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.4rem", color: "#111" }}>
            {lead.status === "failed"
              ? "This plan could not be written"
              : "Your plan is still being written"}
          </h1>
          <p>
            {lead.status === "failed"
              ? `${hit.embed.brand.name} has been told and will be in touch.`
              : "Refresh in a moment — it usually takes under a minute."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <PlanView
      plan={lead.plan}
      brand={hit.embed.brand}
      businessName={lead.business_name}
      forName={lead.name}
      poweredBy={hit.trialing || !hit.embed.hide_powered_by}
    />
  );
}
