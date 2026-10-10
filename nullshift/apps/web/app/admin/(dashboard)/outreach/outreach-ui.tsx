/**
 * Server-safe UI pieces shared by the Outreach pages. No client code.
 */
import s from "../shell.module.css";
import {
  AGENCY_TYPES,
  AGENCY_TYPE_LABEL,
  APPLICATION_STATUS_LABEL,
  STATUS_LABEL,
  type ApplicationStatus,
  type ProspectStatus,
} from "@/lib/ops/outreachData";

export const STATUS_TONE: Record<ProspectStatus, string> = {
  sourced: "",
  verified: s.chipInfo,
  queued: s.chipInfo,
  contacted: s.chipWarning,
  replied: s.chipSuccess,
  call_booked: s.chipSuccess,
  agreed: s.chipSuccess,
  declined: s.chipDanger,
  parked: s.chipWarning,
  unsubscribed: s.chipDanger,
};

export function StatusChip({ status }: { status: ProspectStatus }) {
  return (
    <span className={`${s.chip} ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
  );
}

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, string> = {
  new: s.chipInfo,
  reviewing: s.chipWarning,
  accepted: s.chipSuccess,
  declined: s.chipDanger,
  archived: "",
};

export function ApplicationStatusChip({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`${s.chip} ${APPLICATION_STATUS_TONE[status]}`}>
      {APPLICATION_STATUS_LABEL[status]}
    </span>
  );
}

export function AgencyTypeOptions({ selected }: { selected?: string | null }) {
  return (
    <>
      <option value="">— not set —</option>
      {AGENCY_TYPES.map((t) => (
        <option key={t} value={t} selected={selected === t}>
          {AGENCY_TYPE_LABEL[t]}
        </option>
      ))}
    </>
  );
}

const ERROR_TEXT: Record<string, string> = {
  unauthenticated: "Sign in again to continue.",
  forbidden: "Staff only.",
  preview: "Client preview sessions cannot change outreach records.",
  not_found: "That prospect no longer exists.",
  invalid: "Check the form: ",
  db_error: "The database refused the change: ",
};

export function noticeFor(
  raw: string | undefined
): { tone: "info" | "danger"; text: string } | null {
  if (!raw) return null;
  if (raw.startsWith("ok:")) return { tone: "info", text: raw.slice(3) };
  if (raw.startsWith("err:")) {
    const [reason, ...rest] = raw.slice(4).split(":");
    const detail = rest.join(":");
    const base = ERROR_TEXT[reason] ?? `Could not complete (${reason}). `;
    const text = base.endsWith(": ") ? base + (detail || "invalid input") : base;
    return { tone: "danger", text };
  }
  return { tone: "info", text: raw };
}

/** Pretty label for a form `<select name="status">`. */
export const statusLabel = (st: ProspectStatus) => STATUS_LABEL[st];

/** yyyy-mm-dd for a date input default. */
export const dateInputValue = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "";
