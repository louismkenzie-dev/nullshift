import { describe, expect, it } from "vitest";
import { filmTime, heroFrame, unitProgress } from "@/lib/scrollFilmHero";
import { showcaseAsset } from "@/lib/showcasePrototype";

describe("scroll film", () => {
  it("clamps invalid and out-of-range progress", () => {
    expect(unitProgress(-1)).toBe(0);
    expect(unitProgress(2)).toBe(1);
    expect(unitProgress(NaN)).toBe(0);
  });
  it("reproduces the title exit and closing reveal without history", () => {
    expect(heroFrame(0).title).toBe(1);
    expect(heroFrame(0.35).title).toBe(0);
    expect(heroFrame(0.7).closing).toBe(0);
    expect(heroFrame(1).closing).toBe(1);
    expect(heroFrame(1).scale).toBe(1.06);
    expect(heroFrame(0).blur).toBe(0);
  });
  it("seeks safely before the duration boundary", () => {
    expect(filmTime(0.5, 4)).toBe(1.98);
    expect(filmTime(1, 4)).toBe(3.96);
    expect(filmTime(1, Infinity)).toBe(0);
    expect(filmTime(1, NaN)).toBe(0);
    expect(filmTime(1, -4)).toBe(0);
  });
});

describe("published case study media", () => {
  it("uses standalone optimised exports for the embedded story", () => {
    expect(showcaseAsset("programme.png", true)).toBe(
      "/media/client-stories/suffolk-tennis/programme.webp"
    );
    expect(showcaseAsset("programme.mp4", true)).toBe(
      "/media/client-stories/suffolk-tennis/programme.mp4"
    );
    expect(showcaseAsset("portrait-iphone.jpg", true)).toBe(
      "/media/client-stories/suffolk-tennis/portrait-iphone.jpg"
    );
  });
  it("preserves the opt-in prototype media route", () => {
    expect(showcaseAsset("programme.png")).toBe(
      "/showcase-prototype/assets/programme.png?v=2"
    );
  });
});
