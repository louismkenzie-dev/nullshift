import {
  SCAN_SQL,
  analyseDatabase,
  buildFollowUpSql,
  parseFollowUp,
  parseScan,
} from "../dbAnalysis";
import type { DatabaseEvidence } from "../types";

/**
 * Read a client's production database through the Supabase Management API
 * (read-only SQL against the project named on the system passport). Needs a
 * personal access token — supabase.com/dashboard/account/tokens — in
 * SUPABASE_ACCESS_TOKEN; the token's owner must be a member of the client
 * project's organisation. Unset = the database half of the scan is skipped
 * and the record says so.
 */

const API = "https://api.supabase.com/v1";
const TIMEOUT_MS = 20_000;
const REF_RE = /^[a-z]{20}$/;

export function isSupabaseManagementConfigured(): boolean {
  return !!process.env.SUPABASE_ACCESS_TOKEN;
}

export async function runManagementQuery(ref: string, query: string): Promise<unknown> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN not set");
  if (!REF_RE.test(ref)) throw new Error(`"${ref}" is not a Supabase project ref`);
  const res = await fetch(`${API}/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, read_only: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Supabase management query → ${res.status}: ${text.slice(0, 200) || res.statusText}`
    );
  }
  return text ? JSON.parse(text) : null;
}

export async function collectDatabaseEvidence(ref: string): Promise<DatabaseEvidence> {
  const scanRows = await runManagementQuery(ref, SCAN_SQL);
  const scan = parseScan(scanRows);
  if (!scan) throw new Error("The scan query returned nothing readable");
  const follow = buildFollowUpSql(scan);
  let extra: Record<string, number | null> = {};
  if (follow) {
    try {
      extra = parseFollowUp(await runManagementQuery(ref, follow.sql));
    } catch (e) {
      // A client schema quirk must not lose the whole scan — the counts it
      // would have added simply fall back to what the first pass saw.
      console.warn("[auto-score] follow-up query failed:", e);
    }
  }
  return analyseDatabase(ref, scan, extra);
}
