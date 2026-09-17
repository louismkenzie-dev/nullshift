import { describe, expect, it } from "vitest";
import { filmTime, heroFrame, unitProgress, HERO_REVEAL_END } from "@/lib/scrollFilmHero";
import { showcaseAsset } from "@/lib/showcasePrototype";

describe("scroll film", () => {
  it("clamps invalid and out-of-range progress", () => {
    expect(unitProgress(-1)).toBe(0);
    expect(unitProgress(2)).toBe(1);
    expect(unitProgress(NaN)).toBe(0);
  });
  it("reproduces the title exit and closing reveal without history", () => {
    expect(heroFrame(0).title).toBe(1);
    expect(heroFrame(0.43).title).toBe(0);
    expect(heroFrame(0.7).closing).toBe(0);
    expect(heroFrame(1).closing).toBe(1);
    expect(heroFrame(1).scale).toBe(1.06);
    expect(heroFrame(0).blur).toBe(0);
  });
  it("fades up from black before the film or title starts moving", () => {
    expect(heroFrame(0).filmReveal).toBe(0);
    expect(heroFrame(HERO_REVEAL_END / 2).filmReveal).toBeCloseTo(0.5);
    expect(heroFrame(HERO_REVEAL_END).filmReveal).toBe(1);
    for (const progress of [0, HERO_REVEAL_END / 2, HERO_REVEAL_END]) {
      expect(filmTime(progress, 8)).toBe(0);
      expect(heroFrame(progress).title).toBe(1);
      expect(heroFrame(progress).scale).toBe(1);
    }
    expect(filmTime(HERO_REVEAL_END + 0.01, 8)).toBeGreaterThan(0);
    // Stateless mapping makes returning to the top identical to the first visit.
    heroFrame(1);
    expect(heroFrame(0).filmReveal).toBe(0);
    expect(filmTime(0, 8)).toBe(0);
  });
  it("seeks safely before the duration boundary", () => {
    expect(filmTime(0.56, 4)).toBeCloseTo(1.98);
    expect(filmTime(1, 4)).toBe(3.96);
    expect(filmTime(1, Infinity)).toBe(0);
    expect(filmTime(1, NaN)).toBe(0);
    expect(filmTime(1, -4)).toBe(0);
  });
  it("clears hero actions before playback, restores them on reverse scroll", () => {
    expect(heroFrame(0).actions).toBe(1);
    expect(heroFrame(0.015).actions).toBe(1);
    expect(heroFrame(0.0475).actions).toBeCloseTo(0.5);
    for (const p of [0.08, HERO_REVEAL_END, 0.44, 0.6, 1])
      expect(heroFrame(p).actions).toBe(0);
    expect(heroFrame(0.0475).actions).toBeCloseTo(0.5);
    expect(heroFrame(0).actions).toBe(1);
  });
  it("gives the middle message its own fade and readable hold without overlapping other titles", () => {
    expect(heroFrame(0).middle).toBe(0);
    expect(heroFrame(0.44).middle).toBe(0);
    expect(heroFrame(0.48).middle).toBeCloseTo(0.5);
    expect(heroFrame(0.56).middle).toBe(1);
    expect(heroFrame(0.64).middle).toBe(1);
    expect(heroFrame(0.69).middle).toBeCloseTo(0.5);
    expect(heroFrame(0.75).middle).toBe(0);
    expect(heroFrame(1).middle).toBe(0);
    for (let p = 0; p <= 1; p += 0.01) {
      const frame = heroFrame(p);
      if (frame.middle > 0) {
        expect(frame.title).toBe(0);
        expect(frame.closing).toBe(0);
      }
    }
  });
});

describe("published case study media", () => {
  it("uses standalone optimised exports for the embedded story", () => {
    expect(showcaseAsset("programme.png", true)).toBe(
      "/media/client-stories/suffolk-tennis/programme.webp?v=3"
    );
    expect(showcaseAsset("programme.mp4", true)).toBe(
      "/media/client-stories/suffolk-tennis/programme.mp4?v=3"
    );
    expect(showcaseAsset("portrait-iphone.jpg", true)).toBe(
      "/media/client-stories/suffolk-tennis/portrait-iphone.jpg"
    );
  });
  it("preserves the opt-in prototype media route", () => {
    expect(showcaseAsset("programme.png")).toBe(
      "/showcase-prototype/assets/programme.png?v=3"
    );
  });
});
