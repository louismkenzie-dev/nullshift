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

type MetadataUser = {
  app_metadata?: Record<string, unknown>;
};

function subscriptionFromMetadata(user: MetadataUser) {
  const tier = user.app_metadata?.subscription_tier;
  const status = user.app_metadata?.subscription_status;

  if (
    (tier === "core" || tier === "grow" || tier === "pro" || tier === "partner") &&
    (status === undefined || status === "active")
  ) {
    return {
      tier: tier as SubscriptionTier,
      status: "active" as const,
      ends_at: null,
    };
  }

  return null;
}

/** Fetch the active subscription for the currently authenticated user. Returns null if none. */
export async function getActiveSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("tier, status, ends_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!error && data) {
    return data;
  }

  return subscriptionFromMetadata(user as MetadataUser);
}
