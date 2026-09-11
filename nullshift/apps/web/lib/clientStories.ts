import type { ClientStory } from "@nullshift/content/clientStories";

/** Pure helpers for the client-stories gallery. No React, no DOM — tested
 *  in `tests/client-stories.test.ts`. */

export function muxMp4Url(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}/highest.mp4`;
}

export function muxPosterUrl(playbackId: string, time = 1): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?time=${time}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-06" → "Jun 2026". Throws on anything that is not an ISO month. */
export function formatMonth(isoMonth: string): string {
  const m = ISO_MONTH.exec(isoMonth);
  if (!m) throw new Error(`Not an ISO month: ${isoMonth}`);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`Not an ISO month: ${isoMonth}`);
  return `${MONTHS[month - 1]} ${m[1]}`;
}

/** The stamp beside a story's name — "Live since Jun 2026", or
 *  "Live since Aug 2026 · in care" once a care plan has started. A story whose
 *  launch month is still ahead of `now` reads "Launching Sep 2026". */
export function statusStamp(
  story: Pick<ClientStory, "stage" | "liveSince" | "careSince">,
  now: Date = new Date()
): string {
  const nowMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (story.liveSince > nowMonth) return `Launching ${formatMonth(story.liveSince)}`;
  const base = `Live since ${formatMonth(story.liveSince)}`;
  return story.stage === "care" ? `${base} · in care` : base;
}

/** Sections alternate dark / cream, dark first (the hero above is cream). */
export function storyTheme(index: number): "dark" | "cream" {
  return index % 2 === 0 ? "dark" : "cream";
}

export function storyHref(story: Pick<ClientStory, "slug">): string {
  return `/client-stories#${story.slug}`;
}

export type HomeCard = {
  href: string;
  tag: string;
  title: string;
  body: string;
  meta: string;
};

/** The homepage "Client stories" grid reads the same data as the gallery. */
export function homeCards(stories: ClientStory[]): HomeCard[] {
  return stories.map((s) => ({
    href: storyHref(s),
    tag: s.sector,
    title: s.homeCard.title,
    body: s.summary,
    meta: s.homeCard.meta,
  }));
}

/** Fails `next build` on a bad entry rather than shipping it. */
export function validateClientStories(stories: ClientStory[]): void {
  const seen = new Set<string>();
  for (const s of stories) {
    const where = `client story "${s.slug}"`;
    if (!/^[a-z0-9-]+$/.test(s.slug))
      throw new Error(`${where}: slug must be kebab-case`);
    if (seen.has(s.slug)) throw new Error(`${where}: duplicate slug`);
    seen.add(s.slug);

    if (!ISO_MONTH.test(s.liveSince))
      throw new Error(`${where}: liveSince must be an ISO month (YYYY-MM)`);
    formatMonth(s.liveSince);
    if (s.careSince !== undefined && !ISO_DATE.test(s.careSince)) {
      throw new Error(`${where}: careSince must be an ISO date (YYYY-MM-DD)`);
    }
    if (s.stage === "care" && !s.careSince)
      throw new Error(`${where}: stage "care" needs careSince`);

    if (s.stats.length > 4) throw new Error(`${where}: at most 4 stats`);
    for (const st of s.stats) {
      if (!st.value.trim() || !st.label.trim()) throw new Error(`${where}: empty stat`);
    }

    for (const key of ["had", "built", "runs"] as const) {
      const b = s.beats[key];
      if (!b.title.trim() || !b.body.trim())
        throw new Error(`${where}: empty "${key}" beat`);
    }

    if (s.liveUrl !== null && !s.liveUrl.startsWith("https://")) {
      throw new Error(`${where}: liveUrl must be https`);
    }
    if (!s.summary.trim()) throw new Error(`${where}: empty summary`);
    if (!s.proof.ownership.length) throw new Error(`${where}: ownership list is empty`);
  }
}
