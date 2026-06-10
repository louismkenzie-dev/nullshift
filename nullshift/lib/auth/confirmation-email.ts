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
  idempotencyKey,
}: {
  to: string;
  name: string;
  confirmUrl: string;
  idempotencyKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const from =
    process.env.RESEND_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Confirm your Nullshift account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#09090b;color:#fafafa;border-radius:12px;">
        <p style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#10b981;margin-bottom:24px;">NULLSHIFT / EMAIL CONFIRMATION</p>
        <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin:0 0 12px;">Confirm your email</h1>
        <p style="color:#a1a1a6;font-size:15px;line-height:1.65;margin:0 0 32px;">Hi ${name}, click the button below to confirm your email address and activate your account.</p>
        <a href="${confirmUrl}" style="display:inline-block;background:#10b981;color:#131316;font-weight:700;font-size:13px;letter-spacing:0.06em;padding:12px 24px;border-radius:8px;text-decoration:none;">Confirm email →</a>
        <p style="color:#3d3d42;font-size:12px;margin-top:32px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
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
