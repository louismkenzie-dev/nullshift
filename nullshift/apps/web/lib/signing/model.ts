import { createHash, randomBytes } from "node:crypto";
import {
  buildAcceptanceSnapshot,
  verifySnapshot,
  type AcceptanceSnapshot,
  type FrozenSnapshot,
  type JsonValue,
} from "@/lib/legal/acceptanceSnapshot";
import { blocksFromJson, hasSignableContent, type Block } from "./blocks";

/**
 * Signature requests — the pure rules behind migration 0068.
 *
 * Everything the server actions, the signing page and the tests must agree
 * on lives here, with no I/O: the vocabulary, the state machine, what makes a
 * draft issuable and an issued document signable, how the single-use link is
 * minted and checked, how money is parsed and shown, and how the frozen
 * snapshot is built.
 *
 * The evidential idea, in one line: the signer signs a HASH. The document is
 * canonicalised and hashed at issue; the signing page renders from that
 * snapshot, never the live row; the signature event records the hash it was
 * shown; and anyone can later recompute the hash from the stored snapshot
 * and see that nothing moved.
 */

/* ── Vocabulary (mirrors the 0068 CHECK constraints) ─────────────────────── */

export const SIGNATURE_KINDS = [
  "change_order",
  "proposal_addendum",
  "agreement",
  "letter",
  "other",
] as const;
export type SignatureKind = (typeof SIGNATURE_KINDS)[number];

export const KIND_LABEL: Record<SignatureKind, string> = {
  change_order: "Change Order",
  proposal_addendum: "Proposal follow-up",
  agreement: "Agreement",
  letter: "Letter of instruction",
  other: "Document",
};

export const SIGNATURE_STATUSES = [
  "draft",
  "issued",
  "signed",
  "completed",
  "declined",
  "voided",
  "expired",
] as const;
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[number];

export const STATUS_LABEL: Record<SignatureStatus, string> = {
  draft: "Draft",
  issued: "Awaiting signature",
  signed: "Signed — awaiting countersignature",
  completed: "Completed",
  declined: "Declined",
  voided: "Voided",
  expired: "Expired",
};

/** For the client's own view: the same facts in their words. */
export const STATUS_LABEL_CLIENT: Record<SignatureStatus, string> = {
  draft: "Being prepared",
  issued: "Waiting for your signature",
  signed: "Signed — Nullshift to countersign",
  completed: "Signed by both parties",
  declined: "Declined",
  voided: "Withdrawn by Nullshift",
  expired: "Link expired",
};

export type Tone = "danger" | "warning" | "success" | "muted" | "accent";
export function statusTone(status: SignatureStatus): Tone {
  switch (status) {
    case "completed":
      return "success";
    case "issued":
      return "warning";
    case "signed":
      return "accent";
    case "declined":
    case "expired":
      return "danger";
    default:
      return "muted";
  }
}

/** Nothing moves on from these. */
export const TERMINAL_STATUSES: readonly SignatureStatus[] = [
  "completed",
  "declined",
  "voided",
  "expired",
];
export const isTerminal = (s: SignatureStatus) => TERMINAL_STATUSES.includes(s);

/* ── The signer's confirmations ──────────────────────────────────────────── */

/**
 * Four confirmations, all unchecked by default, all required. Three mirror
 * the Order Form clickwrap; the fourth is the e-signature consent itself —
 * the signer agreeing that their typed name is their signature. `{client}` is
 * replaced with the client's name.
 */
export const SIGNING_CONSENTS = [
  {
    id: "authority",
    label: "I am authorised to sign this on behalf of {client}.",
  },
  {
    id: "read",
    label: "I have read the whole of this document, including any costing.",
  },
  {
    id: "esign",
    label:
      "I agree to sign electronically, and to receive the signed copy and the signing record by email.",
  },
  {
    id: "bound",
    label:
      "I intend my typed signature below to be legally binding, exactly as a handwritten signature would be.",
  },
] as const;
export type ConsentId = (typeof SIGNING_CONSENTS)[number]["id"];
export type Consent = Record<ConsentId, boolean>;

