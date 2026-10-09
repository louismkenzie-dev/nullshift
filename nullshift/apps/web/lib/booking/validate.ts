/** Pure validation for a website booking request (shared by the POST route). */

export const BOOKING_KINDS = ["client", "partner"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

export type BookingRequest = {
  kind: BookingKind;
  startsAt: string; // ISO UTC
  name: string;
  email: string;
  company: string;
  website: string;
  phone: string;
  notes: string;
};

export type BookingField = keyof BookingRequest;
export type BookingErrors = Partial<Record<BookingField, string>>;

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function validateBooking(
  input: unknown
): { ok: true; data: BookingRequest } | { ok: false; errors: BookingErrors } {
  const body =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: BookingErrors = {};
  const text = (key: BookingField, min: number, max: number) => {
    const raw = body[key];
    if (raw !== undefined && typeof raw !== "string") errors[key] = "Please enter text.";
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length < min) errors[key] = "Please complete this field.";
    if (value.length > max) errors[key] = `Please use no more than ${max} characters.`;
    if (CONTROL.test(value)) errors[key] = "Please remove unsupported characters.";
    return value;
  };
  const kind = text("kind", 1, 20);
  const data: BookingRequest = {
    kind: (BOOKING_KINDS as readonly string[]).includes(kind)
      ? (kind as BookingKind)
      : "client",
    startsAt: text("startsAt", 1, 40),
    name: text("name", 2, 100),
    email: text("email", 3, 254).toLowerCase(),
    company: text("company", 0, 160),
    website: text("website", 0, 200),
    phone: text("phone", 0, 40),
    notes: text("notes", 0, 2000),
  };
  if (!(BOOKING_KINDS as readonly string[]).includes(kind))
    errors.kind = "Choose a call type.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.email = "Enter a valid email address.";
  const ms = Date.parse(data.startsAt);
  if (!Number.isFinite(ms)) errors.startsAt = "Choose a time slot.";
  else data.startsAt = new Date(ms).toISOString();
  if (data.website && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(data.website))
    errors.website = "Enter a website address, e.g. yourbusiness.co.uk.";
  if (data.phone && !/^[+\d][\d\s().-]{5,}$/.test(data.phone))
    errors.phone = "Enter a phone number.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
