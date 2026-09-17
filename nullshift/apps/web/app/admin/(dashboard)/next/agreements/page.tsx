import Link from "next/link";
import { flagOn } from "@/lib/flags";
import { CLIENTS } from "@/lib/next/fixtures";
import {
  AGREEMENTS,
  AGREEMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_KEY,
  FIXTURE_TODAY,
  REVIEW_REQUIREMENTS,
  REVIEW_REQUIREMENT_LABEL,
  STATUS_KEY,
  expiryState,
  filterAgreements,
  issueBlockers,
  parseFilters,
  sortAgreements,
  type AgreementFilters,
} from "@/lib/next/fixtures-agreements";
import s from "../next.module.css";
import a from "./agreements.module.css";
import { statusTone } from "./statusTone";

type FilterKey = keyof AgreementFilters;

function hrefWith(current: AgreementFilters, key: FilterKey, value: string | undefined) {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) if (v) next[k] = v;
  if (value === undefined || current[key] === value) delete next[key];
  else next[key] = value;
  const qs = new URLSearchParams(next).toString();
  return qs ? `/admin/next/agreements?${qs}` : "/admin/next/agreements";
}

function FilterGroup({
  label,
  filterKey,
  options,
  current,
}: {
  label: string;
  filterKey: FilterKey;
  options: { value: string; label: string; count: number }[];
  current: AgreementFilters;
}) {
  return (
    <div className={a.filterRow} role="group" aria-label={label}>
      <span className={`${s.mono} ${a.filterLabel}`}>{label}</span>
      {options.map((o) => {
        const on = current[filterKey] === o.value;
        return (
          <Link
            key={o.value}
            href={hrefWith(current, filterKey, o.value)}
            className={`${a.filterChip} ${on ? a.filterChipOn : ""}`}
            aria-pressed={on}
          >
            {o.label} · {o.count}
          </Link>
        );
      })}
    </div>
  );
}

