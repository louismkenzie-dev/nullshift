"use server";

/**
 * Social scheduler server actions. Every action: requireStaff → RLS client
 * for reads/writes on social_posts → audit_log row. Media uploads go to the
 * public `social-media` bucket through the service client (there is no
 * authenticated insert policy on the bucket) after the guard.
 *
 * Status rules live in lib/social/rules.ts (canTransition). A post can only
 * be scheduled from `approved`, and the publisher only picks up `scheduled`.
 * Editing the content of an approved or scheduled post sends it back to
 * `draft` so nothing goes out that nobody re-read.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@nullshift/auth/guards";
import { createClient, createServiceClient } from "@nullshift/db";
import { logAudit } from "@nullshift/db/audit";
import {
  addDaysKey,
  canTransition,
  isPillar,
  isPostKind,
  londonLocalToIso,
  mediaTypeFor,
  parseImportPlan,
  parseMediaList,
  validateCaption,
  validateMedia,
  validateSchedule,
  validateUpload,
  type MediaItem,
  type PostKind,
  type PostStatus,
} from "@/lib/social/rules";
import { revokeSocialAccount } from "@/lib/social/store";

const LIST = "/admin/social";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "social-media";

type Guard =
  | { ok: true; userId: string; db: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

async function guard(): Promise<Guard> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, reason: staff.reason };
  return { ok: true, userId: staff.userId, db: await createClient() };
}

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v : "");

function toList(notice: string, week?: string): never {
  const w = week ? `&week=${encodeURIComponent(week)}` : "";
  redirect(`${LIST}?notice=${encodeURIComponent(notice.slice(0, 240))}${w}`);
}
function toPost(id: string, notice: string): never {
  redirect(`${LIST}/${id}?notice=${encodeURIComponent(notice.slice(0, 240))}`);
}

type PostRow = {
  id: string;
  status: PostStatus;
  kind: PostKind;
  caption: string;
  media: unknown;
  scheduled_at: string | null;
  approved_at: string | null;
};

async function loadPost(db: Guard & { ok: true }, id: string): Promise<PostRow | null> {
  if (!UUID.test(id)) return null;
  const { data } = await db.db
    .from("social_posts")
    .select("id, status, kind, caption, media, scheduled_at, approved_at")
    .eq("id", id)
    .maybeSingle();
  return (data as PostRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Media upload
// ---------------------------------------------------------------------------

async function uploadFiles(
  files: File[]
): Promise<{ items: MediaItem[]; problems: string[] }> {
  const items: MediaItem[] = [];
  const problems: string[] = [];
  const service = createServiceClient();
  for (const file of files) {
    if (!file || typeof file.size !== "number" || file.size === 0) continue;
    const bad = validateUpload({
      name: file.name,
      size: file.size,
      contentType: file.type,
    });
    if (bad.length) {
      problems.push(...bad.map((p) => p.detail));
      continue;
    }
    const type = mediaTypeFor(file.name, file.type);
    if (!type) continue;
    const ext = (file.name.split(".").pop() ?? "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await service.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: file.type || undefined, upsert: false });
    if (error) {
      problems.push(`${file.name}: ${error.message}`);
      continue;
    }
    const { data } = service.storage.from(BUCKET).getPublicUrl(path);
    items.push({ url: data.publicUrl, type });
  }
  return { items, problems };
}

/** "url" or "url | alt text", one per line. */
function parseUrlLines(text: string): MediaItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [url, ...rest] = l.split("|");
      const u = url.trim();
      const alt = rest.join("|").trim();
      const ext = u.toLowerCase().split("?")[0].split(".").pop() ?? "";
      const type = mediaTypeFor(`x.${ext}`) ?? "image";
      return alt ? { url: u, type, alt } : { url: u, type };
    });
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export async function savePost(formData: FormData): Promise<void> {
  const g = await guard();
  if (!g.ok) toList(`err:${g.reason}`);

  const id = str(formData.get("id"));
  const kindRaw = str(formData.get("kind"));
  const kind: PostKind = isPostKind(kindRaw) ? kindRaw : "feed";
  const caption = str(formData.get("caption")).replace(/\r\n/g, "\n").slice(0, 4000);
  const firstComment = str(formData.get("first_comment")).trim().slice(0, 2200) || null;
  const pillarRaw = str(formData.get("pillar")).trim();
  const pillar =
    pillarRaw && (isPillar(pillarRaw) || pillarRaw.length <= 40) ? pillarRaw : null;
  const local = str(formData.get("scheduled_local")).trim();
  const scheduledAt = local ? londonLocalToIso(local) : null;
  if (local && !scheduledAt) {
    if (id) toPost(id, "err:Unreadable date/time.");
    toList("err:Unreadable date/time.");
  }

  // Media: kept items (JSON from the form) + pasted URLs + uploaded files.
  let media: MediaItem[] = [];
  try {
    media = parseMediaList(JSON.parse(str(formData.get("media_json")) || "[]"));
  } catch {
    media = [];
  }
  media.push(...parseUrlLines(str(formData.get("media_urls"))));
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const uploaded = await uploadFiles(files);
  media.push(...uploaded.items);
  media = media.slice(0, 10);

  const captionProblems = validateCaption(caption, kind);
  const warn = [...uploaded.problems, ...captionProblems.map((p) => p.detail)];

  const existing = id ? await loadPost(g, id) : null;
  if (id && !existing) toList("err:not_found");
  if (existing && (existing.status === "publishing" || existing.status === "published"))
    toPost(existing.id, "err:A published post cannot be edited.");

  const payload = {
    kind,
    caption,
    first_comment: firstComment,
    pillar,
    scheduled_at: scheduledAt,
    media: media as unknown as never,
  };

  if (!existing) {
    const { data, error } = await g.db
      .from("social_posts")
      .insert({ ...payload, status: "draft", created_by: g.userId })
      .select("id")
      .single();
    if (error || !data) toList(`err:${error?.message ?? "insert failed"}`);
    const newId = (data as { id: string }).id;
    await logAudit({
      action: "social_post.created",
      target: `social_post:${newId}`,
      metadata: { kind, pillar },
    });
    revalidatePath(LIST);
    toPost(
      newId,
      warn.length ? `warn:Saved as draft. ${warn.join(" ")}` : "ok:Draft saved."
    );
  }

  // Content edits on an approved/scheduled post go back to draft.
  const contentChanged =
    existing!.caption !== caption ||
    existing!.kind !== kind ||
    JSON.stringify(parseMediaList(existing!.media)) !== JSON.stringify(media);
  const demote =
    contentChanged &&
    (existing!.status === "approved" || existing!.status === "scheduled");
  const { error } = await g.db
    .from("social_posts")
    .update(
      demote
        ? { ...payload, status: "draft", approved_at: null, approved_by: null }
        : payload
    )
    .eq("id", existing!.id);
  if (error) toPost(existing!.id, `err:${error.message}`);
  await logAudit({
    action: "social_post.updated",
    target: `social_post:${existing!.id}`,
    metadata: { kind, pillar, demoted_to_draft: demote },
  });
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${existing!.id}`);
  toPost(
    existing!.id,
    warn.length
      ? `warn:Saved. ${warn.join(" ")}`
      : demote
        ? "warn:Saved and sent back to draft — approve it again before scheduling."
        : "ok:Saved."
  );
}

export async function removeMediaForm(formData: FormData): Promise<void> {
  const g = await guard();
  if (!g.ok) toList(`err:${g.reason}`);
  const id = str(formData.get("id"));
  const index = Number(str(formData.get("index")));
  const post = await loadPost(g, id);
  if (!post) toList("err:not_found");
  if (post.status === "published" || post.status === "publishing")
    toPost(post.id, "err:A published post cannot be edited.");
  const media = parseMediaList(post.media).filter((_, i) => i !== index);
  await g.db
    .from("social_posts")
    .update({ media: media as unknown as never })
    .eq("id", post.id);
  revalidatePath(`${LIST}/${post.id}`);
  toPost(post.id, "ok:Media removed.");
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

async function transition(
  g: Guard & { ok: true },
  post: PostRow,
  to: PostStatus,
  extra: Record<string, unknown> = {}
): Promise<string | null> {
  if (!canTransition(post.status, to))
    return `Cannot move a ${post.status} post to ${to}.`;
  if (to === "approved") {
    const problems = [
      ...validateCaption(post.caption, post.kind),
      ...validateMedia(parseMediaList(post.media), post.kind),
    ];
    if (problems.length) return problems.map((p) => p.detail).join(" ");
    extra = { ...extra, approved_at: new Date().toISOString(), approved_by: g.userId };
  }
  if (to === "scheduled") {
    if (!post.approved_at) return "Approve the post first.";
    const problems = validateSchedule(post.scheduled_at, new Date());
    if (problems.length) return problems.map((p) => p.detail).join(" ");
  }
  if (to === "draft")
    extra = { ...extra, approved_at: null, approved_by: null, error: null };
  if (to === "published")
    extra = { ...extra, published_at: new Date().toISOString(), error: null };
  const { data, error } = await g.db
    .from("social_posts")
    .update({ status: to, ...extra })
    .eq("id", post.id)
    .eq("status", post.status)
    .select("id");
  if (error) return error.message;
  if (!data?.length) return "Changed elsewhere; reload.";
  await logAudit({
    action: `social_post.${to}`,
    target: `social_post:${post.id}`,
    metadata: { from: post.status, kind: post.kind },
  });
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${post.id}`);
  return null;
}

