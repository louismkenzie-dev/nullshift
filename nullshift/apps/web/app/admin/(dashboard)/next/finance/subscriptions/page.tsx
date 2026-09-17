import Link from "next/link";
import {
  SUBSCRIPTIONS,
  SUBSCRIPTIONS_WITHOUT_ROW,
  clientRef,
  fmtDate,
} from "@/lib/next/fixtures-finance";
import { Amount, Chip, ClientLink, SourceNote } from "../ui";
import s from "../../next.module.css";
import f from "../finance.module.css";

/**
 * Finance › Subscriptions (brief §5.6): one row per billable service, with
 * legacy marker, governing acceptance, agreed rate, start, provider ids, next
 * collection, cancellation/pause state and upcoming review. A catalogue price
 * change never edits these rows.
 */
export default function SubscriptionsPage() {
  return (
    <>
      <SourceNote />
      <p className={s.muted} style={{ marginTop: 0 }}>
        One row per billable service, not per client. Morrow Venues has two systems under
        one legal client with distinct arrangements and one customer identity. The agreed
        rate is the accepted schedule&apos;s figure; the catalogue is never read here.
      </p>

      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col">Client</th>
            <th scope="col">Governing acceptance</th>
            <th scope="col">Package</th>
            <th scope="col" className={s.num}>
              Agreed rate
            </th>
            <th scope="col">Start</th>
            <th scope="col">Provider ids</th>
            <th scope="col">Next collection</th>
            <th scope="col">State</th>
            <th scope="col">Review</th>
          </tr>
        </thead>
        <tbody>
          {SUBSCRIPTIONS.map((row) => {
            const c = clientRef(row.clientId);
            return (
              <tr key={row.id} className={row.legacy ? f.legacy : undefined}>
                <td>
                  <strong>{row.service}</strong>
                  <span className={f.sub}>
                    {row.id} · {row.route}
                    {row.legacy ? " · legacy" : ""}
                    {row.readOnly ? " · read-only" : ""}
                  </span>
                </td>
                <td>
                  <ClientLink id={c.id} name={c.legalName} legacy={row.legacy} />
                </td>
                <td>
                  {row.governingAcceptance}
                  {row.note ? <span className={f.sub}>{row.note}</span> : null}
                </td>
                <td>{row.package ?? <span className={s.faint}>—</span>}</td>
                <td className={s.num}>
                  {row.agreedRate ? (
                    <>
                      <Amount value={row.agreedRate} />
                      <span className={f.sub}>per month</span>
                    </>
                  ) : (
                    <span className={s.faint}>none</span>
                  )}
                </td>
                <td>
                  {row.start ? fmtDate(row.start) : <span className={s.faint}>—</span>}
                </td>
                <td>
                  <span className={s.mono}>{row.providerIds.mandate ?? "—"}</span>
                  <span className={f.sub}>
                    <span className={s.mono}>
                      {row.providerIds.subscription ?? "no subscription yet"}
                    </span>
                  </span>
                </td>
                <td>
                  {row.nextCollection === "Authorised — not scheduled" ? (
                    <Chip state="authorised_not_scheduled" label={row.nextCollection} />
                  ) : (
                    row.nextCollection
                  )}
                </td>
                <td>
                  <Chip state={row.pauseState} label={row.pauseState} />
                </td>
                <td>
                  {row.upcomingReview ? (
                    fmtDate(row.upcomingReview)
                  ) : (
                    <span className={s.faint}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className={s.card} style={{ marginTop: 24 }} aria-labelledby="no-row">
        <h3 id="no-row" className={s.h2}>
          Managed elections and other clients with no billable row
        </h3>
        <p className={s.muted} style={{ marginTop: 0 }}>
          A subscription row exists only once a service schedule is accepted with a
          package, rate and start. Until then the election is visible on the client, not
          here.
        </p>
        <ul className={s.list}>
          {SUBSCRIPTIONS_WITHOUT_ROW.map((n) => {
            const c = clientRef(n.clientId);
            return (
              <li key={n.clientId} className={s.listItem}>
                <span>
                  <ClientLink id={c.id} name={c.legalName} />
                  <span className={f.sub}>{n.reason}</span>
                </span>
                {n.exceptionId ? (
                  <Link
                    href={`/admin/next/finance/exceptions/${n.exceptionId}`}
                    className={`${s.chip} ${s.chipDanger}`}
                  >
                    {n.exceptionId}
                  </Link>
                ) : (
                  <span className={`${s.chip}`}>No row</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
