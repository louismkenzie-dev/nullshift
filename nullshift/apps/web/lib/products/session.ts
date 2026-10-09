import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import type { ProductSlug } from "@nullshift/content/products";
import { ensureProductWorkspace, type ProductWorkspace } from "./workspace";
import { entitlementFor, type Entitlement } from "./entitlement";

export type AppSession = {
  userId: string;
  email: string;
  name: string | null;
  workspace: ProductWorkspace;
};

/**
 * The one guard every /app page and server action calls. Resolves the user
 * and their workspace, or redirects to sign in. Server-only.
 */
export async function requireAppSession(nextPath = "/app"): Promise<AppSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/app/login?next=${encodeURIComponent(nextPath)}`);
  const name = (user.user_metadata?.full_name as string | undefined) ?? null;
  const workspace = await ensureProductWorkspace({
    userId: user.id,
    email: user.email ?? null,
    name,
  });
  return { userId: user.id, email: user.email ?? "", name, workspace };
}

/** Same as requireAppSession, plus the entitlement for one product. */
export async function requireProduct(
  product: ProductSlug,
  nextPath?: string
): Promise<AppSession & { entitlement: Entitlement }> {
  const session = await requireAppSession(nextPath ?? `/app/${product}`);
  const entitlement = await entitlementFor(session.workspace.tenantId, product);
  return { ...session, entitlement };
}

/** Server-action variant: returns null instead of redirecting. */
export async function appSessionOrNull(): Promise<AppSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const name = (user.user_metadata?.full_name as string | undefined) ?? null;
  const workspace = await ensureProductWorkspace({
    userId: user.id,
    email: user.email ?? null,
    name,
  });
  return { userId: user.id, email: user.email ?? "", name, workspace };
}
