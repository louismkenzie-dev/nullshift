/**
 * The publisher the cron calls every 15 minutes. For each `scheduled` post
 * whose time has passed:
 *   - a connected Instagram account with a usable token → publish via the
 *     Graph API, set `published` (+ external id);
 *   - otherwise → set `needs_manual` and email Louis the caption, media links
 *     and a mark-as-published link.
 *
 * A post is claimed by flipping scheduled → publishing with the status in the
 * WHERE clause, so two overlapping cron ticks cannot both publish it. A post
 * that was never approved is never picked up (isDue + the 0071 check).
 */

import { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { sendEmail } from "@/lib/sendEmail";
import { sanitiseSocialError } from "./crypto";
import { MANUAL_MODE_RECIPIENT, manualPostEmail } from "./email";
import { InstagramApiError, isMetaConfigured, publishPost } from "./instagram";
import {
  isDue,
  parseMediaList,
  validateMedia,
  type PostKind,
  type PostStatus,
} from "./rules";
import { accessTokenFor, connectedInstagramAccount, markAccountError } from "./store";

export type PostRow = {
  id: string;
  account_id: string | null;
  kind: PostKind;
  caption: string;
  media: unknown;
  first_comment: string | null;
  scheduled_at: string | null;
  status: PostStatus;
  approved_at: string | null;
  pillar: string | null;
};

export type PublishOutcome = {
  ok: boolean;
  checked: number;
  published: string[];
  needsManual: string[];
  failed: { id: string; error: string }[];
  mode: "api" | "manual";
};

const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || "https://nullshift.co.uk").replace(/\/$/, "");

export async function publishDuePosts(now: Date = new Date()): Promise<PublishOutcome> {
  const service = createServiceClient();
  const outcome: PublishOutcome = {
    ok: true,
    checked: 0,
    published: [],
    needsManual: [],
    failed: [],
    mode: "manual",
  };

  const { data, error } = await service
    .from("social_posts")
    .select(
      "id, account_id, kind, caption, media, first_comment, scheduled_at, status, approved_at, pillar"
    )
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(20);
  if (error) {
    outcome.ok = false;
    outcome.failed.push({ id: "query", error: error.message });
    return outcome;
  }
  const rows = (data ?? []) as PostRow[];
  outcome.checked = rows.length;
  if (!rows.length) return outcome;

  // One token lookup per tick.
  let igUserId: string | null = null;
  let token: string | null = null;
  let accountId: string | null = null;
  let reason = "No Instagram account is connected, so this one needs posting by hand.";
  if (isMetaConfigured()) {
    const account = await connectedInstagramAccount(service);
    if (account) {
      token = await accessTokenFor(account, service, now);
      if (token) {
        igUserId = account.external_user_id;
        accountId = account.id;
        outcome.mode = "api";
      } else {
        reason =
          "The Instagram connection has expired; reconnect it under Social → Accounts.";
      }
    }
  } else {
    reason =
      "Instagram publishing is not configured on this deployment, so this one needs posting by hand.";
  }

  for (const row of rows) {
    const due = isDue(row, now);
    if (!due.due) continue;

    // Claim.
    const { data: claimed } = await service
      .from("social_posts")
      .update({ status: "publishing" })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed?.length) continue;

    const media = parseMediaList(row.media);
    const mediaProblems = validateMedia(media, row.kind);

    if (!token || !igUserId || mediaProblems.length) {
      const why = mediaProblems.length
        ? `The media on this post is not publishable by the API (${mediaProblems.map((p) => p.detail).join(" ")}).`
        : reason;
      await parkForManual(service, row, media, why);
      outcome.needsManual.push(row.id);
      continue;
    }

    try {
      const result = await publishPost(igUserId, token, {
        kind: row.kind,
        caption: row.caption,
        media,
        first_comment: row.first_comment,
      });
      await service
        .from("social_posts")
        .update({
          status: "published",
          published_external_id: result.mediaId,
          published_at: new Date().toISOString(),
          account_id: accountId,
          error:
            result.firstCommentOk === false
              ? "Published, but the first comment failed."
              : null,
        })
        .eq("id", row.id);
      await logAuditAsService({
        action: "social_post.published",
        target: `social_post:${row.id}`,
        metadata: {
          kind: row.kind,
          media_id: result.mediaId,
          account_id: accountId,
          late: due.isLate,
        },
      });
      outcome.published.push(row.id);
    } catch (e) {
      const message = sanitiseSocialError(
        e instanceof Error ? e.message : "publish failed"
      );
      const tokenDead = e instanceof InstagramApiError && e.tokenInvalid;
      if (tokenDead && accountId) {
        await markAccountError(accountId, message, true);
        token = null; // every later post this tick goes manual
        await parkForManual(
          service,
          row,
          media,
          `Instagram rejected the token (${message}). Reconnect under Social → Accounts.`
        );
        outcome.needsManual.push(row.id);
        continue;
      }
      await service
        .from("social_posts")
        .update({ status: "failed", error: message, account_id: accountId })
        .eq("id", row.id);
      await logAuditAsService({
        action: "social_post.failed",
        target: `social_post:${row.id}`,
        metadata: { kind: row.kind, error: message },
      });
      outcome.failed.push({ id: row.id, error: message });
      outcome.ok = false;
    }
  }
  return outcome;
}

async function parkForManual(
  service: ReturnType<typeof createServiceClient>,
  row: PostRow,
  media: ReturnType<typeof parseMediaList>,
  reason: string
) {
  await service
    .from("social_posts")
    .update({ status: "needs_manual", error: reason.slice(0, 400) })
    .eq("id", row.id);
  const mail = manualPostEmail({
    postId: row.id,
    kind: row.kind,
    caption: row.caption,
    firstComment: row.first_comment,
    media,
    scheduledAt: row.scheduled_at,
    pillar: row.pillar,
    siteUrl: siteUrl(),
    reason,
  });
  await sendEmail({
    to: MANUAL_MODE_RECIPIENT,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    purpose: "transactional",
  });
  await logAuditAsService({
    action: "social_post.needs_manual",
    target: `social_post:${row.id}`,
    metadata: { kind: row.kind, reason },
  });
}