async function statusAction(
  formData: FormData,
  to: PostStatus,
  okText: string
): Promise<void> {
  const g = await guard();
  if (!g.ok) toList(`err:${g.reason}`);
  const id = str(formData.get("id"));
  const back = str(formData.get("back")) === "list";
  const week = str(formData.get("week")) || undefined;
  const post = await loadPost(g, id);
  if (!post) toList("err:not_found", week);
  const err = await transition(g, post, to);
  if (back) toList(err ? `err:${err}` : `ok:${okText}`, week);
  toPost(post.id, err ? `err:${err}` : `ok:${okText}`);
}

export async function approvePostForm(formData: FormData): Promise<void> {
  await statusAction(formData, "approved", "Approved.");
}
export async function schedulePostForm(formData: FormData): Promise<void> {
  await statusAction(
    formData,
    "scheduled",
    "Scheduled. The publisher runs every 15 minutes."
  );
}
export async function unschedulePostForm(formData: FormData): Promise<void> {
  await statusAction(formData, "approved", "Taken off the schedule.");
}
export async function backToDraftForm(formData: FormData): Promise<void> {
  await statusAction(formData, "draft", "Back to draft.");
}
export async function markPublishedForm(formData: FormData): Promise<void> {
  await statusAction(formData, "published", "Marked as published.");
}

