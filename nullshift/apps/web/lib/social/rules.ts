/**
 * Pure rules for the social scheduler: caption limits, media validation,
 * schedule-window logic, week bucketing and the import-plan parser. No I/O,
 * no Supabase, no Date.now() unless injected — everything here is unit
 * tested in tests/social-scheduler.test.ts.
 *
 * Limits come from the Instagram content-publishing reference (Graph v25.0):
 * captions ≤ 2,200 characters, ≤ 30 hashtags, ≤ 20 @mentions; carousels
 * 2–10 items; feed images JPEG ≤ 8 MB; reels 3 s–15 min; stories ≤ 60 s.
 */

export const PLATFORM_LIMITS = {
  captionMaxChars: 2200,
  captionMaxHashtags: 30,
  captionMaxMentions: 20,
  carouselMin: 2,
  carouselMax: 10,
  imageMaxBytes: 8 * 1024 * 1024,
  reelMaxBytes: 300 * 1024 * 1024,
  storyVideoMaxBytes: 100 * 1024 * 1024,
  /** Containers expire 24h after creation; we poll for at most this long. */
  containerPollMaxMs: 5 * 60 * 1000,
} as const;

export const POST_KINDS = ["feed", "reel", "story", "carousel"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const POST_STATUSES = [
  "draft",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "needs_manual",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const PILLARS = [
  { id: "proof", label: "Proof (client stories, results)" },
  { id: "process", label: "Process (how we build)" },
  { id: "offer", label: "Offer (plans, estimator, partner programme)" },
  { id: "founder", label: "Founder (Louis cameo)" },
  { id: "education", label: "Education (tips for small firms)" },
  { id: "culture", label: "Studio life" },
] as const;
export type Pillar = (typeof PILLARS)[number]["id"];

export const isPostKind = (v: unknown): v is PostKind =>
  typeof v === "string" && (POST_KINDS as readonly string[]).includes(v);
export const isPostStatus = (v: unknown): v is PostStatus =>
  typeof v === "string" && (POST_STATUSES as readonly string[]).includes(v);
export const isPillar = (v: unknown): v is Pillar =>
  typeof v === "string" && PILLARS.some((p) => p.id === v);

export type MediaType = "image" | "video";
export type MediaItem = { url: string; type: MediaType; alt?: string };

export type Problem = { field: string; detail: string };

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

export function countHashtags(text: string): number {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function countMentions(text: string): number {
  return (text.match(/(^|\s)@[A-Za-z0-9._]+/g) ?? []).length;
}

/** Caption length as Instagram counts it: code points, not UTF-16 units. */
export function captionLength(text: string): number {
  return Array.from(text).length;
}

/**
 * The hashtag line is whatever trailing block of the caption consists only
 * of hashtags (the convention the compose page uses: body, blank line, tags).
 */
export function splitHashtagLine(caption: string): { body: string; tags: string[] } {
  const lines = caption.trimEnd().split(/\r?\n/);
  const tags: string[] = [];
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (!last) {
      lines.pop();
      continue;
    }
    const tokens = last.split(/\s+/);
    if (tokens.every((t) => /^#[\p{L}\p{N}_]+$/u.test(t))) {
      tags.unshift(...tokens);
      lines.pop();
      continue;
    }
    break;
  }
  return { body: lines.join("\n").trimEnd(), tags };
}

export function validateCaption(caption: string, kind: PostKind): Problem[] {
  const problems: Problem[] = [];
  const len = captionLength(caption);
  if (len > PLATFORM_LIMITS.captionMaxChars)
    problems.push({
      field: "caption",
      detail: `Caption is ${len} characters; Instagram allows ${PLATFORM_LIMITS.captionMaxChars}.`,
    });
  const tags = countHashtags(caption);
  if (tags > PLATFORM_LIMITS.captionMaxHashtags)
    problems.push({
      field: "caption",
      detail: `${tags} hashtags; Instagram allows ${PLATFORM_LIMITS.captionMaxHashtags}.`,
    });
  const mentions = countMentions(caption);
  if (mentions > PLATFORM_LIMITS.captionMaxMentions)
    problems.push({
      field: "caption",
      detail: `${mentions} @mentions; Instagram allows ${PLATFORM_LIMITS.captionMaxMentions}.`,
    });
  if (kind !== "story" && caption.trim().length === 0)
    problems.push({
      field: "caption",
      detail: "A caption is required for feed, reel and carousel posts.",
    });
  return problems;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

const isHttpsUrl = (u: string): boolean => {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

export function parseMediaItem(raw: unknown): MediaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.url === "string" ? r.url.trim() : "";
  const type = r.type === "video" ? "video" : r.type === "image" ? "image" : null;
  if (!url || !type) return null;
  const alt =
    typeof r.alt === "string" && r.alt.trim() ? r.alt.trim().slice(0, 1000) : undefined;
  return alt ? { url, type, alt } : { url, type };
}

export function parseMediaList(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseMediaItem).filter((m): m is MediaItem => !!m);
}

/** What a post of this kind must carry to be publishable by the API. */
export function validateMedia(media: MediaItem[], kind: PostKind): Problem[] {
  const problems: Problem[] = [];
  for (const [i, m] of media.entries()) {
    if (!isHttpsUrl(m.url))
      problems.push({
        field: `media[${i}]`,
        detail: "Media must be a public https URL.",
      });
  }
  switch (kind) {
    case "feed":
      if (media.length !== 1)
        problems.push({
          field: "media",
          detail: "A feed post carries exactly one image or video.",
        });
      break;
    case "reel":
      if (media.length !== 1 || media[0]?.type !== "video")
        problems.push({ field: "media", detail: "A reel carries exactly one video." });
      break;
    case "story":
      if (media.length !== 1)
        problems.push({
          field: "media",
          detail: "A story carries exactly one image or video.",
        });
      break;
    case "carousel":
      if (
        media.length < PLATFORM_LIMITS.carouselMin ||
        media.length > PLATFORM_LIMITS.carouselMax
      )
        problems.push({
          field: "media",
          detail: `A carousel carries ${PLATFORM_LIMITS.carouselMin}–${PLATFORM_LIMITS.carouselMax} items.`,
        });
      break;
  }
  return problems;
}

/** Guess the media type from a filename or content type. */
export function mediaTypeFor(
  name: string,
  contentType?: string | null
): MediaType | null {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("video/")) return "video";
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (["mp4", "mov", "m4v"].includes(ext)) return "video";
  return null;
}

export function validateUpload(input: {
  name: string;
  size: number;
  contentType?: string | null;
}): Problem[] {
  const problems: Problem[] = [];
  const type = mediaTypeFor(input.name, input.contentType);
  if (!type) {
    problems.push({ field: "file", detail: `${input.name}: not an image or video.` });
    return problems;
  }
  const max =
    type === "image" ? PLATFORM_LIMITS.imageMaxBytes : PLATFORM_LIMITS.reelMaxBytes;
  if (input.size > max)
    problems.push({
      field: "file",
      detail: `${input.name}: ${(input.size / 1024 / 1024).toFixed(1)} MB is over the ${Math.round(max / 1024 / 1024)} MB limit.`,
    });
  if (input.size === 0)
    problems.push({ field: "file", detail: `${input.name}: empty file.` });
  return problems;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export type SchedulablePost = {
  status: PostStatus;
  scheduled_at: string | null;
  approved_at: string | null;
};

/**
 * Whether the publisher may pick this post up right now. Only an approved
 * post that was moved to `scheduled` and whose time has come. A post that is
 * more than `staleAfterMs` late is still published (a cron gap must not lose
 * content) but `isLate` tells the caller to say so.
 */
export function isDue(
  post: SchedulablePost,
  now: Date,
  staleAfterMs = 6 * 60 * 60 * 1000
): { due: boolean; isLate: boolean; reason?: string } {
  if (post.status !== "scheduled")
    return { due: false, isLate: false, reason: "not scheduled" };
  if (!post.approved_at) return { due: false, isLate: false, reason: "never approved" };
  if (!post.scheduled_at) return { due: false, isLate: false, reason: "no time" };
  const at = new Date(post.scheduled_at).getTime();
  if (!Number.isFinite(at)) return { due: false, isLate: false, reason: "bad time" };
  if (at > now.getTime()) return { due: false, isLate: false, reason: "in the future" };
  return { due: true, isLate: now.getTime() - at > staleAfterMs };
}

/** Can a post move from `from` to `to` by a staff action? */
export function canTransition(from: PostStatus, to: PostStatus): boolean {
  const allowed: Record<PostStatus, PostStatus[]> = {
    draft: ["approved"],
    approved: ["draft", "scheduled"],
    scheduled: ["draft", "approved"],
    publishing: [],
    published: [],
    failed: ["draft", "approved", "scheduled", "published"],
    needs_manual: ["draft", "approved", "scheduled", "published"],
  };
  return allowed[from]?.includes(to) ?? false;
}

/** Scheduling requires a time at least `minLeadMs` in the future. */
export function validateSchedule(
  scheduledAt: string | null,
  now: Date,
  minLeadMs = 5 * 60 * 1000
): Problem[] {
  if (!scheduledAt) return [{ field: "scheduled_at", detail: "Pick a date and time." }];
  const at = new Date(scheduledAt).getTime();
  if (!Number.isFinite(at))
    return [{ field: "scheduled_at", detail: "Unreadable date/time." }];
  if (at < now.getTime() + minLeadMs)
    return [
      {
        field: "scheduled_at",
        detail: `Schedule at least ${Math.round(minLeadMs / 60000)} minutes ahead so the next cron tick can pick it up.`,
      },
    ];
  return [];
}

/**
 * Europe/London wall-clock → UTC ISO. The compose form submits a
 * datetime-local string (no zone); we interpret it in London and emit UTC.
 * Handles BST/GMT by solving for the offset at that instant.
 */
export function londonLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  const offsetAt = (utcMs: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    return asUtc - utcMs;
  };
  // Two passes handle the DST edge: the offset at the guess may differ from
  // the offset at the corrected instant.
  let utc = guess - offsetAt(guess);
  utc = guess - offsetAt(utc);
  const date = new Date(utc);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** UTC ISO → datetime-local string in Europe/London (for form defaults). */
export function isoToLondonLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// ---------------------------------------------------------------------------
// Week view
// ---------------------------------------------------------------------------

/** YYYY-MM-DD of this instant in Europe/London. */
export function londonDateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The Monday (date key) that starts the London week containing `d`. */
export function weekStartKey(d: Date): string {
  const key = londonDateKey(d);
  const [y, m, day] = key.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, day, 12));
  const dow = (noonUtc.getUTCDay() + 6) % 7; // Monday = 0
  noonUtc.setUTCDate(noonUtc.getUTCDate() - dow);
  return noonUtc.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** The seven date keys Mon–Sun for the week starting at `mondayKey`. */
export function weekDays(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(mondayKey, i));
}

/** Bucket posts into the week's days by their London date; unscheduled → "". */
export function bucketByDay<T extends { scheduled_at: string | null }>(
  posts: T[],
  mondayKey: string
): Map<string, T[]> {
  const days = weekDays(mondayKey);
  const map = new Map<string, T[]>(days.map((k) => [k, [] as T[]]));
  map.set("", []);
  for (const p of posts) {
    const key = p.scheduled_at ? londonDateKey(p.scheduled_at) : "";
    const bucket = map.get(key);
    if (bucket) bucket.push(p);
  }
  for (const list of map.values())
    list.sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  return map;
}

// ---------------------------------------------------------------------------
// Import plan
// ---------------------------------------------------------------------------

export type ImportedPost = {
  kind: PostKind;
  caption: string;
  scheduled_at: string | null;
  pillar: string | null;
  first_comment: string | null;
  media: MediaItem[];
};

export type ImportResult =
  | { ok: true; posts: ImportedPost[] }
  | { ok: false; problems: Problem[] };

/**
 * Parse a JSON content plan: an array of
 * {kind, caption, scheduled_at, pillar?, first_comment?, media?:[{url,type,alt?}]}.
 * `scheduled_at` may be ISO (with zone) or a London wall-clock
 * "YYYY-MM-DDTHH:mm". Every row is validated; one bad row fails the import so
 * nothing half-loads.
 */
export function parseImportPlan(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problems: [{ field: "json", detail: "Not valid JSON." }] };
  }
  if (!Array.isArray(raw))
    return { ok: false, problems: [{ field: "json", detail: "Expected a JSON array." }] };
  if (raw.length === 0)
    return { ok: false, problems: [{ field: "json", detail: "The array is empty." }] };
  if (raw.length > 200)
    return {
      ok: false,
      problems: [{ field: "json", detail: "At most 200 posts per import." }],
    };

  const problems: Problem[] = [];
  const posts: ImportedPost[] = [];
  raw.forEach((item, i) => {
    const at = `row ${i + 1}`;
    if (!item || typeof item !== "object") {
      problems.push({ field: at, detail: "Not an object." });
      return;
    }
    const r = item as Record<string, unknown>;
    if (!isPostKind(r.kind)) {
      problems.push({
        field: at,
        detail: `kind must be one of ${POST_KINDS.join(", ")}.`,
      });
      return;
    }
    const caption = typeof r.caption === "string" ? r.caption : "";
    let scheduled: string | null = null;
    if (typeof r.scheduled_at === "string" && r.scheduled_at.trim()) {
      const s = r.scheduled_at.trim();
      scheduled = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(s)
        ? londonLocalToIso(s)
        : Number.isFinite(new Date(s).getTime())
          ? new Date(s).toISOString()
          : null;
      if (!scheduled)
        problems.push({ field: at, detail: `scheduled_at "${s}" is unreadable.` });
    }
    const pillar =
      typeof r.pillar === "string" && r.pillar.trim()
        ? r.pillar.trim().slice(0, 40)
        : null;
    const first_comment =
      typeof r.first_comment === "string" && r.first_comment.trim()
        ? r.first_comment.trim()
        : null;
    const media = parseMediaList(r.media);
    for (const p of validateCaption(caption, r.kind))
      problems.push({ field: `${at} ${p.field}`, detail: p.detail });
    for (const m of media)
      if (!isHttpsUrl(m.url))
        problems.push({ field: `${at} media`, detail: `${m.url} is not an https URL.` });
    posts.push({
      kind: r.kind,
      caption,
      scheduled_at: scheduled,
      pillar,
      first_comment,
      media,
    });
  });
  return problems.length ? { ok: false, problems } : { ok: true, posts };
}