export function allConsentsGiven(c: Partial<Record<ConsentId, boolean>>): boolean {
  return SIGNING_CONSENTS.every((x) => c[x.id] === true);
}

/* ── Money ───────────────────────────────────────────────────────────────── */

export type CommercialLine = { label: string; amountMinor: number };
export type Commercial = {
  lines: CommercialLine[];
  /** Sum of the lines, in minor units. Null when there are no lines. */
  totalMinor: number | null;
  currency: string;
  /** e.g. "One-off build price. No change to existing running costs." */
  note: string | null;
};

export const EMPTY_COMMERCIAL: Commercial = {
  lines: [],
  totalMinor: null,
  currency: "GBP",
  note: null,
};

/** "£1,195.00" / "-£328.75" / "1195" → minor units; null when not money. */
export function parseMoneyToMinor(input: string): number | null {
  const s = input.trim().replace(/[£$€,\s]/g, "");
  if (!s) return null;
  const m = /^(-|−|\+)?(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const sign = m[1] === "-" || m[1] === "−" ? -1 : 1;
  const pounds = Number(m[2]);
  const pence = m[3] ? Number((m[3] + "0").slice(0, 2)) : 0;
  return sign * (pounds * 100 + pence);
}

export function formatMinor(minor: number, currency = "GBP"): string {
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const pence = abs % 100;
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency + " ";
  const text = `${symbol}${major.toLocaleString("en-GB")}.${String(pence).padStart(2, "0")}`;
  return minor < 0 ? `−${text}` : text;
}

/**
 * Lines as staff type them, one per line: `Label | £1,195.00`. A line with
 * no amount is ignored; a line whose amount does not parse is reported.
 */
export function commercialFromText(
  text: string,
  opts: { currency?: string; note?: string | null } = {}
): { commercial: Commercial; problems: string[] } {
  const lines: CommercialLine[] = [];
  const problems: string[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.lastIndexOf("|");
    if (idx === -1) {
      problems.push(`"${line}" has no amount — write it as "Label | £0.00".`);
      continue;
    }
    const label = line.slice(0, idx).trim();
    const amount = parseMoneyToMinor(line.slice(idx + 1));
    if (!label) {
      problems.push(`A line is missing its label.`);
      continue;
    }
    if (amount === null) {
      problems.push(`"${label}": "${line.slice(idx + 1).trim()}" is not an amount.`);
      continue;
    }
    lines.push({ label, amountMinor: amount });
  }
  const currency = (opts.currency ?? "GBP").toUpperCase();
  return {
    commercial: {
      lines,
      totalMinor: lines.length ? lines.reduce((s, l) => s + l.amountMinor, 0) : null,
      currency,
      note: opts.note?.trim() || null,
    },
    problems,
  };
}

/** The reverse: a Commercial back into the text staff edit. */
export function commercialToText(c: Commercial): string {
  return c.lines.map((l) => `${l.label} | ${formatMinor(l.amountMinor, c.currency)}`).join("\n");
}

export function parseCommercial(value: unknown): Commercial {
  if (!value || typeof value !== "object") return EMPTY_COMMERCIAL;
  const v = value as Record<string, unknown>;
  const lines: CommercialLine[] = Array.isArray(v.lines)
    ? v.lines
        .filter(
          (l): l is { label: string; amountMinor: number } =>
            !!l &&
            typeof l === "object" &&
            typeof (l as Record<string, unknown>).label === "string" &&
            typeof (l as Record<string, unknown>).amountMinor === "number"
        )
        .map((l) => ({ label: l.label, amountMinor: Math.trunc(l.amountMinor) }))
    : [];
  return {
    lines,
    totalMinor:
      typeof v.totalMinor === "number"
        ? Math.trunc(v.totalMinor)
        : lines.length
          ? lines.reduce((s, l) => s + l.amountMinor, 0)
          : null,
    currency: typeof v.currency === "string" && /^[A-Z]{3}$/.test(v.currency) ? v.currency : "GBP",
    note: typeof v.note === "string" && v.note.trim() ? v.note : null,
  };
}

/* ── The single-use link ─────────────────────────────────────────────────── */

export const SIGNING_LINK_DAYS = 30;
/** 32 random bytes, base64url: 43 characters. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function generateSigningToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What is stored. The token itself never is. */
export function hashSigningToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const isTokenShaped = (token: unknown): token is string =>
  typeof token === "string" && TOKEN_RE.test(token);

export function linkExpiresAt(issuedAt: Date, days = SIGNING_LINK_DAYS): string {
  return new Date(issuedAt.getTime() + days * 86_400_000).toISOString();
}

export function linkExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  return !Number.isFinite(t) || t <= now.getTime();
}

