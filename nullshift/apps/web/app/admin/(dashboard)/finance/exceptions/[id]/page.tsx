import Link from "next/link";
import { notFound } from "next/navigation";
import { EXCEPTION_KIND_LABEL, fmtDate, fmtStamp, loadException } from "@/lib/ops/financeData";
import { Amount, ClientLink, ExceptionStateChip, KV, SourceNote } from "../../ui";
import s from "../../../shell.module.css";
import f from "../../finance.module.css";

/**
 * Finance › Exceptions › detail: what happened, who owns it, the attempt
 * history and resolution evidence when recorded, and the legacy page that can
 * act. Nothing here retries or collects; a retry is an explicit action on the
 * provider surface.
 */
export default async function ExceptionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = await loadException(id);
  if (!ex) notFound();
  const attempts = [...ex.attempts].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/finance/exceptions">Exceptions</Link> / {ex.id}
      </p>
      <div className={s.pageHead}>
        <div>
          <h2 className={s.h1} style={{ fontSize: 22 }}>
            {ex.title}
          </h2>
          <p className={s.lead}>
            {EXCEPTION_KIND_LABEL[ex.kind]} ·{" "}
            {ex.tenantId ? <ClientLink id={ex.tenantId} name={ex.tenantName} /> : ex.tenantName} · owner{" "}
            {ex.owner}
          </p>
        </div>
        <div className={s.chips}>
          <ExceptionStateChip state={ex.state} />
          {ex.severity === "urgent" ? <span className={`${s.chip} ${s.chipDanger}`}>urgent</span> : null}
          {ex.amount ? (
            <span className={s.chip}>
              <Amount value={ex.amount} />
            </span>
          ) : null}
          <Link href={ex.action.href} className={s.btnPrimary}>
            {ex.action.label}
          </Link>
        </div>
      </div>
      <SourceNote
        extra={
          ex.source === "derived"
            ? "This exception is derived from live rows on every read; it clears itself when the underlying row changes."
            : "This exception is a finance_exceptions row."
        }
      />

      <div className={f.detail}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="ex-summary">
            <h3 id="ex-summary" className={s.h2}>
              What happened
            </h3>
            <p style={{ margin: 0 }}>{ex.detail}</p>
          </section>

          <section className={s.card} aria-labelledby="ex-attempts">
            <h3 id="ex-attempts" className={s.h2}>
              Attempt history ({attempts.length})
            </h3>
            {attempts.length === 0 ? (
              <p className={s.muted}>
                {ex.source === "derived"
                  ? "Derived exceptions carry no attempt history; provider attempts are visible on the provider dashboard."
                  : "No attempts recorded."}
              </p>
            ) : (
              <ol className={f.timeline}>
                {attempts.map((a, n) => (
                  <li key={n}>
                    <span className={f.timelineAt}>{fmtStamp(a.at)}</span>
                    <span className={f.timelineActor}>{a.by}</span>
                    <span>
                      {a.action}
                      <span className={f.sub}>Outcome: {a.outcome}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className={f.retry} aria-labelledby={`retry-${ex.id}`}>
            <span id={`retry-${ex.id}`} className={s.mono}>
              Safe retry
            </span>
            {ex.safeRetry ? (
              <>
                <p className={f.retryDoes} style={{ margin: 0 }}>
                  {ex.safeRetry.op.replace(/_/g, " ")}: {ex.safeRetry.summary}
                </p>
                <p className={f.retryNever} style={{ margin: 0 }}>
                  Never collects money. The operation queue (integrationWorkers) is not enabled,
                  so this retry is recorded only, not run.
                </p>
              </>
            ) : (
              <p className={f.retryNever} style={{ margin: 0 }}>
                No automatic retry applies. Act on the linked page; any collection retry is a
                new attempt made at the provider.
              </p>
            )}
          </div>

          <section className={s.card} aria-labelledby="ex-resolution">
            <h3 id="ex-resolution" className={s.h2}>
              Resolution evidence
            </h3>
            {ex.state === "resolved" && ex.resolutionEvidence.length > 0 ? (
              <>
                <ul className={f.evidence}>
                  {ex.resolutionEvidence.map((e, n) => (
                    <li key={n}>{typeof e === "string" ? e : JSON.stringify(e)}</li>
                  ))}
                </ul>
                <p className={s.muted} style={{ fontSize: 12, marginBottom: 0 }}>
                  Resolved {fmtDate(ex.resolvedAt)}.
                </p>
              </>
            ) : (
              <p className={s.muted} style={{ margin: 0 }}>
                {ex.source === "derived"
                  ? "A derived exception resolves itself once the row it is computed from changes (the mandate is authorised, the invoice is paid or gets its Xero id)."
                  : "Not resolved. Closing this exception requires evidence recorded on the row."}
              </p>
            )}
          </section>
        </div>

        <aside className={f.side}>
          <section className={s.card} aria-labelledby="ex-links">
            <h3 id="ex-links" className={s.h2}>
              Linked records
            </h3>
            <KV
              rows={[
                { k: "Opened", v: fmtDate(ex.openedAt) },
                { k: "Source", v: ex.source },
                {
                  k: "Invoice",
                  v: ex.links.invoiceId ? (
                    <Link href={`/admin/finance/invoices/${ex.links.invoiceId}`} className={s.mono}>
                      {ex.links.invoiceId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className={s.faint}>—</span>
                  ),
                },
                {
                  k: "Subscription",
                  v: ex.links.subscriptionId ? (
                    <Link href={`/admin/finance/collections/${ex.links.subscriptionId}`} className={s.mono}>
                      {ex.links.subscriptionId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className={s.faint}>—</span>
                  ),
                },
                {
                  k: "Obligation",
                  v: ex.links.obligationId ? <span className={s.mono}>{ex.links.obligationId}</span> : <span className={s.faint}>—</span>,
                },
                {
                  k: "External ref",
                  v: ex.links.externalRef ? <span className={s.mono}>{ex.links.externalRef}</span> : <span className={s.faint}>—</span>,
                },
                {
                  k: "Client",
                  v: ex.tenantId ? <Link href={`/admin/clients/${ex.tenantId}`}>{ex.tenantName}</Link> : <span className={s.faint}>—</span>,
                },
              ]}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