export default async function AgreementsLibrary({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const filters = parseFilters(await searchParams);
  const today = FIXTURE_TODAY;
  const rows = sortAgreements(filterAgreements(AGREEMENTS, filters, today));
  const active = Object.values(filters).filter(Boolean).length;

  // Counts for each chip are computed against the other active filters so a
  // chip always says how many rows it would leave.
  const countFor = (key: FilterKey, value: string) =>
    filterAgreements(AGREEMENTS, { ...filters, [key]: value }, today).length;

  const clientOptions = CLIENTS.filter((c) =>
    AGREEMENTS.some((d) => d.clientId === c.id)
  ).map((c) => ({
    value: c.id,
    label: c.tradingName ?? c.legalName,
    count: countFor("client", c.id),
  }));
  const typeOptions = DOCUMENT_TYPES.map((t) => ({
    value: DOCUMENT_TYPE_KEY[t],
    label: t,
    count: countFor("type", DOCUMENT_TYPE_KEY[t]),
  }));
  const versionOptions = [...new Set(AGREEMENTS.map((d) => d.version))]
    .sort()
    .map((v) => ({ value: v, label: v, count: countFor("version", v) }));
  const statusOptions = AGREEMENT_STATUSES.map((st) => ({
    value: STATUS_KEY[st],
    label: st,
    count: countFor("status", STATUS_KEY[st]),
  }));
  const expiryOptions = [
    {
      value: "expiring",
      label: "Expires within 30 days",
      count: countFor("expiry", "expiring"),
    },
    { value: "expired", label: "Expired", count: countFor("expiry", "expired") },
    { value: "none", label: "No expiry", count: countFor("expiry", "none") },
  ];
  const reviewOptions = REVIEW_REQUIREMENTS.map((r) => ({
    value: r,
    label: REVIEW_REQUIREMENT_LABEL[r],
    count: countFor("review", r),
  }));

  // Flag gate: with commercialV2 on, a later slice reads agreements from the
  // database. This slice never does; the label only reports the source.
  const source = flagOn("commercialV2")
    ? "commercialV2 on · database source not wired in this slice · fixtures shown"
    : "fixtures";

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            Agreements · {AGREEMENTS.length} fictional documents · source: {source}
          </p>
          <h1 className={s.h1}>Agreements</h1>
          <p className={s.lead}>
            A structured, linked document set per client (brief §9). Status is recorded
            explicitly: a sent email is not acceptance and a view is evidence, not a
            signature.
          </p>
        </div>
        <div className={s.chips}>
          <button className={s.btn} type="button" disabled title="Not in this slice">
            New document
          </button>
        </div>
      </div>

      <div className={a.filters} aria-label="Filters">
        <FilterGroup
          label="Client"
          filterKey="client"
          options={clientOptions}
          current={filters}
        />
        <FilterGroup
          label="Document type"
          filterKey="type"
          options={typeOptions}
          current={filters}
        />
        <FilterGroup
          label="Version"
          filterKey="version"
          options={versionOptions}
          current={filters}
        />
        <FilterGroup
          label="Status"
          filterKey="status"
          options={statusOptions}
          current={filters}
        />
        <FilterGroup
          label="Expiry"
          filterKey="expiry"
          options={expiryOptions}
          current={filters}
        />
        <FilterGroup
          label="Review requirement"
          filterKey="review"
          options={reviewOptions}
          current={filters}
        />
        <div className={a.filterFoot}>
          <span className={s.mono}>
            {rows.length} of {AGREEMENTS.length} shown · {active} filter
            {active === 1 ? "" : "s"} active · expiry relative to {today} (fixture date)
          </span>
          {active > 0 ? (
            <Link href="/admin/next/agreements" className={s.mono}>
              Clear filters
            </Link>
          ) : null}
        </div>
      </div>

      <div className={s.card} style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className={a.empty}>
            <strong>No agreements match these filters</strong>
            Nothing is hidden by permission; the combination simply has no documents.{" "}
            <Link href="/admin/next/agreements" className={s.rowLink}>
              Clear filters
            </Link>
          </div>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Document</th>
                <th>Client</th>
                <th>Status</th>
                <th>Template</th>
                <th>Review</th>
                <th>Expiry</th>
                <th>Before issue</th>
                <th>Last event</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const blockers = issueBlockers(d);
                const exp = expiryState(d, today);
                const last = d.audit[d.audit.length - 1];
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/admin/next/agreements/${d.id}`} className={s.rowLink}>
                        {d.type} · {d.version}
                      </Link>
                      <div className={s.mono}>
                        {d.project}
                        {d.legacy ? " · legacy · read-only" : ""}
                        {d.supersedes ? ` · supersedes ${d.supersedes}` : ""}
                        {d.supersededBy ? ` · superseded by ${d.supersededBy}` : ""}
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/admin/next/clients/${d.clientId}`}
                        className={s.rowLink}
                      >
                        {d.client}
                      </Link>
                    </td>
                    <td>
                      <span className={`${s.chip} ${statusTone(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className={s.muted}>{d.templateVersion}</td>
                    <td className={s.muted}>
                      {REVIEW_REQUIREMENT_LABEL[d.reviewRequirement]}
                    </td>
                    <td className={s.muted}>
                      {exp.state === "none"
                        ? "—"
                        : exp.state === "expired"
                          ? `Expired ${d.expiresOn}`
                          : `${d.expiresOn} (${exp.days} days)`}
                    </td>
                    <td>
                      {d.legacy ? (
                        <span className={s.faint}>n/a</span>
                      ) : blockers.length === 0 ? (
                        <span className={`${s.chip} ${s.chipSuccess}`}>clear</span>
                      ) : (
                        <span
                          className={`${s.chip} ${d.status === "Accepted" ? s.chipWarning : s.chipDanger}`}
                        >
                          {blockers.length}{" "}
                          {d.status === "Accepted" ? "open" : "blocking"}
                        </span>
                      )}
                    </td>
                    <td className={s.muted}>
                      {last ? (
                        <>
                          {last.event}
                          <div className={s.mono}>
                            {last.at} · {last.kind}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
