import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePublicWidget } from "@/lib/quote-widget/data";
import { QuoteWidget } from "@/components/quote-widget/QuoteWidget";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Hosted widget page — standalone link or the document inside the embed iframe. */
export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ embed?: string; ref?: string }>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const hit = await resolvePublicWidget(key);
  if (!hit) notFound();
  const embedded = sp.embed === "1";
  const dark = hit.widget.config.brand.dark;
  return (
    <div
      style={{
        minHeight: embedded ? undefined : "100vh",
        background: embedded ? "transparent" : dark ? "#0a0b0f" : "#f4f4f1",
        padding: embedded ? 4 : "48px 16px",
        display: "flex",
        alignItems: embedded ? "flex-start" : "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <QuoteWidget
          config={hit.widget.config}
          publicKey={key}
          poweredBy={hit.trialing}
          embedded={embedded}
          sourceUrl={sp.ref ?? null}
        />
      </div>
    </div>
  );
}
