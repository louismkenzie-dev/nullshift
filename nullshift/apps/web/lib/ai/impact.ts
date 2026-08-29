/**
 * AI action impact classification and log redaction (spec §13).
 *
 * Kept free of server-only imports so the rules can be tested directly. The
 * database side lives in `toolLog.ts`; this is the part that decides whether
 * an action needs a human, and what may never reach a log.
 *
 * Two rules, both default-deny:
 *
 *  · An action whose impact is not known is HIGH. A tool nobody has classified
 *    is a tool nobody has thought about, and the safe reading of "we haven't
 *    decided yet" is "ask a human".
 *  · Secrets are redacted before the write, not after. A log that has to be
 *    trusted not to contain credentials is not a control; a log that cannot
 *    contain them is.
 */

export type ToolImpact = "low" | "medium" | "high";

/**
 * Known tools and what they can do. Read-only lookups are low; writes that a
 * person would want to know about are medium; anything that leaves the
 * building, moves money, changes access or cannot be undone is high.
 */
export const TOOL_IMPACT: Record<string, ToolImpact> = {
  // Read-only.
  search: "low",
  fetch_url: "low",
  read_record: "low",
  list_records: "low",
  summarise: "low",

  // Reversible internal writes.
  draft_note: "medium",
  create_task: "medium",
  update_record: "medium",
  tag_lead: "medium",

  // Leaves the building, moves money, or changes who can get in.
  send_email: "high",
  send_sms: "high",
  post_message: "high",
  create_invoice: "high",
  issue_refund: "high",
  charge_card: "high",
  delete_record: "high",
  grant_access: "high",
  revoke_access: "high",
  deploy: "high",
  run_sql: "high",
};

/** Unknown tools are high impact. Silence is not a low-risk signal. */
export const classifyImpact = (tool: string): ToolImpact => TOOL_IMPACT[tool] ?? "high";

/**
 * High-impact actions require confirmation by default. A workflow may only opt
 * out deliberately and per-tool — never by forgetting to opt in.
 */
export const requiresConfirmation = (
  tool: string,
  opts?: { preAuthorised?: boolean }
): boolean => classifyImpact(tool) === "high" && !opts?.preAuthorised;

/* ── redaction ─────────────────────────────────────────────────── */

const SECRET_KEY = /(pass(word|phrase)?|secret|token|api[_-]?key|authorization|auth|cookie|session|private[_-]?key|client[_-]?secret|otp|pin|cvv|cvc|card[_-]?number|pan|iban|sort[_-]?code|account[_-]?number|ssn|nino)/i;

/**
 * Value-shaped secrets: provider key prefixes, bearer tokens, JWTs and long
 * card-like digit runs. Keyed redaction catches the well-named ones; this
 * catches a secret pasted into a field called "note".
 */
const SECRET_VALUE: RegExp[] = [
  /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}\b/,
  /\bwhsec_[A-Za-z0-9]{8,}\b/,
  /\bsk-ant-[A-Za-z0-9_-]{8,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  // 13–19 digits, optionally spaced or hyphenated: a card number, whatever the
  // field is called.
  /\b(?:\d[ -]?){13,19}\b/,
];

export const REDACTED = "[redacted]";

function redactString(s: string): string {
  let out = s;
  for (const re of SECRET_VALUE) out = out.replace(new RegExp(re, "g"), REDACTED);
  return out;
}

/**
 * Deep-redact a value for logging. Redacts by key name and by value shape, and
 * caps depth so a cyclic or enormous argument object cannot become the log.
 */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value))
    return value.slice(0, 100).map((v) => redactSecrets(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? REDACTED : redactSecrets(v, depth + 1);
    }
    return out;
  }
  return REDACTED;
}
