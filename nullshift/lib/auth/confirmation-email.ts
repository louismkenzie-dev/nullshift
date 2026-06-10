import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export function getSiteUrl(fallbackOrigin?: string | null): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? fallbackOrigin ?? "http://localhost:3000";
  return siteUrl.replace(/\/$/, "");
}

export function isAllowedRedirect(url: string, siteUrl: string): boolean {
  try {
    const target = new URL(url);
    const allowedOrigins = new Set([
      new URL(siteUrl).origin,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
    return allowedOrigins.has(target.origin);
  } catch {
    return false;
  }
}

export function buildOnboardRedirect(siteUrl: string, plan: string): string {
  return `${siteUrl}/onboard?plan=${encodeURIComponent(plan.toLowerCase())}&confirmed=true`;
}

export function buildConfirmUrl(
  siteUrl: string,
  tokenHash: string,
  type: string,
  redirectTo: string
): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type,
    redirect_to: redirectTo,
  });
  return `${siteUrl}/api/auth/confirm-email?${params.toString()}`;
}

export async function sendConfirmationEmail({
  to,
  name,
  confirmUrl,
}: {
  to: string;
  name: string;
  confirmUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const from =
    process.env.RESEND_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: [to],
    subject: "Confirm your email address",
    html: `<p>Hello ${name},</p><p>Please confirm your email address by clicking <a href="${confirmUrl}">here</a>.</p>`,
  });
}

export async function findUserByEmail(
  serviceClient: SupabaseClient,
  email: string
): Promise<User | null> {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (u: User) => u.email?.toLowerCase() === normalized
    );
    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}