/* ── Rows and shapes ─────────────────────────────────────────────────────── */

export type SignatureRequestRow = {
  id: string;
  tenant_id: string;
  project_id: string | null;
  reference: string;
  kind: SignatureKind;
  title: string;
  status: SignatureStatus;
  body_source: string;
  body_blocks: unknown;
  commercial: unknown;
  document_snapshot: unknown;
  document_hash: string | null;
  incorporated_versions: unknown;
  signer_name: string;
  signer_email: string;
  signer_role: string | null;
  token_hash: string | null;
  issued_at: string | null;
  issued_by: string | null;
  expires_at: string | null;
  signed_at: string | null;
  countersigned_at: string | null;
  countersigned_by: string | null;
  completed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  voided_at: string | null;
  void_reason: string | null;
  change_order_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SignatureEventRow = {
  id: string;
  request_id: string;
  kind:
    | "issued"
    | "resent"
    | "link_opened"
    | "viewed"
    | "signed"
    | "countersigned"
    | "declined"
    | "voided"
    | "reminder_sent"
    | "expired";
  actor_kind: "client" | "staff" | "system";
  actor_user: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  signature_text: string | null;
  consent: unknown;
  document_hash: string | null;
  ip_address: string | null;
  user_agent: string | null;
  at: string;
  meta: unknown;
};

export const EVENT_LABEL: Record<SignatureEventRow["kind"], string> = {
  issued: "Sent for signature",
  resent: "Link re-sent",
  link_opened: "Link opened",
  viewed: "Document viewed",
  signed: "Signed",
  countersigned: "Countersigned by Nullshift",
  declined: "Declined",
  voided: "Voided",
  reminder_sent: "Reminder sent",
  expired: "Link expired",
};

/** The content the signer sees — what the snapshot carries. */
export type SigningContent = {
  reference: string;
  title: string;
  kind: SignatureKind;
  client: { name: string };
  signer: { name: string; email: string; role: string | null };
  blocks: Block[];
  commercial: Commercial;
  /** Fixed closing wording, part of the hashed document. */
  agreement: string[];
  issuedAt: string;
};

export type Problem = { code: string; detail: string };
export type Decision = { ok: true } | { ok: false; problems: Problem[] };
const decide = (problems: Problem[]): Decision =>
  problems.length ? { ok: false, problems } : { ok: true };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ── State machine ───────────────────────────────────────────────────────── */

/** Draft → issued. The document must actually say something and name a signer. */
export function canIssue(r: {
  status: SignatureStatus;
  title: string;
  blocks: Block[];
  signerName: string;
  signerEmail: string;
}): Decision {
  const problems: Problem[] = [];
  if (r.status !== "draft")
    problems.push({ code: "not_draft", detail: `Only a draft can be issued (this is ${r.status}).` });
  if (!r.title.trim()) problems.push({ code: "title_required", detail: "Give the document a title." });
  if (!hasSignableContent(r.blocks))
    problems.push({
      code: "body_required",
      detail: "The document has no content to sign — write the body first.",
    });
  if (!r.signerName.trim())
    problems.push({ code: "signer_name_required", detail: "Name the person who will sign." });
  if (!EMAIL_RE.test(r.signerEmail.trim()))
    problems.push({ code: "signer_email_invalid", detail: "The signer's email address is not valid." });
  return decide(problems);
}

/** Issued → signed, from the signer's side. */
export function canSign(
  r: { status: SignatureStatus; expiresAt: string | null; snapshotVerified: boolean },
  input: { name: string; consents: Partial<Record<ConsentId, boolean>> },
  now: Date = new Date()
): Decision {
  const problems: Problem[] = [];
  if (r.status !== "issued")
    problems.push({
      code: "not_issued",
      detail:
        r.status === "signed" || r.status === "completed"
          ? "This document has already been signed."
          : `This document is ${STATUS_LABEL[r.status].toLowerCase()} and cannot be signed.`,
    });
  if (linkExpired(r.expiresAt, now))
    problems.push({
      code: "expired",
      detail: "This signing link has expired. Ask Nullshift to send a fresh one.",
    });
  if (!r.snapshotVerified)
    problems.push({
      code: "snapshot_invalid",
      detail: "The document's stored content does not match its hash; it cannot be signed.",
    });
  if (!input.name.trim())
    problems.push({ code: "name_required", detail: "Type your full name as your signature." });
  if (!allConsentsGiven(input.consents))
    problems.push({ code: "consent_required", detail: "All four confirmations are required." });
  return decide(problems);
}

/** Signed → completed, Nullshift's side. */
export function canCountersign(r: { status: SignatureStatus; snapshotVerified: boolean }): Decision {
  const problems: Problem[] = [];
  if (r.status !== "signed")
    problems.push({
      code: "not_signed",
      detail:
        r.status === "completed"
          ? "Already countersigned."
          : "The client has not signed yet; countersign after they have.",
    });
  if (!r.snapshotVerified)
    problems.push({ code: "snapshot_invalid", detail: "The stored document does not verify." });
  return decide(problems);
}

/** Staff may withdraw anything that is not finished. */
export function canVoid(r: { status: SignatureStatus }): Decision {
  return isTerminal(r.status)
    ? { ok: false, problems: [{ code: "terminal", detail: `A ${r.status} document cannot be voided.` }] }
    : { ok: true };
}

/** The signer may decline while it is theirs to sign. */
export function canDecline(r: { status: SignatureStatus }): Decision {
  return r.status === "issued"
    ? { ok: true }
    : { ok: false, problems: [{ code: "not_issued", detail: "Nothing is awaiting your decision." }] };
}

/** Rotating the link is only meaningful while the signer still has to act. */
export function canResend(r: { status: SignatureStatus }): Decision {
  return r.status === "issued"
    ? { ok: true }
    : { ok: false, problems: [{ code: "not_issued", detail: "The link can only be re-sent while awaiting signature." }] };
}

/* ── Snapshot ────────────────────────────────────────────────────────────── */

export const ESIGN_TEMPLATE_VERSION = "ESIGN_2026_10_v1";

/**
 * The fixed wording that closes every signable document. Part of the hashed
 * content, so it is here and not in a component. Deliberately plain: the
 * document above says what is being agreed; this says that signing agrees it.
 */
export function agreementClauses(input: {
  kind: SignatureKind;
  clientName: string;
  nullshiftName: string;
  msaVersion: string | null;
  hasCommercial: boolean;
}): string[] {
  const out: string[] = [];
  const subject =
    input.kind === "change_order" || input.kind === "proposal_addendum"
      ? "the work described in this document"
      : "the terms set out in this document";
  out.push(
    `By signing, ${input.clientName} agrees to ${subject}${
      input.hasCommercial ? " at the price stated" : ""
    }, and ${input.nullshiftName} agrees to carry it out as described. Each party's signature below is its acceptance of this document.`
  );
  if (input.msaVersion)
    out.push(
      `This document is made under, and incorporates, the Nullshift Service & Support Terms (${input.msaVersion}) in force between the parties. Where the two differ on the work described here, this document takes priority for that work only.`
    );
  out.push(
    "Each party agrees that an electronic signature given on this page — a typed name, with the confirmations recorded alongside it — is their signature for the purposes of the Electronic Communications Act 2000, and that the signing record kept by Nullshift Development Ltd is an accurate record of when and by whom this document was signed."
  );
  return out;
}

export function buildSigningSnapshot(content: SigningContent, incorporatedVersions: Record<string, string> = {}): FrozenSnapshot {
  return buildAcceptanceSnapshot({
    documentType: "signature_request",
    documentId: content.reference,
    versionNo: 1,
    templateVersion: ESIGN_TEMPLATE_VERSION,
    content: content as unknown as JsonValue,
    incorporatedVersions,
  });
}

/** Read the signer-facing content back from a stored snapshot, or null if it does not verify. */
export function signingContentFrom(
  snapshot: unknown,
  hash: string | null
): SigningContent | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (!verifySnapshot(snapshot as never, hash)) return null;
  const c = (snapshot as AcceptanceSnapshot).content as unknown as Record<string, unknown>;
  if (!c || typeof c !== "object") return null;
  const client = (c.client ?? {}) as Record<string, unknown>;
  const signer = (c.signer ?? {}) as Record<string, unknown>;
  return {
    reference: String(c.reference ?? ""),
    title: String(c.title ?? ""),
    kind: (SIGNATURE_KINDS as readonly string[]).includes(c.kind as string)
      ? (c.kind as SignatureKind)
      : "other",
    client: { name: String(client.name ?? "") },
    signer: {
      name: String(signer.name ?? ""),
      email: String(signer.email ?? ""),
      role: typeof signer.role === "string" ? signer.role : null,
    },
    blocks: blocksFromJson(c.blocks),
    commercial: parseCommercial(c.commercial),
    agreement: Array.isArray(c.agreement)
      ? c.agreement.filter((x): x is string => typeof x === "string")
      : [],
    issuedAt: String(c.issuedAt ?? ""),
  };
}

