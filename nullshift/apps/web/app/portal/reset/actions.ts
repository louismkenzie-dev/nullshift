"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { safePortalNext } from "@/lib/portalLinks";

/**
 * Turn a set-your-password link into a signed-in client with a password.
 *
 * The link carries the HASHED token from admin.generateLink. We verify it here,
 * on the server, with the cookie-writing Supabase client — so the session lands
 * as cookies exactly like a normal login and the browser never has to parse an
 * auth fragment. Then we set the password on that session and send them on.
 *
 * Validation happens BEFORE verifyOtp on purpose: a mistyped confirmation must
 * not burn the single-use token.
 */
export type ResetResult = { ok: false; error: string; expired?: boolean } | null;

const LINK_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email"];

export async function setPasswordFromLink(
  _prev: ResetResult,
  formData: FormData
): Promise<ResetResult> {
  const tokenHash = String(formData.get("token_hash") || "").trim();
  const type = String(formData.get("type") || "").trim() as EmailOtpType;
  const next = safePortalNext(String(formData.get("next") || ""));
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!tokenHash || !LINK_TYPES.includes(type)) {
    return {
      ok: false,
      expired: true,
      error: "This link is incomplete or has expired. Request a fresh one below.",
    };
  }
  if (password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };
  if (password !== confirm) return { ok: false, error: "Passwords don't match." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.session) {
    console.warn(
      "setPasswordFromLink: verifyOtp failed:",
      error?.message ?? "no session"
    );
    return {
      ok: false,
      expired: true,
      error: "This link has expired or was already used. Request a fresh one below.",
    };
  }

  const { error: updErr } = await supabase.auth.updateUser({ password });
  if (updErr) {
    console.error("setPasswordFromLink: updateUser failed:", updErr.message);
    return { ok: false, error: updErr.message || "Could not save your password." };
  }

  // Service-role write: the session we just created lives in cookies this
  // request only SET, so a fresh cookie client can't see it and the RLS insert
  // policy would refuse the row.
  await logAuditAsService({
    action: "portal.password_set_via_link",
    target: data.user ? `user:${data.user.id}` : null,
    metadata: { type, userId: data.user?.id ?? null, email: data.user?.email ?? null },
  });

  redirect(next);
}
