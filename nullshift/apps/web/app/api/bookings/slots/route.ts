import { hasSupabaseServerConfig } from "@nullshift/db/env";
import { loadGenerateInput, todayLondon } from "@/lib/booking/data";
import { addDays, generateSlots } from "@/lib/booking/slots";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/bookings/slots?from=YYYY-MM-DD&to=YYYY-MM-DD&kind=client|partner
 * Available slots (UTC instants + London labels) for the picker. The window is
 * clamped to 45 days so a stray request cannot walk the whole year.
 */
export async function GET(request: Request) {
  if (!hasSupabaseServerConfig())
    return json({ error: "Booking is temporarily unavailable." }, 503);
  const url = new URL(request.url);
  const today = todayLondon();
  const from = url.searchParams.get("from") || today;
  let to = url.searchParams.get("to") || addDays(from, 30);
  if (!DATE.test(from) || !DATE.test(to) || to < from)
    return json({ error: "Invalid date range." }, 400);
  if (to > addDays(from, 45)) to = addDays(from, 45);
  try {
    const input = await loadGenerateInput(from, to);
    const slots = generateSlots(input);
    return json({
      from,
      to,
      today,
      horizon: addDays(today, input.settings.max_days_ahead),
      active: input.settings.active,
      slots,
    });
  } catch (e) {
    console.error("bookings/slots:", e);
    return json({ error: "Could not load availability." }, 503);
  }
}