/** Approve every draft with a scheduled time inside the given week (Mon–Sun). */
export async function approveWeekForm(formData: FormData): Promise<void> {
  const g = await guard();
  if (!g.ok) toList(`err:${g.reason}`);
  const week = str(formData.get("week"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) toList("err:Bad week.");
  const from = `${week}T00:00:00Z`;
  const to = `${addDaysKey(week, 7)}T00:00:00Z`;
  const { data } = await g.db
    .from("social_posts")
    .select("id, status, kind, caption, media, scheduled_at, approved_at")
    .eq("status", "draft")
    .gte("scheduled_at", from)
    .lt("scheduled_at", to);
  const rows = (data ?? []) as PostRow[];
  let ok = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    const err = await transition(g, row, "approved");
    if (err) skipped.push(`${row.kind} ${row.id.slice(0, 8)}: ${err}`);
    else ok += 1;
  }
  toList(
    skipped.length
      ? `warn:Approved ${ok}; skipped ${skipped.length} — ${skipped.join("; ")}`
      : `ok:Approved ${ok} post${ok === 1 ? "" : "s"}.`,
    week
  );
}

/** Schedule every approved post with a time inside the week. */
export async function scheduleWeekForm(formData: FormData): Promise<void> {
  const g = await guard();
  if (!g.ok) toList(`err:${g.reason}`);
  const week = str(formData.get("week"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) toList("err:Bad week.");
  const from = `${week}T00:00:00Z`;
  const to = `${addDaysKey(week, 7)}T00:00:00Z`;
  const { data } = await g.db
    .from("social_posts")
    .select("id, status, kind, caption, media, scheduled_at, approved_at")
    .eq("status", "approved")
    .gte("scheduled_at", from)
    .lt("scheduled_at", to);
  const rows = (data ?? []) as PostRow[];
  let ok = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    const err = await transition(g, row, "scheduled");
    if (err) skipped.push(`${row.kind} ${row.id.slice(0, 8)}: ${err}`);
    else ok += 1;
  }
  toList(
    skipped.length
      ? `warn:Scheduled ${ok}; skipped ${skipped.length} — ${skipped.join("; ")}`
      : `ok:Scheduled ${ok} post${ok === 1 ? "" : "s"}.`,
    week
  );
}

