import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  PARENT_CHAPTERS,
  clipTime,
  dampProgress,
  parentFrame,
  preparedShowcaseClips,
  parseByteRange,
  screenMatrix,
  showcaseEnabled,
  showcaseFrame,
  showcaseImageLoader,
  showcaseInlineVideo,
  SHOWCASE_ASSETS,
} from "@/lib/showcasePrototype";

describe("local showcase isolation", () => {
  it("requires development and explicit opt-in", () => {
    expect(showcaseEnabled("development", "1")).toBe(true);
    for (const environment of ["production", "test", undefined])
      expect(showcaseEnabled(environment, "1")).toBe(false);
    for (const flag of [undefined, "0", "true"])
      expect(showcaseEnabled("development", flag)).toBe(false);
  });
  it("never serves raw captures, evidence, PSDs or arbitrary filenames", () => {
    for (const file of [
      "../.env.local",
      "capture-evidence.json",
      "studio-display.psd",
      "raw/recording.webm",
      "toString",
    ])
      expect(Object.hasOwn(SHOWCASE_ASSETS, file)).toBe(false);
  });
});

describe("responsive showcase acquisition", () => {
  it("keeps private prototypes on the existing allowlisted originals", () => {
    expect(showcaseInlineVideo("ledger", false, true, true)).toBe(
      "/showcase-prototype/assets/ledger.mp4?v=3"
    );
    expect(showcaseInlineVideo("parent-home", false, false, false)).toBe(
      "/showcase-prototype/assets/parent-home.mp4?v=2"
    );
  });
  it("selects retina-conscious public inline assets without replacing inspector originals", () => {
    expect(showcaseInlineVideo("ledger", true, true, true)).toContain(
      "ledger-inline-mobile.mp4"
    );
    expect(showcaseInlineVideo("ledger", true, false, false)).toContain(
      "ledger-inline-desktop.mp4"
    );
    expect(showcaseInlineVideo("parent-home", true, true, true)).toContain(
      "parent-home-inline-retina.mp4"
    );
    expect(showcaseInlineVideo("parent-home", true, false, false)).toContain(
      "parent-home-inline.mp4"
    );
  });
  it("prepares a next clip near its transition and retires the covered one", () => {
    expect(preparedShowcaseClips(0)).toEqual([0]);
    expect(preparedShowcaseClips(0.4)).toEqual([0, 1]);
    expect(preparedShowcaseClips(0.5)).toEqual([1]);
    expect(preparedShowcaseClips(0.7)).toEqual([1, 2]);
    expect(preparedShowcaseClips(1)).toEqual([2]);
    expect(preparedShowcaseClips(0.5, true)).toEqual([0]);
    expect(preparedShowcaseClips(0.6, true)).toEqual([0, 1]);
    expect(preparedShowcaseClips(0.7, true)).toEqual([1]);
  });
  it("selects prebuilt image candidates and preserves original aspect and version paths", () => {
    const root = "/media/client-stories/suffolk-tennis/";
    expect(showcaseImageLoader({ src: `${root}ledger.webp?v=3`, width: 900 })).toBe(
      `${root}ledger-w1280.webp?v=3`
    );
    expect(showcaseImageLoader({ src: `${root}studio-display.jpg`, width: 1600 })).toBe(
      `${root}studio-display-w1600.webp`
    );
    expect(showcaseImageLoader({ src: `${root}parent-report.webp`, width: 700 })).toBe(
      `${root}parent-report-w780.webp`
    );
    expect(showcaseImageLoader({ src: `${root}ledger.webp?v=3`, width: 3000 })).toBe(
      `${root}ledger.webp?v=3`
    );
    expect(showcaseImageLoader({ src: `${root}suffolk-logo.webp`, width: 900 })).toBe(
      `${root}suffolk-logo.webp`
    );
  });
});