/** A short, human-checkable fingerprint of the document hash: 4 groups of 4. */
export function hashFingerprint(hash: string | null): string {
  if (!hash) return "—";
  return hash.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

/* ── Events → the signing record ─────────────────────────────────────────── */

export type SigningRecordLine = {
  at: string;
  label: string;
  who: string;
  detail: string | null;
};

/** The audit trail as printed on the completion certificate. */
export function signingRecord(events: SignatureEventRow[]): SigningRecordLine[] {
  return [...events]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((e) => {
      const who =
        e.actor_kind === "system"
          ? "System"
          : [e.actor_name, e.actor_email ? `<${e.actor_email}>` : null]
              .filter(Boolean)
              .join(" ") || (e.actor_kind === "staff" ? "Nullshift" : "Signer");
      const bits: string[] = [];
      if (e.kind === "signed" || e.kind === "countersigned") {
        if (e.actor_role) bits.push(e.actor_role);
        if (e.signature_text) bits.push(`signed as "${e.signature_text}"`);
        if (e.document_hash) bits.push(`document ${hashFingerprint(e.document_hash)}`);
      }
      if (e.ip_address) bits.push(`IP ${e.ip_address}`);
      if (e.kind === "declined" && e.meta && typeof e.meta === "object") {
        const reason = (e.meta as Record<string, unknown>).reason;
        if (typeof reason === "string" && reason) bits.push(`reason: ${reason}`);
      }
      return {
        at: e.at,
        label: EVENT_LABEL[e.kind] ?? e.kind,
        who,
        detail: bits.length ? bits.join(" · ") : null,
      };
    });
}
