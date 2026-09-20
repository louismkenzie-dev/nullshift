import { permanentRedirect } from "next/navigation";
import { legacyNextTarget } from "@/lib/next/legacyRedirect";

/**
 * /admin/next/* was the redesign's prototype mount point. The redesigned
 * pages are now the admin itself, so every old URL 308s to its new home
 * (see lib/next/legacyRedirect.ts for the map).
 */
export const dynamic = "force-dynamic";

export default async function LegacyNextRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { rest } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (typeof v === "string") qs.set(k, v);
  }
  permanentRedirect(legacyNextTarget(rest, qs.toString()));
}
