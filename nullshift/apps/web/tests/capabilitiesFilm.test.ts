import { describe, expect, it } from "vitest";
import {
  CAPABILITY_CUES,
  capabilitiesFraming,
  capabilitiesFrame,
  capabilitiesTextFrame,
} from "@/lib/capabilitiesFilm";

describe("capabilities film choreography", () => {
  it("starts mobile on Bookings without waiting for a video, and ends on Anything", () => {
    expect(capabilitiesTextFrame(0).words[0].opacity).toBe(1);
    expect(capabilitiesTextFrame(1).anything).toBe(1);
    const seen = new Set<number>();
    for (let i = 0; i <= 100; i++) {
      const frame = capabilitiesTextFrame(i / 100);
      frame.words.forEach((word, index) => {
        if (word.opacity > 0.9) seen.add(index);
      });
    }
    expect([...seen]).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("preserves the requested headline order", () => {
    expect(CAPABILITY_CUES.map((cue) => cue.label)).toEqual([
      "Bookings",
      "Payments",
      "Finances",
      "Instruments",
      "Management",
      "Staffing",
    ]);
  });
  it("shows one crisp headline at each cue midpoint", () => {
    CAPABILITY_CUES.forEach((cue, index) => {
      const progress = ((cue.start + cue.end) / 2 / (16 - 1 / 24)) * 0.9;
      const frame = capabilitiesFrame(progress);
      expect(frame.words[index]).toEqual({ opacity: 1, blur: 0, lift: 0 });
      expect(frame.words.filter((word) => word.opacity > 0)).toHaveLength(1);
    });
  });
  it("finishes the blackout before Anything begins, then holds a black final frame", () => {
    expect(capabilitiesFrame(0.935).blackout).toBe(1);
    expect(capabilitiesFrame(0.935).anything).toBe(0);
    const last = capabilitiesFrame(1);
    expect(last.blackout).toBe(1);
    expect(last.anything).toBe(1);
    expect(last.sceneBlur).toBe(18);
    expect(last.words.every((word) => word.opacity === 0)).toBe(true);
  });
  it("bounds seeking, reverses deterministically and handles unloaded metadata", () => {
    expect(capabilitiesFrame(-1).time).toBe(0);
    expect(capabilitiesFrame(NaN).progress).toBe(0);
    expect(capabilitiesFrame(4).time).toBeCloseTo(16 - 1 / 24);
    expect(capabilitiesFrame(0.5, NaN).time).toBeGreaterThan(0);
    const forward = capabilitiesFrame(0.3);
    capabilitiesFrame(0.8);
    expect(capabilitiesFrame(0.3)).toEqual(forward);
  });
  it("keeps desktop centred and follows the phone in full-height portrait crops", () => {
    expect(capabilitiesFraming(1440, 900, 0.5)).toBe(50);
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [600, 1000],
      [768, 1024],
    ]) {
      const start = capabilitiesFraming(width, height, 0);
      const end = capabilitiesFraming(width, height, 1);
      expect(start).toBeGreaterThan(70);
      expect(end).toBeGreaterThanOrEqual(start);
      expect(end).toBeLessThanOrEqual(100);
    }
    expect(capabilitiesFraming(0, 0, 0)).toBe(50);
    expect(capabilitiesFraming(390, 844, NaN)).toBe(capabilitiesFraming(390, 844, 0));
  });
});
