/**
 * Instagram Graph API client (content publishing) and the Facebook Login
 * token helpers. Researched against developers.facebook.com on 2026-10-09:
 * Graph API v25.0.
 *
 * Publishing flow (Instagram API with Facebook Login):
 *   POST /{ig-user-id}/media            → container id
 *     image_url | video_url (+ media_type=REELS | STORIES; CAROUSEL with
 *     children; is_carousel_item=true on children)
 *   GET  /{container-id}?fields=status_code  → IN_PROGRESS | FINISHED | ERROR | EXPIRED | PUBLISHED
 *   POST /{ig-user-id}/media_publish    → media id
 *   POST /{media-id}/comments           → first comment
 *
 * Token flow:
 *   https://www.facebook.com/v25.0/dialog/oauth           (login dialog)
 *   GET /oauth/access_token?code=…                        (short-lived user token)
 *   GET /oauth/access_token?grant_type=fb_exchange_token  (long-lived, ~60 days)
 *   GET /me/accounts?fields=id,name,instagram_business_account
 *
 * Pure HTTP; no Supabase, no logging of tokens. Every error is sanitised
 * before it leaves this module.
 */

import { sanitiseSocialError } from "./crypto";
import type { MediaItem, PostKind } from "./rules";

export const GRAPH_VERSION = "v25.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const FB_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

/** Scopes needed to list the Page, read its IG account and publish. */
export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
] as const;

export class InstagramApiError extends Error {
  code: number | null;
  subcode: number | null;
  constructor(
    message: string,
    code: number | null = null,
    subcode: number | null = null
  ) {
    super(sanitiseSocialError(message));
    this.name = "InstagramApiError";
    this.code = code;
    this.subcode = subcode;
  }
  /** Meta error codes that mean the token is dead and reconnecting is needed. */
  get tokenInvalid(): boolean {
    return this.code === 190 || this.code === 102 || this.code === 10;
  }
}

export type MetaEnv = { appId: string; appSecret: string };

export function readMetaEnv():
  | { ok: true; value: MetaEnv }
  | { ok: false; missing: string[] } {
  const missing: string[] = [];
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId) missing.push("META_APP_ID");
  if (!appSecret) missing.push("META_APP_SECRET");
  if (!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim())
    missing.push("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (missing.length || !appId || !appSecret) return { ok: false, missing };
  return { ok: true, value: { appId, appSecret } };
}

export const isMetaConfigured = (): boolean => readMetaEnv().ok;

type GraphError = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

async function graph<T>(
  path: string,
  init: {
    method?: "GET" | "POST";
    params?: Record<string, string | undefined>;
    token?: string;
  }
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, "")}`);
  const params = { ...(init.params ?? {}) };
  if (init.token) params.access_token = init.token;
  let res: Response;
  if (init.method === "POST") {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, v);
    res = await fetch(url, { method: "POST", body, cache: "no-store" });
  } else {
    for (const [k, v] of Object.entries(params))
      if (v !== undefined) url.searchParams.set(k, v);
    res = await fetch(url, { cache: "no-store" });
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // fallthrough: non-JSON body
  }
  if (!res.ok) {
    const e = (json as GraphError | null)?.error;
    throw new InstagramApiError(
      e?.message ?? `Graph API ${res.status} on ${path}`,
      e?.code ?? res.status,
      e?.error_subcode ?? null
    );
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Facebook Login helpers
// ---------------------------------------------------------------------------

export function buildLoginUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(FB_DIALOG);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  return url.toString();
}

export async function exchangeCode(
  env: MetaEnv,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in?: number }> {
  return graph("oauth/access_token", {
    params: {
      client_id: env.appId,
      client_secret: env.appSecret,
      redirect_uri: redirectUri,
      code,
    },
  });
}

/** Short-lived user token → long-lived (about 60 days). */
export async function exchangeForLongLived(
  env: MetaEnv,
  shortLived: string
): Promise<{ access_token: string; expires_in?: number }> {
  return graph("oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: env.appId,
      client_secret: env.appSecret,
      fb_exchange_token: shortLived,
    },
  });
}

export type FacebookPage = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id: string };
};

export async function listPages(userToken: string): Promise<FacebookPage[]> {
  const r = await graph<{ data?: FacebookPage[] }>("me/accounts", {
    params: { fields: "id,name,access_token,instagram_business_account", limit: "50" },
    token: userToken,
  });
  return r.data ?? [];
}

/** The first Page that has a linked Instagram professional account. */
export function pickInstagramPage(pages: FacebookPage[]): FacebookPage | null {
  return pages.find((p) => p.instagram_business_account?.id) ?? null;
}

export type InstagramAccountInfo = { id: string; username: string; name?: string };

export async function getAccountInfo(
  igUserId: string,
  token: string
): Promise<InstagramAccountInfo> {
  return graph(igUserId, { params: { fields: "id,username,name" }, token });
}

/** Debug a token to learn its expiry (seconds since epoch; 0 = never). */
export async function tokenExpiry(env: MetaEnv, token: string): Promise<Date | null> {
  try {
    const r = await graph<{ data?: { expires_at?: number; is_valid?: boolean } }>(
      "debug_token",
      {
        params: { input_token: token, access_token: `${env.appId}|${env.appSecret}` },
      }
    );
    const exp = r.data?.expires_at;
    if (!exp) return null;
    return new Date(exp * 1000);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Content publishing
// ---------------------------------------------------------------------------

export type ContainerStatus =
  | "IN_PROGRESS"
  | "FINISHED"
  | "ERROR"
  | "EXPIRED"
  | "PUBLISHED";

export async function createMediaContainer(
  igUserId: string,
  token: string,
  params: Record<string, string | undefined>
): Promise<string> {
  const r = await graph<{ id?: string }>(`${igUserId}/media`, {
    method: "POST",
    params,
    token,
  });
  if (!r.id) throw new InstagramApiError("Container id missing from Graph response.");
  return r.id;
}

export async function getContainerStatus(
  containerId: string,
  token: string
): Promise<{ status: ContainerStatus; detail?: string }> {
  const r = await graph<{ status_code?: ContainerStatus; status?: string }>(containerId, {
    params: { fields: "status_code,status" },
    token,
  });
  return { status: r.status_code ?? "IN_PROGRESS", detail: r.status };
}

/**
 * Poll until FINISHED (or a terminal failure). Instagram recommends once a
 * minute for up to five minutes; we poll faster at first because images
 * usually finish within seconds.
 */
export async function pollContainerStatus(
  containerId: string,
  token: string,
  opts: { maxMs?: number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<void> {
  const maxMs = opts.maxMs ?? 5 * 60 * 1000;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const started = Date.now();
  let wait = 2000;
  for (;;) {
    const { status, detail } = await getContainerStatus(containerId, token);
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED")
      throw new InstagramApiError(`Container ${status}${detail ? `: ${detail}` : ""}`);
    if (Date.now() - started > maxMs)
      throw new InstagramApiError("Container still processing after the polling window.");
    await sleep(wait);
    wait = Math.min(wait * 2, 30000);
  }
}

export async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string
): Promise<string> {
  const r = await graph<{ id?: string }>(`${igUserId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId },
    token,
  });
  if (!r.id) throw new InstagramApiError("Media id missing from media_publish response.");
  return r.id;
}

