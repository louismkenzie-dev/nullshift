import { createClient } from "@/lib/supabase/server";

export type SubscriptionTier = "core" | "grow" | "pro" | "partner";

export interface Subscription {
  tier: SubscriptionTier;
  status: "active" | "cancelled" | "past_due" | "trialing";
  ends_at: string | null;
}

/** Minimum tier required to access a given resource */
const TIER_RANK: Record<SubscriptionTier, number> = {
  core: 1,
  grow: 2,
  pro: 3,
  partner: 4,
};

export function tierHasAccess(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

/** Fetch the active subscription for the currently authenticated user. Returns null if none. */
export async function getActiveSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status, ends_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return data ?? null;
}