export async function deletePostForm(formData: FormData): Promise<void> {
  const g = await guard();
  if (!g.ok) toList(`err:${g.reason}`);
  const post = await loadPost(g, str(formData.get("id")));
  if (!post) toList("err:not_found");
  if (post.status === "published" || post.status === "publishing")
    toPost(post.id, "err:A published post is kept as the record of what went out.");
  await g.db.from("social_posts").delete().eq("id", post.id);
  await logAudit({
    action: "social_post.deleted",
    target: `social_post:${post.id}`,
    metadata: { kind: post.kind },
  });
  revalidatePath(LIST);
  toList("ok:Deleted.");
}

// ---------------------------------------------------------------------------
// Import plan
// ---------------------------------------------------------------------------

export async function importPlanForm(formData: FormData): Promise<void> {
  const g = await guard();
  if (!g.ok) toList(`err:${g.reason}`);
  const text = str(formData.get("plan"));
  const parsed = parseImportPlan(text);
  if (!parsed.ok) {
    redirect(
      `${LIST}/import?notice=${encodeURIComponent(
        `err:${parsed.problems
          .slice(0, 8)
          .map((p) => `${p.field}: ${p.detail}`)
          .join(" ")}`.slice(0, 600)
      )}`
    );
  }
  const rows = parsed.posts.map((p) => ({
    kind: p.kind,
    caption: p.caption,
    first_comment: p.first_comment,
    pillar: p.pillar,
    scheduled_at: p.scheduled_at,
    media: p.media as unknown as never,
    status: "draft" as const,
    created_by: g.userId,
  }));
  const { data, error } = await g.db.from("social_posts").insert(rows).select("id");
  if (error)
    redirect(`${LIST}/import?notice=${encodeURIComponent(`err:${error.message}`)}`);
  const n = data?.length ?? 0;
  await logAudit({
    action: "social_post.imported",
    target: "social_posts",
    metadata: { count: n },
  });
  revalidatePath(LIST);
  const firstWeek = parsed.posts.find((p) => p.scheduled_at)?.scheduled_at;
  toList(
    `ok:Imported ${n} draft${n === 1 ? "" : "s"}. Review and approve them.`,
    firstWeek?.slice(0, 10)
  );
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function disconnectAccountForm(formData: FormData): Promise<void> {
  const g = await guard();
  if (!g.ok) redirect(`${LIST}/accounts?notice=forbidden`);
  const id = str(formData.get("id"));
  if (!UUID.test(id)) redirect(`${LIST}/accounts?notice=bad_id`);
  await revokeSocialAccount(id);
  await logAudit({
    action: "social.instagram.disconnected",
    target: `social_account:${id}`,
  });
  revalidatePath(`${LIST}/accounts`);
  redirect(`${LIST}/accounts?notice=disconnected`);
}
