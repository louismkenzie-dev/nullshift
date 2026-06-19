import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";
import { Footer } from "@/components/Footer";
import { ScalingPlan } from "@/components/funnel/ScalingPlan";
import type { ScalingPlan as ScalingPlanData } from "@nullshift/content/scalingPlan";

/**
 * The permanent, shareable home of a prospect's auto-generated Free Scaling Plan.
 * Reached by an unguessable plan_token (minted in the funnel, persisted on the
 * lead). Read via the trusted service client (leads are staff-only under RLS);
 * the token is the capability. Renders the same ScalingPlan component as the
 * funnel result, so the page and the in-funnel reveal never drift.
 */
export const dynamic = "force-dynamic";

type StoredPlan = {
  scalingPlan?: ScalingPlanData;
  businessName?: string;
  name?: string;
};

async function loadPlan(token: string): Promise<StoredPlan | null> {
  // Guard obvious junk before hitting the DB.
  if (!/^[0-9a-f-]{8,}$/i.test(token)) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("leads")
      .select("name, plan")
      .eq("plan_token", token)
      .maybeSingle();
    return (data?.plan as StoredPlan | null) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const plan = await loadPlan(token);
  const who = plan?.businessName || plan?.name;
  return {
    title: who
      ? `Scaling plan — ${who} · Nullshift`
      : "Your free scaling plan · Nullshift",
    robots: { index: false, follow: false }, // private to the recipient
  };
}

export default async function PlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const plan = await loadPlan(token);
  if (!plan?.scalingPlan) notFound();

  const first = plan.name?.split(" ")[0];

  return (
    <div style={{ background: T.bg, minHeight: "100dvh" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-8"
        style={{
          height: 60,
          borderBottom: `1px solid ${T.border}`,
          background: `${T.bg}f0`,
          backdropFilter: "blur(12px)",
        }}
      >
        <Link href="/" aria-label="Nullshift home">
          <Logo markSize={18} />
        </Link>
        <Link
          href="/book"
          className="inline-flex items-center font-medium"
          style={{
            height: 38,
            paddingInline: 16,
            background: T.primary,
            color: T.primaryFg,
            borderRadius: T.r.md,
            fontFamily: T.sans,
            fontSize: "0.85rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Book a call
        </Link>
      </header>

      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "clamp(28px,6vw,56px) 20px 64px",
        }}
      >
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.primary,
            marginBottom: 10,
          }}
        >
          // Your free scaling plan
        </div>
        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "clamp(2rem,5.5vw,3rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: T.fg,
          }}
        >
          {plan.businessName
            ? `A scaling plan for ${plan.businessName}.`
            : first
              ? `${first}, here's your scaling plan.`
              : "Your free scaling plan."}
        </h1>
        <p
          className="mt-4 mb-9"
          style={{
            fontFamily: T.sans,
            fontSize: "1.0625rem",
            lineHeight: 1.6,
            color: T.muted,
            maxWidth: "54ch",
          }}
        >
          Where you are now, the software you could stop renting, and what we&apos;d build
          and own in its place — tailored to your business. Saved here for whenever
          you&apos;re ready.
        </p>

        <ScalingPlan plan={plan.scalingPlan} />

        {/* CTA */}
        <div
          className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          style={{ borderTop: `1px solid ${T.border}`, paddingTop: 28 }}
        >
          <Link
            href="/book"
            className="inline-flex items-center justify-center font-medium"
            style={{
              height: 52,
              paddingInline: 28,
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.md,
              fontFamily: T.sans,
              fontSize: "0.9375rem",
              fontWeight: 500,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
              textDecoration: "none",
            }}
          >
            Book a call to make it real →
          </Link>
          <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.faint }}>
            Free · 30 minutes · we turn this into a fixed quote.
          </span>
        </div>
      </main>

      <Footer />
    </div>
  );
}
