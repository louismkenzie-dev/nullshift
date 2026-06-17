import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export function getSiteUrl(fallbackOrigin?: string | null): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? fallbackOrigin ?? "http://localhost:3000";
  return siteUrl.replace(/\/$/, "");
}

/** Generate a cryptographically random 6-digit numeric code. */
export function generateVerificationCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, "0");
}

/** Send a 6-digit code confirmation email via Resend. */
export async function sendConfirmationEmail({
  to,
  name,
  code,
  idempotencyKey,
}: {
  to: string;
  name: string;
  code: string;
  idempotencyKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const from = process.env.RESEND_FROM_EMAIL || "Nullshift <onboarding@resend.dev>";
  const resend = new Resend(apiKey);

  // Split code into individual digits for the big display blocks
  const digits = code.split("");

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: `${code} is your Nullshift verification code`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 28px;background:#09090b;color:#fafafa;border-radius:16px;">
        <p style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#10b981;margin:0 0 28px;">NULLSHIFT / VERIFY YOUR EMAIL</p>
        <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.02em;margin:0 0 12px;line-height:1.1;">Hi ${name},<br/>here&rsquo;s your code.</h1>
        <p style="color:#a1a1a6;font-size:15px;line-height:1.65;margin:0 0 32px;">Enter the 6-digit code below on the Nullshift sign-up page to verify your email address. It expires in <strong style="color:#fafafa;">15 minutes</strong>.</p>

        <!-- Code display -->
        <div style="display:flex;gap:8px;margin-bottom:36px;">
          ${digits.map(d => `<div style="width:48px;height:60px;background:#131316;border:1.5px solid #27272a;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;letter-spacing:0;color:#fafafa;text-align:center;line-height:60px;">${d}</div>`).join("")}
        </div>

        <p style="color:#3d3d42;font-size:12px;line-height:1.6;margin:0;">
          If you didn&rsquo;t create a Nullshift account, you can safely ignore this email.<br/>
          Do not share this code with anyone.
        </p>
      </div>
    `,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
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
    if (error) throw error;

    const user = data.users.find(
      (u: User) => u.email?.toLowerCase() === normalized
    );
    if (user) return user;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

// ── Kept for backwards compatibility (resend-confirmation route) ──────────────

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
  return `${siteUrl}/onboard?plan=${encodeURIComponent(plan.toLowerCase())}`;
}
