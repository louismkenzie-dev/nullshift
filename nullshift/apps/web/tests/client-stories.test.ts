import { describe, expect, it } from "vitest";
import { CLIENT_STORIES, type ClientStory } from "@nullshift/content/clientStories";
import {
  formatMonth,
  homeCards,
  muxMp4Url,
  muxPosterUrl,
  statusStamp,
  storyTheme,
  validateClientStories,
} from "@/lib/clientStories";

const LAURA = "hevvtK01oksR8HWcs5fJAjbICgIoPCHlW3zY89ZywMRA";
const NOW = new Date("2026-09-11T12:00:00Z");

const byId = (slug: string) => {
  const s = CLIENT_STORIES.find((x) => x.slug === slug);
  if (!s) throw new Error(`missing ${slug}`);
  return s;
};

describe("Mux URLs", () => {
  it("builds the MP4 and poster URLs for Laura's playback id", () => {
    expect(muxMp4Url(LAURA)).toBe(`https://stream.mux.com/${LAURA}/highest.mp4`);
    expect(muxPosterUrl(LAURA)).toBe(
      `https://image.mux.com/${LAURA}/thumbnail.webp?time=1`
    );
    expect(muxPosterUrl(LAURA, 4)).toBe(
      `https://image.mux.com/${LAURA}/thumbnail.webp?time=4`
    );
  });
});

describe("status stamp", () => {
  it("reads the right stamp for all three clients", () => {
    expect(statusStamp(byId("the-dance-exclusive"), NOW)).toBe(
      "Live since Aug 2026 · in care"
    );
    expect(statusStamp(byId("newfuture-therapy"), NOW)).toBe("Live since Jun 2026");
    expect(statusStamp(byId("suffolk-tennis"), NOW)).toBe("Live since Aug 2026");
  });

  it("says 'Launching' for a month still ahead", () => {
    expect(statusStamp({ stage: "live", liveSince: "2026-11" }, NOW)).toBe(
      "Launching Nov 2026"
    );
  });

  it("formats ISO months and rejects junk", () => {
    expect(formatMonth("2026-01")).toBe("Jan 2026");
    expect(() => formatMonth("June 2026")).toThrow();
    expect(() => formatMonth("2026-13")).toThrow();
  });
});

describe("section themes", () => {
  it("alternate dark / cream, dark first", () => {
    expect([0, 1, 2, 3].map(storyTheme)).toEqual(["dark", "cream", "dark", "cream"]);
  });
});

describe("home cards", () => {
  it("deep-link to each story's anchor and carry the sector as the tag", () => {
    const cards = homeCards(CLIENT_STORIES);
    expect(cards.map((c) => c.href)).toEqual([
      "/client-stories#the-dance-exclusive",
      "/client-stories#newfuture-therapy",
      "/client-stories#suffolk-tennis",
    ]);
    expect(cards[0].tag).toBe("Dance school · Essex");
    expect(cards[1].meta).toBe("Video testimonial");
  });

  it("never repeats the retired 'Three venues' copy", () => {
    for (const c of homeCards(CLIENT_STORIES)) {
      expect(c.title).not.toMatch(/three venues/i);
      expect(c.body).not.toMatch(/sibling discount|bill themselves/i);
    }
  });
});

describe("validation", () => {
  const clone = (): ClientStory => JSON.parse(JSON.stringify(byId("suffolk-tennis")));

  it("passes the real data", () => {
    expect(() => validateClientStories(CLIENT_STORIES)).not.toThrow();
  });

  it("rejects a duplicate slug", () => {
    expect(() => validateClientStories([clone(), clone()])).toThrow(/duplicate slug/);
  });

  it("rejects a bad ISO date", () => {
    const bad = clone();
    bad.liveSince = "August 2026";
    expect(() => validateClientStories([bad])).toThrow(/ISO month/);
    const bad2 = clone();
    bad2.stage = "care";
    bad2.careSince = "2026-9-2";
    expect(() => validateClientStories([bad2])).toThrow(/ISO date/);
  });

  it("rejects more than four stats, an empty beat and a non-https link", () => {
    const stats = clone();
    stats.stats = [...stats.stats, { value: "1", label: "extra" }];
    expect(() => validateClientStories([stats])).toThrow(/at most 4/);

    const beat = clone();
    beat.beats.built.body = "  ";
    expect(() => validateClientStories([beat])).toThrow(/empty "built" beat/);

    const http = clone();
    http.liveUrl = "http://suffolktennis.online";
    expect(() => validateClientStories([http])).toThrow(/https/);
  });
});

describe("the facts on record", () => {
  it("only ships numbers we verified", () => {
    const tde = byId("the-dance-exclusive").stats.map((s) => s.value);
    expect(tde).toEqual(["139", "235", "582", "17"]);
    const suffolk = byId("suffolk-tennis").stats.map((s) => s.value);
    expect(suffolk).toEqual(["1,340", "9", "6", "24"]);
    expect(byId("newfuture-therapy").video.muxPlaybackId).toBe(LAURA);
  });
});
