/**
 * Social accounts — server-side persistence (service role). This is the ONLY
 * module that touches `social_account_secrets`, and the only place plaintext
 * tokens exist: decrypted just before a Graph call, never logged, never
 * returned to the browser.
 */

import { createServiceClient } from "@nullshift/db";
import { decryptSocialToken, encryptSocialToken, parseSocialKey } from "./crypto";

export type SocialAccountRow = {
  id: string;
  platform: "instagram" | "facebook" | "linkedin";
  handle: string;
  external_user_id: string;
  page_id: string | null;
  display_name: string | null;
  connected_by: string | null;
  connected_at: string;
  expires_at: string | null;
  status: "connected" | "expired" | "revoked" | "error";
  last_error: string | null;
};

type Service = ReturnType<typeof createServiceClient>;

const key = () => parseSocialKey(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);

export async function connectedInstagramAccount(
  service: Service = createServiceClient()
): Promise<SocialAccountRow | null> {
  const { data } = await service
    .from("social_accounts")
    .select("*")
    .eq("platform", "instagram")
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SocialAccountRow | null) ?? null;
}

/** Store a fresh connection, revoking any previous connected row for the same IG user. */
export async function storeInstagramConnection(input: {
  igUserId: string;
  pageId: string | null;
  handle: string;
  displayName: string | null;
  userId: string;
  accessToken: string;
  expiresAt: Date | null;
}): Promise<{ accountId: string }> {
  const service = createServiceClient();
  const k = key();
  const now = new Date().toISOString();
  await service
    .from("social_accounts")
    .update({ status: "revoked" })
    .eq("platform", "instagram")
    .eq("status", "connected");

  const { data, error } = await service
    .from("social_accounts")
    .insert({
      platform: "instagram",
      handle: input.handle,
      external_user_id: input.igUserId,
      page_id: input.pageId,
      display_name: input.displayName,
      connected_by: input.userId,
      connected_at: now,
      expires_at: input.expiresAt ? input.expiresAt.toISOString() : null,
      status: "connected",
      last_error: null,
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`social_accounts insert failed: ${error?.message ?? "no row"}`);
  const id = (data as { id: string }).id;

  const enc = encryptSocialToken(input.accessToken, k, id);
  const { error: sErr } = await service.from("social_account_secrets").insert({
    account_id: id,
    access_token_ciphertext: enc.ciphertext,
    iv: enc.iv,
    tag: enc.tag,
  });
  if (sErr) {
    await service.from("social_accounts").delete().eq("id", id);
    throw new Error(`social_account_secrets insert failed: ${sErr.message}`);
  }
  return { accountId: id };
}

/** Mark revoked and delete the secrets row. Idempotent. */
export async function revokeSocialAccount(accountId: string): Promise<void> {
  const service = createServiceClient();
  await service.from("social_account_secrets").delete().eq("account_id", accountId);
  await service
    .from("social_accounts")
    .update({ status: "revoked" })
    .eq("id", accountId)
    .eq("status", "connected");
}

/**
 * The plaintext access token for a connected account, or null when there is
 * no secret, the key is missing, or the stored expiry has passed (in which
 * case the row is flipped to `expired` so the page can say so).
 */
export async function accessTokenFor(
  account: SocialAccountRow,
  service: Service = createServiceClient(),
  now: Date = new Date()
): Promise<string | null> {
  if (account.expires_at && new Date(account.expires_at).getTime() <= now.getTime()) {
    await service
      .from("social_accounts")
      .update({ status: "expired" })
      .eq("id", account.id);
    return null;
  }
  const { data } = await service
    .from("social_account_secrets")
    .select("access_token_ciphertext, iv, tag")
    .eq("account_id", account.id)
    .maybeSingle();
  if (!data) return null;
  const row = data as { access_token_ciphertext: string; iv: string; tag: string };
  try {
    return decryptSocialToken(
      { ciphertext: row.access_token_ciphertext, iv: row.iv, tag: row.tag },
      key(),
      account.id
    );
  } catch {
    return null;
  }
}

export async function markAccountError(
  accountId: string,
  message: string,
  tokenDead: boolean
) {
  const service = createServiceClient();
  await service
    .from("social_accounts")
    .update({
      status: tokenDead ? "expired" : "error",
      last_error: message.slice(0, 400),
    })
    .eq("id", accountId);
}
