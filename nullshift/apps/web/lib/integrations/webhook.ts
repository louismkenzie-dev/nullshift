/**
 * GoCardless webhook, inbox edition — the flag-gated branch the route calls
 * when `integrationWorkers` is on (brief §10.2: verify the signature on the
 * raw payload, persist a deduplicated event durably, acknowledge after
 * durable capture, then process through retryable operations).
 *
 *   1. signature on the RAW body (the existing verifier, unchanged);
 *   2. `capture` every event (unique per provider + environment + event id);
 *      a database failure here answers 500 so GoCardless redelivers and
 *      nothing is lost;
 *   3. answer 200 with the counts;
 *   4. `after()` the response: process each newly captured event from its
 *      stored row by re-reading the provider resource. A processing failure
 *      leaves the event `failed`; the ops-worker cron sweeps it.
 *
 * With the flag off this module is never reached; the route runs the legacy
 * handler exactly as before.
 */

import { after } from "next/server";
import { verifyGoCardlessWebhook } from "@nullshift/billing/gocardless";
import {
  capture,
  gocardlessEnvironment,
  gocardlessEventToInbound,
  type GoCardlessWebhookEvent,
} from "./inbox";
import { processGoCardlessEvent } from "./gocardlessEvents";
import { liveGoCardlessPort } from "./gocardlessClient";
import { supabaseOpsStore } from "./supabaseStore";
import type { OpsStore, GoCardlessPort } from "./types";

export type WebhookDeps = {
  store: OpsStore;
  gocardless: GoCardlessPort;
  now: () => string;
  /** Runs the processing after the response; `after` from next/server in production. */
  defer: (fn: () => Promise<void>) => void;
};

export function liveWebhookDeps(): WebhookDeps {
  return {
    store: supabaseOpsStore(),
    gocardless: liveGoCardlessPort(),
    now: () => new Date().toISOString(),
    defer: (fn) => after(fn),
  };
}

export async function handleGoCardlessWebhookInbox(
  req: Request,
  deps: WebhookDeps = liveWebhookDeps()
): Promise<Response> {
  if (!process.env.GOCARDLESS_WEBHOOK_SECRET)
    return new Response("GoCardless is not configured.", { status: 503 });
  const body = await req.text();
  if (!verifyGoCardlessWebhook(body, req.headers.get("webhook-signature")))
    return new Response("Invalid signature", { status: 401 });

  let events: GoCardlessWebhookEvent[];
  try {
    events = (JSON.parse(body) as { events?: GoCardlessWebhookEvent[] }).events ?? [];
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  const environment = gocardlessEnvironment();
  const receivedAt = deps.now();
  const captured: string[] = [];
  let duplicates = 0;
  for (const e of events) {
    if (
      !e ||
      typeof e.id !== "string" ||
      typeof e.resource_type !== "string" ||
      typeof e.action !== "string"
    )
      continue;
    const r = await capture(
      deps.store,
      gocardlessEventToInbound(e, environment, receivedAt)
    );
    if (r.outcome === "captured") captured.push(r.id);
    else if (r.outcome === "duplicate") duplicates += 1;
    else if (r.outcome === "error") {
      // Not acknowledged: GoCardless will redeliver; already-captured
      // events in this batch will then be duplicates, never double-processed.
      console.error("gocardless inbox capture failed:", r.error.message);
      return new Response("capture error", { status: 500 });
    } else return new Response("inbox disabled", { status: 503 });
  }

  if (captured.length > 0)
    deps.defer(async () => {
      const ctx = { store: deps.store, gocardless: deps.gocardless, now: deps.now() };
      for (const id of captured) {
        const row = await deps.store.getEvent(id);
        if (!row) continue;
        const r = await processGoCardlessEvent(ctx, row);
        if (r.outcome === "failed")
          console.error(`gocardless inbox event ${id} failed: ${r.note}`);
      }
    });

  return Response.json({
    received: true,
    captured: captured.length,
    duplicates,
    environment,
  });
}
