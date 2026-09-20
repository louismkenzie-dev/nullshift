/**
 * Server-safe presentational helpers shared by the Finance pages. No state, no
 * effects, no data access — every value is passed in from a page that read it
 * through lib/ops/financeData.ts.
 */
import Link from "next/link";
import {
  COLLECTION_STATUS_LABEL,
  EXCEPTION_STATE_LABEL,
  formatMoney,
  fmtStamp,
  type CollectionStatus,
  type ExceptionState,
  type InvoiceState,
  type Money,
} from "@/lib/ops/financeData";
import s from "../shell.module.css";
import f from "./finance.module.css";

/* ── Tone mapping ──────────────────────────────────────── */

const SUCCESS = new Set(["paid", "resolved", "active", "mandate_active", "matched"]);
const DANGER = new Set([
  "overdue",
  "past_due",
  "collection_failed",
  "canceled",
  "cancelled",
  "uncollectible",
  "open",
  "urgent",
]);
const WARNING = new Set(["incomplete", "link_sent", "trialing", "in_progress", "void", "legacy"]);

export function tone(state: string): string {
  if (SUCCESS.has(state)) return s.chipSuccess;
  if (DANGER.has(state)) return s.chipDanger;
  if (WARNING.has(state)) return s.chipWarning;
  return "";
}

export function Chip({ state, label }: { state: string; label?: string }) {
  return (
    <span className={`${s.chip} ${tone(state)}`}>{label ?? state.replace(/_/g, " ")}</span>
  );
}

export const InvoiceStateChip = ({ state }: { state: InvoiceState }) => (
  <Chip state={state} label={state[0].toUpperCase() + state.slice(1)} />
);
export const CollectionStateChip = ({ state }: { state: CollectionStatus }) => (
  <Chip state={state} label={COLLECTION_STATUS_LABEL[state]} />
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

export function Empty({ title, body }: { title: string; body: React.ReactNode }) {
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

/** Where the numbers on this page come from and when they were read. */
export function SourceNote({ asAt, extra }: { asAt?: string; extra?: string }) {
  return (
    <p className={f.sourceNote}>
      Source: production database (service-role read, no writes) · read{" "}
      {fmtStamp(asAt ?? new Date().toISOString())}. Amounts are integer minor units with an
      explicit currency.{extra ? ` ${extra}` : ""}
    </p>
  );
}

export function ClientLink({ id, name, legacy }: { id: string; name: string; legacy?: boolean }) {
  return (
    <>
      <Link href={`/admin/clients/${id}`} className={s.rowLink}>
        {name}
      </Link>
      {legacy ? (
        <>
          {" "}
          <span className={`${s.chip} ${s.chipWarning}`}>Legacy plan</span>
        </>
      ) : null}
    </>
  );
}

/** External provider id rendered as a link when we know the dashboard URL. */
export function ProviderId({ id, href, missing = "—" }: { id: string | null; href?: string; missing?: string }) {
  if (!id) return <span className={s.faint}>{missing}</span>;
  if (!href) return <span className={s.mono}>{id}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={`${s.rowLink} ${s.mono}`}>
      {id}
    </a>
  );
}
