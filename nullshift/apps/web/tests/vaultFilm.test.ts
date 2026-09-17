import { describe, expect, it } from "vitest";
import { VAULT_FILM, vaultProgress, vaultTime } from "@/lib/vaultFilm";

describe("vault scroll choreography", () => {
  it("holds the opening view on entry and finishes while still visible", () => {
    expect(vaultProgress(800, 500, 900)).toBe(0);
    expect(vaultProgress(648, 500, 900)).toBe(0);
    expect(vaultProgress(321, 500, 900)).toBeCloseTo(0.5);
    expect(vaultProgress(-6, 500, 900)).toBe(1);
    expect(vaultProgress(-500, 500, 900)).toBe(1);
  });
  it("preserves natural forward and reverse travel on phones", () => {
    const tops = [608, 450, 300, 150, 0];
    const times = tops.map((top) => vaultTime(vaultProgress(top, 350, 844)));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect([...times].reverse()).toEqual(
      [...tops].reverse().map((top) => vaultTime(vaultProgress(top, 350, 844)))
    );
  });
  it("targets the inclusive 240-frame turn without seeking beyond the file", () => {
    expect(VAULT_FILM.frames).toBe(240);
    expect(vaultTime(0)).toBe(0);
    expect(vaultTime(1)).toBe(239 / 30);
    expect(vaultTime(2)).toBe(239 / 30);
    expect(vaultTime(-1)).toBe(0);
    expect(vaultTime(NaN)).toBe(0);
    expect(vaultTime(0.5) * 30).toBe(120);
  });
});
