import { redirect } from "next/navigation";
import { createClient } from "@nullshift/db";
import { getActiveSubscription } from "@nullshift/billing/subscriptions";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";
import { LearnNav } from "../_components/LearnNav";
import { T } from "@nullshift/ui/tokens";


export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseBrowserConfig()) {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not signed in → go to login
  if (!user) {
    redirect("/learn/login");
  }

  const subscription = await getActiveSubscription();

  if (!subscription) {
    // Signed in but no active subscription → send to Stripe checkout.
    // Use the plan stored on their profile, or fall back to pricing.
    const tier = (user.app_metadata?.subscription_tier as string | undefined) ?? "";
    const dest = tier
      ? `/onboard?plan=${encodeURIComponent(tier)}`
      : "/pricing";
    redirect(dest);
  }

  return (
    <div className="flex min-h-screen" style={{ background: T.bg }}>
      <LearnNav tier={subscription.tier} email={user.email ?? ""} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
