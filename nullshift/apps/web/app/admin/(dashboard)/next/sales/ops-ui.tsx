/**
 * Small server-safe UI pieces shared by the operations areas (Sales, Delivery,
 * Automations, Settings). Colocated here because the task owns these four
 * route directories only; it contains no client code.
 */
import Link from "next/link";
import s from "../next.module.css";
import o from "../ops.module.css";

export function SubTabs({
  base,
  param = "tab",
  current,
  tabs,
  keep,
}: {
  base: string;
  param?: string;
  current: string;
  tabs: { id: string; label: string; count?: number }[];
  keep?: Record<string, string | undefined>;
}) {
  const extra = Object.entries(keep ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `&${k}=${encodeURIComponent(v ?? "")}`)
    .join("");
  return (
    <nav className={s.tabs} aria-label="Sections">
      {tabs.map((t) => {
        const active = t.id === current;
        return (
          <Link
            key={t.id}
            href={`${base}?${param}=${t.id}${extra}`}
            className={`${o.tabLink} ${active ? o.tabLinkActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {t.label}
            {t.count !== undefined ? <span className={s.faint}> · {t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={o.empty} role="status">
      <p className={o.emptyTitle}>{title}</p>
      <p style={{ margin: 0 }}>{body}</p>
    </div>
  );
}

export function Notice({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const cls =
    tone === "warning"
      ? o.noticeWarning
      : tone === "danger"
        ? o.noticeDanger
        : tone === "info"
          ? o.noticeInfo
          : "";
  return <div className={`${o.notice} ${cls}`}>{children}</div>;
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className={o.skeleton} style={{ width: 160, marginBottom: 12 }} />
      <div
        className={o.skeleton}
        style={{ width: 320, minHeight: 28, marginBottom: 24 }}
      />
      <div className={s.stack}>
        {Array.from({ length: Math.min(rows, 8) }, (_, i) => (
          <div key={i} className={o.skeletonBlock} style={{ minHeight: 52 }} />
        ))}
      </div>
    </div>
  );
}

export const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export const stateTone = (state: string): string => {
  const v = state.toLowerCase();
  if (
    [
      "accepted",
      "complete",
      "released",
      "resolved",
      "pass",
      "met",
      "enabled",
      "published",
      "approved",
      "ok",
      "won",
    ].includes(v)
  )
    return s.chipSuccess;
  if (
    [
      "fail",
      "failed",
      "blocked",
      "declined",
      "withdrawn",
      "open",
      "rolled back",
      "disputed",
      "lost",
      "overdue",
    ].includes(v)
  )
    return s.chipDanger;
  if (
    [
      "in progress",
      "awaiting client",
      "awaiting quote",
      "at risk",
      "waived",
      "pending",
      "partial",
      "paused",
      "draft",
      "expired",
      "internal review",
      "approved to issue",
      "issued",
      "staged",
      "triaged",
      "skipped",
    ].includes(v)
  )
    return s.chipWarning;
  if (["sandbox", "dry run", "evidenced", "planned", "new", "proposed"].includes(v))
    return s.chipInfo;
  return "";
};
