import { z } from "zod";

/**
 * Single source of truth for environment variables across the monorepo.
 *
 * Design notes:
 * - Validation is LAZY (call `getServerEnv()` / `getClientEnv()`), never at
 *   import time, so a missing optional var can't break `next build` in CI.
 * - Most vars are optional: the app already degrades gracefully when Supabase /
 *   Resend / Stripe are unconfigured (see `hasSupabaseBrowserConfig`).
 * - Only `NEXT_PUBLIC_*` vars may be read in the browser.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ADMIN_EMAILS: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_AUDIENCE_ID: z.string().optional(),
  ENQUIRY_NOTIFY_EMAIL: z.string().optional(),
  ENQUIRY_FROM_EMAIL: z.string().optional(),
  FUNNEL_RESOURCE_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServer: ServerEnv | null = null;
let cachedClient: ClientEnv | null = null;

/** Validate + return server-side env. Throws only on a genuinely malformed value. */
export function getServerEnv(): ServerEnv {
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${parsed.error.toString()}`);
  }
  cachedServer = parsed.data;
  return cachedServer;
}

/** Validate + return browser-safe env (NEXT_PUBLIC_* only). */
export function getClientEnv(): ClientEnv {
  if (cachedClient) return cachedClient;
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(`Invalid client environment variables:\n${parsed.error.toString()}`);
  }
  cachedClient = parsed.data;
  return cachedClient;
}

/** True when the public Supabase config is present (browser-safe check). */
export function hasSupabaseBrowserConfig(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
