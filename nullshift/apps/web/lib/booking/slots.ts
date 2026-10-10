/**
 * Pure slot generation for the call-booking tool (migration 0070).
 *
 * Everything is reasoned about in Europe/London wall-clock time (the rules and
 * exceptions are stored that way, and so are the legacy `calls` rows) and
 * returned as UTC instants. No library: the London offset is read from Intl
 * for the instant in question, so DST transitions fall out correctly.
 *
 * No I/O here — the server loader (./data.ts) fetches rows and hands them in,
 * and the vitest suite in tests/booking-slots.test.ts exercises the edges.
 */

export const LONDON = "Europe/London";

export type AvailabilityRule = {
  weekday: number; // 0 = Monday … 6 = Sunday
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  slot_minutes: number;
  active: boolean;
};

export type AvailabilityException = {
  date: string; // YYYY-MM-DD (London)
  start_time: string | null;
  end_time: string | null;
};

export type BookingSettings = {
  min_notice_hours: number;
  max_days_ahead: number;
  buffer_minutes: number;
  active: boolean;
};

/** Anything already in the diary: a confirmed booking or a legacy call. */
export type BusyInterval = { start: number; end: number }; // UTC ms

export type Slot = {
  startsAt: string; // ISO UTC
  endsAt: string;
  date: string; // London YYYY-MM-DD
  time: string; // London HH:MM
};

const MIN = 60_000;
const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM[:SS]" → minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** London wall-clock parts for a UTC instant. */
export function londonParts(ms: number): {
  date: string;
  time: string;
  weekday: number;
  minutes: number;
} {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  const date = `${p.year}-${p.month}-${p.day}`;
  const time = `${p.hour}:${p.minute}`;
  return {
    date,
    time,
    weekday: WEEKDAYS.indexOf(p.weekday ?? "Mon"),
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** London UTC offset (minutes east) at a UTC instant. */
export function londonOffsetMinutes(ms: number): number {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return Math.round((asUtc - ms) / MIN);
}

/**
 * London wall-clock → UTC ms. Minutes may exceed 24h (rolls into the next day).
 * Resolves the offset twice so instants either side of a DST switch land on
 * the correct side; a non-existent spring-forward time maps to the instant
 * one hour later, a repeated autumn time to its first (BST) occurrence.
 */
export function londonToUtc(date: string, minutes: number): number {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d) + minutes * MIN;
  const first = guess - londonOffsetMinutes(guess) * MIN;
  const second = guess - londonOffsetMinutes(first) * MIN;
  return second;
}

/** YYYY-MM-DD of the London day containing `ms`. */
export function londonDate(ms: number): string {
  return londonParts(ms).date;
}

/** Add whole calendar days to a YYYY-MM-DD string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * DAY;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** A legacy `calls` row (London wall-clock) as a busy interval. */
export function callToBusy(call: {
  call_date: string;
  call_time: string;
  duration_min: number | null;
}): BusyInterval {
  const start = londonToUtc(call.call_date, minutesOf(call.call_time));
  return { start, end: start + (call.duration_min ?? 30) * MIN };
}

/** A `bookings` row as a busy interval. */
export function bookingToBusy(b: { starts_at: string; ends_at: string }): BusyInterval {
  return { start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) };
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

export type GenerateInput = {
  from: string; // London YYYY-MM-DD inclusive
  to: string; // inclusive
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  busy: BusyInterval[];
  settings: BookingSettings;
  now?: number; // UTC ms, defaults to Date.now()
};

/**
 * Every bookable slot between `from` and `to` (London dates, inclusive),
 * honouring: inactive settings, the min-notice window, the max-days-ahead
 * horizon, whole-day and part-day exceptions, and existing diary entries
 * padded by the buffer on both sides.
 */
export function generateSlots(input: GenerateInput): Slot[] {
  const { rules, exceptions, busy, settings } = input;
  const now = input.now ?? Date.now();
  if (!settings.active) return [];

  const today = londonDate(now);
  const horizon = addDays(today, settings.max_days_ahead);
  const earliest = now + settings.min_notice_hours * 60 * MIN;
  const buffer = settings.buffer_minutes * MIN;

  const activeRules = rules.filter((r) => r.active);
  const byDate = new Map<string, AvailabilityException[]>();
  for (const ex of exceptions) {
    const list = byDate.get(ex.date) ?? [];
    list.push(ex);
    byDate.set(ex.date, list);
  }

  const out: Slot[] = [];
  let date = input.from < today ? today : input.from;
  const last = input.to < horizon ? input.to : horizon;

  while (date <= last) {
    const dayExceptions = byDate.get(date) ?? [];
    const wholeDayBlocked = dayExceptions.some((e) => e.start_time == null);
    if (!wholeDayBlocked) {
      const weekday = londonParts(londonToUtc(date, 12 * 60)).weekday;
      for (const rule of activeRules) {
        if (rule.weekday !== weekday) continue;
        const startMin = minutesOf(rule.start_time);
        const endMin = minutesOf(rule.end_time);
        const step = Math.max(5, rule.slot_minutes);
        for (let m = startMin; m + step <= endMin; m += step) {
          const start = londonToUtc(date, m);
          const end = start + step * MIN;
          if (start < earliest) continue;
          const blockedByException = dayExceptions.some((e) => {
            if (e.start_time == null || e.end_time == null) return false;
            const exStart = londonToUtc(date, minutesOf(e.start_time));
            const exEnd = londonToUtc(date, minutesOf(e.end_time));
            return overlaps(start, end, exStart, exEnd);
          });
          if (blockedByException) continue;
          const blockedByDiary = busy.some((b) =>
            overlaps(start, end, b.start - buffer, b.end + buffer)
          );
          if (blockedByDiary) continue;
          out.push({
            startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(),
            date,
            time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
          });
        }
      }
    }
    date = addDays(date, 1);
  }

  // Rules can overlap (two windows covering the same minute): de-duplicate and
  // order by start so the picker can render straight from the array.
  const seen = new Set<string>();
  return out
    .filter((s) => (seen.has(s.startsAt) ? false : (seen.add(s.startsAt), true)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Is this exact instant one of the generated slots? Used by the POST route. */
export function isSlotAvailable(input: GenerateInput, startsAt: string): Slot | null {
  const ms = Date.parse(startsAt);
  if (!Number.isFinite(ms)) return null;
  const date = londonDate(ms);
  const slots = generateSlots({ ...input, from: date, to: date });
  const wanted = new Date(ms).toISOString();
  return slots.find((s) => s.startsAt === wanted) ?? null;
}
