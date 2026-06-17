import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@nullshift/db";
import type { SubscriptionTier } from "@nullshift/billing/subscriptions";
import { hasSupabaseServerConfig } from "@nullshift/db/env";

const VALID_TIERS = new Set<SubscriptionTier>(["core", "grow", "pro", "partner"]);

export async function POST(request: NextRequest) {
  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const form = await request.formData();
  const rawTier = String(form.get("tier") ?? "").toLowerCase();
  const next = String(form.get("next") ?? "/learn");

  if (!VALID_TIERS.has(rawTier as SubscriptionTier)) {
    return NextResponse.json({ error: "Invalid subscription tier." }, { status: 400 });
  }

  const tier = rawTier as SubscriptionTier;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/learn/login", request.url));
  }

  const admin = createServiceClient();
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!lookupError) {
    const payload = {
      user_id: user.id,
      tier,
      status: "active" as const,
      updated_at: now,
    };

    const mutation = existing
      ? await admin.from("subscriptions").update(payload).eq("id", existing.id)
      : await admin.from("subscriptions").insert({
          ...payload,
          started_at: now,
        });

    if (!mutation.error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      subscription_tier: tier,
      subscription_status: "active",
      subscription_updated_at: now,
    },
  });

  if (metadataError) {
    const message = lookupError?.message ?? metadataError.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.redirect(new URL(next, request.url));
}
