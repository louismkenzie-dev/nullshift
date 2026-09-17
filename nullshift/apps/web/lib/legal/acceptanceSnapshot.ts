import { createHash } from "node:crypto";

/**
 * Acceptance snapshots (brief §9, §17.1 "Catalogue/formula is edited").
 *
 * What a client accepted is the exact content shown to them, frozen at issue
 * and hashed. It is never regenerated from today's mutable catalogue, price
 * list or template: the snapshot travels with the acceptance row
 * (contract_acceptances.order_form_snapshot, service_schedules.document_snapshot,
 * handover_schedules.document_snapshot) and its sha256 lets anyone check the
 * stored content still matches what was signed.
 *
 * Canonical form: JSON with object keys sorted recursively, arrays in their
 * given order, `undefined` members dropped, no whitespace. Two documents with
 * the same facts always hash the same, regardless of construction order.
 * Pure: no I/O.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Something a snapshot can be built from: plain data, possibly with undefined holes. */
export type SnapshotInput =
  | JsonPrimitive
  | undefined
  | SnapshotInput[]
  | { [key: string]: SnapshotInput };

export const SNAPSHOT_ALGORITHM = "sha256" as const;
export const SNAPSHOT_FORMAT = "canonical-json-v1" as const;

/**
 * Canonical JSON text for `value`. Throws on values that have no stable JSON
 * representation (NaN, Infinity, functions, bigint) — an evidence hash over
 * an ambiguous value is worse than no hash.
 */
export function canonicalJson(value: SnapshotInput): string {
  return JSON.stringify(canonicalise(value));
}

/** Sorted-key, undefined-free copy of `value` (the structure the hash covers). */
export function canonicalise(value: SnapshotInput): JsonValue {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("acceptanceSnapshot: non-finite numbers cannot be snapshotted");
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => canonicalise(v));
  if (typeof value === "object") {
    const out: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as { [key: string]: SnapshotInput })[key];
      if (v === undefined) continue;
      out[key] = canonicalise(v);
    }
    return out;
  }
  throw new Error(`acceptanceSnapshot: unsupported value of type ${typeof value}`);
}

/** sha256 hex of the canonical JSON of `value`. */
export function snapshotHash(value: SnapshotInput): string {
  return createHash(SNAPSHOT_ALGORITHM)
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

export type AcceptanceSnapshot = {
  /** Which kind of document this is the frozen content of. */
  documentType: "order_form_v2" | "service_schedule" | "handover_schedule";
  documentId: string;
  versionNo: number;
  /** Template / policy identifiers so the wording can be traced. */
  templateVersion: string;
  /** The commercial content exactly as issued. */
  content: JsonValue;
  /** Incorporated legal document versions at issue (msa, dpa, aup …). */
  incorporatedVersions: { [key: string]: JsonValue };
  format: typeof SNAPSHOT_FORMAT;
};

export type FrozenSnapshot = {
  snapshot: AcceptanceSnapshot;
  /** sha256 hex over canonicalJson(snapshot). */
  hash: string;
  algorithm: typeof SNAPSHOT_ALGORITHM;
};

export type BuildSnapshotInput = {
  documentType: AcceptanceSnapshot["documentType"];
  documentId: string;
  versionNo: number;
  templateVersion: string;
  content: SnapshotInput;
  incorporatedVersions?: { [key: string]: SnapshotInput };
};

/**
 * Freeze the content that is about to be issued. The returned `snapshot` is
 * what gets stored; `hash` is what gets stored beside it and later compared.
 */
export function buildAcceptanceSnapshot(input: BuildSnapshotInput): FrozenSnapshot {
  if (!input.documentId) throw new Error("acceptanceSnapshot: documentId is required");
  if (!Number.isInteger(input.versionNo) || input.versionNo < 1)
    throw new Error("acceptanceSnapshot: versionNo must be a positive integer");
  const snapshot: AcceptanceSnapshot = {
    documentType: input.documentType,
    documentId: input.documentId,
    versionNo: input.versionNo,
    templateVersion: input.templateVersion,
    content: canonicalise(input.content),
    incorporatedVersions: canonicalise(input.incorporatedVersions ?? {}) as {
      [key: string]: JsonValue;
    },
    format: SNAPSHOT_FORMAT,
  };
  return { snapshot, hash: snapshotHash(snapshot), algorithm: SNAPSHOT_ALGORITHM };
}

/**
 * Does the stored snapshot still hash to the stored hash? False means the
 * stored content was altered after issue (or the hash was) and the document
 * must not be accepted or relied on as evidence.
 */
export function verifySnapshot(
  snapshot: SnapshotInput,
  expectedHash: string | null | undefined
): boolean {
  if (!expectedHash || typeof expectedHash !== "string") return false;
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) return false;
  try {
    return snapshotHash(snapshot) === expectedHash.toLowerCase();
  } catch {
    return false;
  }
}

/** True when two documents would hash differently — i.e. their facts differ. */
export function snapshotDiffers(a: SnapshotInput, b: SnapshotInput): boolean {
  return canonicalJson(a) !== canonicalJson(b);
}

/**
 * The accepted terms, read from the snapshot rather than the live row or the
 * catalogue. Returns null when the snapshot is missing or fails verification,
 * so a caller can never "helpfully" fall back to today's price.
 */
export function acceptedContent<T extends JsonValue = JsonValue>(
  snapshot: AcceptanceSnapshot | null | undefined,
  hash: string | null | undefined
): T | null {
  if (!snapshot) return null;
  if (!verifySnapshot(snapshot, hash)) return null;
  return snapshot.content as T;
}