describe("case-study readability and phone journey", () => {
  it("holds readable opening and ending frames", () => {
    expect(clipTime(0.2, 0.18, 0.45, 6)).toBe(0);
    expect(clipTime(0.44, 0.18, 0.45, 6)).toBe(5.96);
    expect(clipTime(0.32, 0.18, 0.45, 6)).toBeGreaterThan(0);
  });
  it("damps in either direction without overshooting and settles", () => {
    const forward = dampProgress(0.1, 0.7, 16);
    expect(forward).toBeGreaterThan(0.1);
    expect(forward).toBeLessThan(0.7);
    expect(dampProgress(0.7, 0.1, 16)).toBeLessThan(0.7);
    let current = 0;
    for (let i = 0; i < 150; i++) current = dampProgress(current, 0.7, 16);
    expect(current).toBe(0.7);
  });
  it("keeps feature labels and phone chapters complete", () => {
    CHAPTERS.forEach((chapter) => expect(chapter.features).toHaveLength(3));
    expect(PARENT_CHAPTERS[0].start).toBe(0);
    expect(PARENT_CHAPTERS.at(-1)?.end).toBe(1);
    PARENT_CHAPTERS.slice(1).forEach((chapter, i) =>
      expect(chapter.start).toBe(PARENT_CHAPTERS[i].end)
    );
    expect(parentFrame(NaN).chapter).toBe(0);
    expect(parentFrame(0.4).chapter).toBe(1);
    expect(parentFrame(0.9).chapter).toBe(2);
    expect(parentFrame(-2).zoom).toBe(0);
    expect(parentFrame(2).zoom).toBe(1);
  });
});

describe("scroll choreography", () => {
  it("has continuous non-overlapping chapter ranges", () => {
    expect(CHAPTERS[0].start).toBe(0);
    expect(CHAPTERS.at(-1)?.end).toBe(1);
    CHAPTERS.slice(1).forEach((entry, index) =>
      expect(entry.start).toBe(CHAPTERS[index].end)
    );
  });
  it("clamps overscroll and invalid input", () => {
    expect(showcaseFrame(-1).progress).toBe(0);
    expect(showcaseFrame(2).progress).toBe(1);
    expect(showcaseFrame(NaN).progress).toBe(0);
  });
  it("reverses deterministically without a playback clock", () => {
    const first = showcaseFrame(0.56);
    expect(first.chapter).toBe(2);
    expect(showcaseFrame(0.9).chapter).toBe(3);
    expect(showcaseFrame(0.56)).toEqual(first);
    expect(showcaseFrame(0.2).clipProgress).toBeLessThan(showcaseFrame(0.3).clipProgress);
  });
  it("bounds zoom and opacity", () => {
    for (let i = 0; i <= 100; i++) {
      const frame = showcaseFrame(i / 100);
      expect(frame.zoom).toBeGreaterThanOrEqual(1);
      expect(frame.zoom).toBeLessThanOrEqual(1.68);
      expect(frame.logoOpacity).toBeGreaterThanOrEqual(0);
      expect(frame.logoOpacity).toBeLessThanOrEqual(1);
    }
  });
});

describe("photographic screen mapping", () => {
  it.each([390, 1440, 3000])("maps all four corners at photo width %i", (width) => {
    const m = screenMatrix(width);
    const sources = [
      [0, 0],
      [1600, 0],
      [1600, 900],
      [0, 900],
    ];
    const destinations = [
      [0.2896, 0.2133],
      [0.7141, 0.2117],
      [0.7109, 0.5677],
      [0.2924, 0.5707],
    ];
    sources.forEach(([x, y], index) => {
      const divisor = m[3] * x + m[7] * y + 1;
      expect((m[0] * x + m[4] * y + m[12]) / divisor).toBeCloseTo(
        destinations[index][0] * width,
        5
      );
      expect((m[1] * x + m[5] * y + m[13]) / divisor).toBeCloseTo(
        (destinations[index][1] * width) / 1.5,
        5
      );
    });
  });
});

describe("video byte ranges", () => {
  it("supports bounded, open-ended and suffix seeking", () => {
    expect(parseByteRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseByteRange("bytes=45-", 100)).toEqual({ start: 45, end: 99 });
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
  });
  it.each([
    "bytes=100-",
    "bytes=10-5",
    "bytes=-0",
    "bytes=-",
    "bytes=0-1,3-4",
    "units=0-1",
    "bytes=9007199254740992-",
  ])("rejects unsatisfiable or invalid range %s", (header) => {
    expect(parseByteRange(header, 100)).toBeNull();
  });
});
