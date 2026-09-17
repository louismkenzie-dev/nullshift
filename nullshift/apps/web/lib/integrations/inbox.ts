/**
 * Inbox — durable capture of provider events (brief §10.2 "persist a
 * deduplicated event durably … acknowledge after durable capture", §12.4
 * "capture inbound events even when a downstream provider is unavailable";
 * migration 0063 `integration_events`).
 *
 * `capture` is the FIRST thing a webhook does after signature verification
 * and the only thing it must finish before answering 200. Identity is
 * (provider, environment, event_ref); a unique violation is reported as
 * `duplicate` and the caller processes nothing for it. Processing happens
 * afterwards, from the stored row, by re-reading the provider resource.
 */

import { flagOn } from "@/lib/flags";
import type { Environment } from "@/lib/billing/activation";
import {
  isUniqueViolation,
  type EventRow,
  type EventStatus,
  type InboundEvent,
  type OpsStore,
  type StoreError,
} from "./types";

export type CaptureResult =
  | { outcome: "captured"; id: string }
  | { outcome: "duplicate" }
  | { outcome: "flag_off" }
  | { outcome: "error"; error: StoreError };

/** Durable insert first; a unique violation on (provider, environment, event_ref) is `duplicate`. */
export async function capture(
  store: OpsStore,
  event: InboundEvent
): Promise<CaptureResult> {
  if (!flagOn("integrationWorkers")) return { outcome: "flag_off" };
  if (!event.eventRef)
    return { outcome: "error", error: { message: "event_ref is required" } };
  const r = await store.insertEvent(event);
  if (r.ok) return { outcome: "captured", id: r.id };
  if (isUniqueViolation(r.error)) return { outcome: "duplicate" };
  return { outcome: "error", error: r.error };
}

export async function markEvent(
  store: OpsStore,
  id: string,
  status: Exclude<EventStatus, "received">,
  now: string,
  error: string | null = null
): Promise<void> {
  await store.setEventStatus(id, status, error, status === "failed" ? null : now);
}

/* ── GoCardless event → inbox row ────────────────────────────────────────── */

export type GoCardlessWebhookEvent = {
  id: string;
  resource_type: string;
  action: string;
  created_at?: string;
  links?: Record<string, string | undefined>;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/** The provider resource a GoCardless event is about, by resource type. */
export function gocardlessResourceRef(e: GoCardlessWebhookEvent): string | null {
  const l = e.links ?? {};
  switch (e.resource_type) {
    case "payments":
      return l.payment ?? null;
    case "mandates":
      return l.mandate ?? null;
    case "subscriptions":
      return l.subscription ?? null;
    case "billing_requests":
      return l.billing_request ?? null;
    case "payouts":
      return l.payout ?? null;
    case "refunds":
      return l.refund ?? null;
    default:
      return null;
  }
}

/**
 * Map a verified GoCardless event to an inbox row. `environment` comes from
 * configuration (the endpoint's secret belongs to exactly one GoCardless
 * environment), never from the body.
 */
export function gocardlessEventToInbound(
  e: GoCardlessWebhookEvent,
  environment: Environment,
  receivedAt: string
): InboundEvent {
  return {
    provider: "gocardless",
    environment,
    accountRef: null,
    eventRef: e.id,
    eventType: `${e.resource_type}.${e.action}`,
    resourceType: e.resource_type,
    resourceRef: gocardlessResourceRef(e),
    payload: {
      id: e.id,
      resource_type: e.resource_type,
      action: e.action,
      created_at: e.created_at ?? null,
      links: e.links ?? {},
      details: e.details ?? {},
    },
    receivedAt,
  };
}

/** The GoCardless environment this deployment is configured for. */
export function gocardlessEnvironment(): Environment {
  return process.env.GOCARDLESS_ENVIRONMENT === "live" ? "live" : "sandbox";
}

/** Convenience for processors: the links object as stored in the payload. */
export function eventLinks(e: EventRow): Record<string, string> {
  const links = e.payload.links;
  if (!links || typeof links !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(links as Record<string, unknown>))
    if (typeof v === "string") out[k] = v;
  return out;
}
