import Anthropic from "@anthropic-ai/sdk";

/** Single Anthropic client + model constants for every Nullshift agent.
 *  Server-only. Reads ANTHROPIC_API_KEY from the environment; constructed
 *  lazily so builds without the key still succeed (routes fail gracefully). */

export const MODEL = "claude-opus-5";

/** Opus 5 pricing, USD per million tokens — for run-cost logging. */
export const PRICE_IN_PER_MTOK = 5;
export const PRICE_OUT_PER_MTOK = 25;
export const PRICE_CACHE_READ_PER_MTOK = 0.5;

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

export function agentsConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function costUsd(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
}): number {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return (
    (usage.input_tokens * PRICE_IN_PER_MTOK +
      usage.output_tokens * PRICE_OUT_PER_MTOK +
      cacheRead * PRICE_CACHE_READ_PER_MTOK) /
    1_000_000
  );
}
