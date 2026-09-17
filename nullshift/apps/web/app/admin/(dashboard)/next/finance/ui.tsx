/**
 * Server-safe presentational helpers shared by the Finance pages. No state, no
 * effects, no data access — every value is passed in from a fixture-backed page.
 */
import Link from "next/link";
import { flagOn } from "@/lib/flags";
import {
  BANK_MATCH_LABEL,
  COLLECTION_STATE_LABEL,
  EXCEPTION_STATE_LABEL,
  FRESHNESS,
  MANDATE_LABEL,
  PAYOUT_STATE_LABEL,
  formatMoney,
  type BankMatchState,
  type CollectionState,
  type ExceptionState,
  type InvoiceState,
  type MandateState,
  type Money,
  type PayoutState,
  type SafeRetry,
} from "@/lib/next/fixtures-finance";
import s from "../next.module.css";
import f from "./finance.module.css";

/* ── Tone mapping ──────────────────────────────────────── */

const SUCCESS = new Set([
  "paid",
  "confirmed",
  "matched",
  "authorised",
  "resolved",
  "synced",
  "active",
  "scheduled",
]);
const DANGER = new Set([
  "overdue",
  "failed",
  "cancelled",
  "unmatched",
  "create_failed",
  "payment_sync_failed",
  "open",
]);
const WARNING = new Set([
  "part_paid",
  "issued",
  "pending",
  "late_event",
  "needs_review",
  "awaiting_approval",
  "awaiting_client",
  "authorised_not_scheduled",
  "submitted",
  "pending_submission",
  "not started",
  "not_yet",
]);

export function tone(state: string): string {
  if (SUCCESS.has(state)) return s.chipSuccess;
  if (DANGER.has(state)) return s.chipDanger;
  if (WARNING.has(state)) return s.chipWarning;
  return "";
}

export function Chip({ state, label }: { state: string; label?: string }) {
  return (
    <span className={`${s.chip} ${tone(state)}`}>
      {label ?? state.replace(/_/g, " ")}
    </span>
  );
}

export const InvoiceStateChip = ({ state }: { state: InvoiceState }) => (
  <Chip
    state={state}
    label={state === "part_paid" ? "Part paid" : state[0].toUpperCase() + state.slice(1)}
  />
);
export const CollectionStateChip = ({ state }: { state: CollectionState }) => (
  <Chip state={state} label={COLLECTION_STATE_LABEL[state]} />
);
export const PayoutStateChip = ({ state }: { state: PayoutState }) => (
  <Chip state={state} label={PAYOUT_STATE_LABEL[state]} />
);
export const BankMatchChip = ({ state }: { state: BankMatchState }) => (
  <Chip state={state} label={BANK_MATCH_LABEL[state]} />
);
export const MandateChip = ({ state }: { state: MandateState }) => (
  <Chip state={state} label={MANDATE_LABEL[state]} />
);
export const ExceptionStateChip = ({ state }: { state: ExceptionState }) => (
  <Chip state={state} label={EXCEPTION_STATE_LABEL[state]} />
);

/* ── Money ─────────────────────────────────────────────── */

export function Amount({ value, signed }: { value: Money; signed?: boolean }) {
  return (
    <span className={s.num} title={`${value.currency} ${value.amountMinor} minor units`}>
      {formatMoney(value, { signed })}
    </span>
  );
}

/* ── Structure ─────────────────────────────────────────── */

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={f.empty} role="status">
      <strong>{title}</strong>
      {body}
    </div>
  );
}

export function KV({ rows }: { rows: { k: string; v: React.ReactNode }[] }) {
  return (
    <dl className={s.kv}>
      {rows.map((r) => (
        <div key={r.k} style={{ display: "contents" }}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Where the numbers on this page come from. With commercialV2 off (the default)
 * every Finance page reads the fixture module; with it on, live reads are still
 * not part of this slice, and the note says so rather than pretending.
 */
export function SourceNote() {
  const live = flagOn("commercialV2");
  return (
    <p className={f.sourceNote}>
      Source:{" "}
      {live
        ? "commercialV2 flag is on — live reads are not implemented in this slice; fixtures shown."
        : "fixtures (commercialV2 off)."}{" "}
      {FRESHNESS}. Amounts are integer minor units with an explicit currency; nothing here
      is an approved price.
    </p>
  );
}

export function ClientLink({
  id,
  name,
  legacy,
}: {
  id: string;
  name: string;
  legacy?: boolean;
}) {
  return (
    <>
      <Link href={`/admin/next/clients/${id}`} className={s.rowLink}>
        {name}
      </Link>
      {legacy ? (
        <>
          {" "}
          <span className={`${s.chip} ${s.chipWarning}`}>Legacy · read-only</span>
        </>
      ) : null}
    </>
  );
}

/**
 * Safe retry. The button is inert in this slice: there is no operation queue to
 * enqueue into and the prototype never mutates. It always states exactly what a
 * retry will do and will never do (brief §5.6). integrationWorkers gates the
 * future live path; with it off the button explains why it is disabled.
 */
export function RetryBlock({
  retry,
  exceptionId,
}: {
  retry: SafeRetry;
  exceptionId: string;
}) {
  const workers = flagOn("integrationWorkers");
  const reason =
    retry.availability === "not_applicable"
      ? "No retry applies to this exception."
      : retry.availability === "needs_approval"
        ? "Needs a second person's approval before it can run."
        : workers
          ? "integrationWorkers is on, but this prototype has no operation queue — retry is inert."
          : "integrationWorkers flag is off — retry is inert in this prototype.";
  return (
    <div className={f.retry} aria-labelledby={`retry-${exceptionId}`}>
      <span id={`retry-${exceptionId}`} className={s.mono}>
        Safe retry
      </span>
      <p className={f.retryDoes} style={{ margin: 0 }}>
        {retry.does}
      </p>
      <p className={f.retryNever} style={{ margin: 0 }}>
        {retry.never}
      </p>
      <div className={s.chips}>
        <button className={s.btn} type="button" disabled title={reason}>
          Retry
        </button>
        {retry.requiresSecondPerson ? (
          <span className={`${s.chip} ${s.chipWarning}`}>Second person required</span>
        ) : null}
        <span className={s.faint} style={{ fontSize: 12 }}>
          {reason}
        </span>
      </div>
    </div>
  );
}
