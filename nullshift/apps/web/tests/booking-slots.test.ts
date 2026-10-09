import { describe, expect, it } from "vitest";
import {
  addDays,
  callToBusy,
  generateSlots,
  isSlotAvailable,
  londonOffsetMinutes,
  londonParts,
  londonToUtc,
  type AvailabilityRule,
  type BookingSettings,
} from "@/lib/booking/slots";

const settings: BookingSettings = {
  min_notice_hours: 0,
  max_days_ahead: 365,
  buffer_minutes: 0,
  active: true,
};

// Mon–Fri 10:00–12:00, 30-minute slots (the migration's seed, first window).
const weekdays: AvailabilityRule[] = [0, 1, 2, 3, 4].map((weekday) => ({
  weekday,
  start_time: "10:00:00",
  end_time: "12:00:00",
  slot_minutes: 30,
  active: true,
}));

// A fixed "now" well before every date under test: 1 Jan 2026 09:00 UTC.
const NOW = Date.UTC(2026, 0, 1, 9);

describe("London time maths", () => {
  it("knows the offset either side of the spring switch (29 Mar 2026)", () => {
    expect(londonOffsetMinutes(Date.UTC(2026, 2, 29, 0, 30))).toBe(0); // GMT
    expect(londonOffsetMinutes(Date.UTC(2026, 2, 29, 1, 30))).toBe(60); // BST
  });

  it("converts London wall-clock to UTC across DST", () => {
    // Winter: 10:00 London == 10:00 UTC.
    expect(londonToUtc("2026-01-12", 10 * 60)).toBe(Date.UTC(2026, 0, 12, 10));
    // Summer: 10:00 London == 09:00 UTC.
    expect(londonToUtc("2026-06-15", 10 * 60)).toBe(Date.UTC(2026, 5, 15, 9));
    // Day after clocks go forward.
    expect(londonToUtc("2026-03-30", 10 * 60)).toBe(Date.UTC(2026, 2, 30, 9));
    // Day after clocks go back (25 Oct 2026).
    expect(londonToUtc("2026-10-26", 10 * 60)).toBe(Date.UTC(2026, 9, 26, 10));
  });

  it("round-trips through londonParts", () => {
    const ms = londonToUtc("2026-07-01", 14 * 60 + 30);
    expect(londonParts(ms)).toMatchObject({
      date: "2026-07-01",
      time: "14:30",
      weekday: 2,
    });
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("generateSlots", () => {
  it("emits the weekly windows as UTC instants, correct on both sides of DST", () => {
    const slots = generateSlots({
      from: "2026-03-27", // Friday (GMT)
      to: "2026-03-30", // Monday (BST)
      rules: weekdays,
      exceptions: [],
      busy: [],
      settings,
      now: NOW,
    });
    const friday = slots.filter((s) => s.date === "2026-03-27");
    const monday = slots.filter((s) => s.date === "2026-03-30");
    expect(friday.map((s) => s.time)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
    expect(monday.map((s) => s.time)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
    expect(friday[0].startsAt).toBe("2026-03-27T10:00:00.000Z");
    expect(monday[0].startsAt).toBe("2026-03-30T09:00:00.000Z");
    // Weekend days produce nothing.
    expect(slots.some((s) => s.date === "2026-03-28" || s.date === "2026-03-29")).toBe(
      false
    );
  });

  it("removes slots that collide with the diary, padded by the buffer", () => {
    // A legacy call Monday 12 Jan 10:30–11:00 London, with a 15-minute buffer:
    // 10:00 (ends 10:30, touches the padded 10:15 start) and 11:00 (starts
    // before the padded 11:15 end) both go; only 11:30 survives.
    const busy = [
      callToBusy({ call_date: "2026-01-12", call_time: "10:30", duration_min: 30 }),
    ];
    const slots = generateSlots({
      from: "2026-01-12",
      to: "2026-01-12",
      rules: weekdays,
      exceptions: [],
      busy,
      settings: { ...settings, buffer_minutes: 15 },
      now: NOW,
    });
    expect(slots.map((s) => s.time)).toEqual(["11:30"]);
  });

  it("honours whole-day and part-day exceptions", () => {
    const slots = generateSlots({
      from: "2026-01-12",
      to: "2026-01-13",
      rules: weekdays,
      exceptions: [
        { date: "2026-01-12", start_time: null, end_time: null },
        { date: "2026-01-13", start_time: "10:00:00", end_time: "11:00:00" },
      ],
      busy: [],
      settings,
      now: NOW,
    });
    expect(slots.filter((s) => s.date === "2026-01-12")).toHaveLength(0);
    expect(slots.filter((s) => s.date === "2026-01-13").map((s) => s.time)).toEqual([
      "11:00",
      "11:30",
    ]);
  });

  it("applies the minimum notice window and the horizon", () => {
    // Now = Monday 12 Jan 2026 09:00 UTC; 2h notice drops the 10:00 and 10:30 slots.
    const now = Date.UTC(2026, 0, 12, 9);
    const slots = generateSlots({
      from: "2026-01-12",
      to: "2026-01-20",
      rules: weekdays,
      exceptions: [],
      busy: [],
      settings: { ...settings, min_notice_hours: 2, max_days_ahead: 2 },
      now,
    });
    expect(slots.filter((s) => s.date === "2026-01-12").map((s) => s.time)).toEqual([
      "11:00",
      "11:30",
    ]);
    // Horizon is today + 2 days (14 Jan); nothing beyond it.
    expect(slots.every((s) => s.date <= "2026-01-14")).toBe(true);
    expect(slots.some((s) => s.date === "2026-01-14")).toBe(true);
  });

  it("returns nothing when booking is switched off", () => {
    expect(
      generateSlots({
        from: "2026-01-12",
        to: "2026-01-16",
        rules: weekdays,
        exceptions: [],
        busy: [],
        settings: { ...settings, active: false },
        now: NOW,
      })
    ).toEqual([]);
  });

  it("isSlotAvailable only accepts exact generated instants", () => {
    const input = {
      from: "2026-01-12",
      to: "2026-01-12",
      rules: weekdays,
      exceptions: [],
      busy: [],
      settings,
      now: NOW,
    };
    expect(isSlotAvailable(input, "2026-01-12T10:30:00.000Z")?.time).toBe("10:30");
    expect(isSlotAvailable(input, "2026-01-12T10:45:00.000Z")).toBeNull();
    expect(isSlotAvailable(input, "not a date")).toBeNull();
  });
});
