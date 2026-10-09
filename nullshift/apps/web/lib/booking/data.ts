import "server-only";
import { createServiceClient } from "@nullshift/db";
import {
  addDays,
  bookingToBusy,
  callToBusy,
  generateSlots,
  londonDate,
  londonToUtc,
  type AvailabilityException,
  type AvailabilityRule,
  type BookingSettings,
  type BusyInterval,
  type GenerateInput,
  type Slot,
} from "./slots";

/**
 * Server-side loader for the booking engine: pulls rules, exceptions, settings
 * and everything already in the diary (bookings + legacy `calls`) through the
 * service client, then hands them to the pure generator. The public never
 * reads these tables directly — RLS is staff-only (0070).
 */

export type LoadedSettings = BookingSettings & {
  meeting_link: string | null;
  timezone: string;
};

export const DEFAULT_SETTINGS: LoadedSettings = {
  timezone: "Europe/London",
  min_notice_hours: 12,
  max_days_ahead: 30,
  buffer_minutes: 15,
  meeting_link: null,
  active: true,
};

export async function loadBookingSettings(): Promise<LoadedSettings> {
  const db = createServiceClient();
  const { data } = await db
    .from("booking_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    timezone: data.timezone ?? DEFAULT_SETTINGS.timezone,
    min_notice_hours: Number(data.min_notice_hours ?? 12),
    max_days_ahead: Number(data.max_days_ahead ?? 30),
    buffer_minutes: Number(data.buffer_minutes ?? 15),
    meeting_link: data.meeting_link ?? null,
    active: data.active !== false,
  };
}

/** Everything the generator needs for London dates `from`..`to` (inclusive). */
export async function loadGenerateInput(
  from: string,
  to: string,
  now = Date.now()
): Promise<GenerateInput & { settings: LoadedSettings }> {
  const db = createServiceClient();
  // Busy lookups are padded by a day either side so buffers at midnight and
  // UTC/London offsets never hide a diary entry.
  const busyFromDate = addDays(from, -1);
  const busyToDate = addDays(to, 1);
  const busyFrom = new Date(londonToUtc(busyFromDate, 0)).toISOString();
  const busyTo = new Date(londonToUtc(busyToDate, 24 * 60)).toISOString();

  const [settings, rules, exceptions, bookings, calls] = await Promise.all([
    loadBookingSettings(),
    db
      .from("availability_rules")
      .select("weekday,start_time,end_time,slot_minutes,active"),
    db
      .from("availability_exceptions")
      .select("date,start_time,end_time")
      .gte("date", busyFromDate)
      .lte("date", busyToDate),
    db
      .from("bookings")
      .select("starts_at,ends_at")
      .eq("status", "confirmed")
      .gte("starts_at", busyFrom)
      .lte("starts_at", busyTo),
    db
      .from("calls")
      .select("call_date,call_time,duration_min")
      .eq("status", "confirmed")
      .gte("call_date", busyFromDate)
      .lte("call_date", busyToDate),
  ]);

  const busy: BusyInterval[] = [
    ...((bookings.data ?? []) as { starts_at: string; ends_at: string }[]).map(
      bookingToBusy
    ),
    ...(
      (calls.data ?? []) as {
        call_date: string;
        call_time: string;
        duration_min: number | null;
      }[]
    )
      .filter((c) => /^\d{2}:\d{2}/.test(c.call_time ?? ""))
      .map(callToBusy),
  ];

  return {
    from,
    to,
    rules: (rules.data ?? []) as AvailabilityRule[],
    exceptions: (exceptions.data ?? []) as AvailabilityException[],
    busy,
    settings,
    now,
  };
}

export async function loadSlots(from: string, to: string): Promise<Slot[]> {
  return generateSlots(await loadGenerateInput(from, to));
}

/** Today's London date — the picker's lower bound. */
export const todayLondon = () => londonDate(Date.now());