export async function addComment(
  mediaId: string,
  token: string,
  message: string
): Promise<void> {
  await graph(`${mediaId}/comments`, { method: "POST", params: { message }, token });
}

export async function contentPublishingLimit(
  igUserId: string,
  token: string
): Promise<{ quota_usage: number; config?: { quota_total?: number } } | null> {
  try {
    const r = await graph<{
      data?: { quota_usage: number; config?: { quota_total?: number } }[];
    }>(`${igUserId}/content_publishing_limit`, {
      params: { fields: "quota_usage,config" },
      token,
    });
    return r.data?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Build the /media params for a single (non-carousel) item. */
export function containerParamsFor(
  kind: PostKind,
  item: MediaItem,
  caption: string,
  opts: { carouselChild?: boolean } = {}
): Record<string, string | undefined> {
  const base: Record<string, string | undefined> = {};
  if (item.type === "image") {
    base.image_url = item.url;
    if (item.alt && kind !== "story" && kind !== "reel") base.alt_text = item.alt;
  } else {
    base.video_url = item.url;
  }
  if (opts.carouselChild) {
    base.is_carousel_item = "true";
    if (item.type === "video") base.media_type = "VIDEO";
    return base;
  }
  if (kind === "reel") {
    base.media_type = "REELS";
    base.share_to_feed = "true";
  } else if (kind === "story") {
    base.media_type = "STORIES";
  } else if (kind === "feed" && item.type === "video") {
    // Single feed videos are published as Reels on the current API.
    base.media_type = "REELS";
    base.share_to_feed = "true";
  }
  if (kind !== "story" && caption.trim()) base.caption = caption;
  return base;
}

/**
 * Publish one post end to end. Returns the published media id. The caller
 * owns state transitions and error persistence.
 */
export async function publishPost(
  igUserId: string,
  token: string,
  post: {
    kind: PostKind;
    caption: string;
    media: MediaItem[];
    first_comment?: string | null;
  },
  opts: { sleep?: (ms: number) => Promise<void> } = {}
): Promise<{ mediaId: string; firstCommentOk: boolean | null }> {
  let containerId: string;
  if (post.kind === "carousel") {
    const children: string[] = [];
    for (const item of post.media) {
      const id = await createMediaContainer(
        igUserId,
        token,
        containerParamsFor("carousel", item, "", { carouselChild: true })
      );
      await pollContainerStatus(id, token, { sleep: opts.sleep });
      children.push(id);
    }
    containerId = await createMediaContainer(igUserId, token, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: post.caption.trim() || undefined,
    });
  } else {
    const item = post.media[0];
    if (!item) throw new InstagramApiError("No media on the post.");
    containerId = await createMediaContainer(
      igUserId,
      token,
      containerParamsFor(post.kind, item, post.caption)
    );
  }
  await pollContainerStatus(containerId, token, { sleep: opts.sleep });
  const mediaId = await publishContainer(igUserId, token, containerId);

  let firstCommentOk: boolean | null = null;
  if (post.first_comment?.trim() && post.kind !== "story") {
    try {
      await addComment(mediaId, token, post.first_comment.trim());
      firstCommentOk = true;
    } catch {
      firstCommentOk = false;
    }
  }
  return { mediaId, firstCommentOk };
}
