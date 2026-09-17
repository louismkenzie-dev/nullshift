import { describe, expect, it } from "vitest";
import {
  navCompactState,
  navScrollState,
  type NavScrollState,
} from "@/lib/navVisibility";

const initial: NavScrollState = { anchor: 0, previous: 0, direction: 0, hidden: false };

describe("quiet navigation", () => {
  it("gives the full-to-compact handover a stable dead band", () => {
    expect(navCompactState(false, 56)).toBe(false);
    expect(navCompactState(false, 57)).toBe(true);
    expect(navCompactState(true, 40)).toBe(true);
    expect(navCompactState(false, 40)).toBe(false);
    expect(navCompactState(true, 17)).toBe(true);
    expect(navCompactState(true, 16)).toBe(false);
    expect(navCompactState(true, -20)).toBe(false);
    expect(navCompactState(true, NaN)).toBe(false);
  });
  it("stays visible at the top, including elastic overscroll", () => {
    expect(navScrollState(initial, 80).hidden).toBe(false);
    expect(navScrollState({ ...initial, hidden: true }, -20).hidden).toBe(false);
  });
  it("hides after deliberate downward movement and returns on upward movement", () => {
    const down = navScrollState(initial, 300);
    expect(down.hidden).toBe(true);
    const tremor = navScrollState(down, 296);
    expect(tremor.hidden).toBe(true);
    expect(navScrollState(tremor, 280).hidden).toBe(false);
  });
  it("keeps menu and focused navigation visible", () => {
    expect(navScrollState(initial, 800, true).hidden).toBe(false);
  });
  it("does not create updates for subpixel scroll noise", () => {
    expect(navScrollState({ ...initial, previous: 200 }, 200.2)).toEqual({
      ...initial,
      previous: 200,
    });
  });
});
