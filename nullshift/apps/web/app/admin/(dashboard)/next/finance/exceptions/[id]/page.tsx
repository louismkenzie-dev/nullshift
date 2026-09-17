import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EXCEPTION_KIND_LABEL,
  clientRef,
  collectionById,
  exceptionById,
  fmtDate,
  gbpMinor,
  invoiceById,
  payoutById,
  remainingMinor,
} from "@/lib/next/fixtures-finance";
import {
  Amount,
  ClientLink,
  ExceptionStateChip,
  KV,
  RetryBlock,
  SourceNote,
} from "../../ui";
import s from "../../../next.module.css";
import f from "../../finance.module.css";

/**
 * Finance › Exceptions › detail (brief §5.6): owner, attempt history, safe retry
 * that states exactly what it will do, and resolution evidence.
 */
export default async function ExceptionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ex = exceptionById(id);
  if (!ex) notFound();

  const c = clientRef(ex.clientId);
  const inv = ex.links.invoiceId ? invoiceById(ex.links.invoiceId) : undefined;
  const col = ex.links.collectionId ? collectionById(ex.links.collectionId) : undefined;
  const po = ex.links.payoutId ? payoutById(ex.links.payoutId) : undefined;
  const attempts = [...ex.attempts].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/next/finance/exceptions">Exceptions</Link> / {ex.id}
      </p>
      <div className={s.pageHead}>
        <div>
          <h2 className={s.h1} style={{ fontSize: 22 }}>
            {ex.title}
          </h2>
          <p className={s.lead}>
            {ex.id} · {EXCEPTION_KIND_LABEL[ex.kind]} ·{" "}
            <ClientLink id={c.id} name={c.legalName} legacy={c.model === "legacy"} /> ·
            owner {ex.owner}
          </p>
        </div>
        <div className={s.chips}>
          <ExceptionStateChip state={ex.state} />
          {ex.amount ? (
            <span className={s.chip}>
              <Amount value={ex.amount} />
            </span>
          ) : null}
        </div>
      </div>
      <SourceNote />

      <div className={f.detail}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="ex-summary">
            <h3 id="ex-summary" className={s.h2}>
              What happened
            </h3>
            <p style={{ margin: 0 }}>{ex.summary}</p>
          </section>

          <section className={s.card} aria-labelledby="ex-attempts">
            <h3 id="ex-attempts" className={s.h2}>
              Attempt history ({ex.attempts.length})
            </h3>
            {attempts.length === 0 ? (
              <p className={s.muted}>No attempts recorded.</p>
            ) : (
              <ol className={f.timeline}>
                {attempts.map((a, n) => (
                  <li key={n}>
                    <span className={f.timelineAt}>
                      {a.at.replace("T", " ").slice(0, 16)} UTC
                    </span>
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

          <RetryBlock retry={ex.retry} exceptionId={ex.id} />

          <section className={s.card} aria-labelledby="ex-resolution">
            <h3 id="ex-resolution" className={s.h2}>
              Resolution evidence
            </h3>
            {ex.resolution ? (
              <>
                <ul className={f.evidence}>
                  {ex.resolution.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <p className={s.muted} style={{ fontSize: 12, marginBottom: 0 }}>
                  Resolved {fmtDate(ex.resolvedAt)} by {ex.resolution.by}.
                </p>
              </>
            ) : (
              <p className={s.muted} style={{ margin: 0 }}>
                Not resolved. Closing this exception requires evidence recorded here; it
                cannot be closed by dismissing it.
              </p>
            )}
          </section>
        </div>

        <aside className={f.side}>
          <section className={s.card} aria-labelledby="ex-next">
            <h3 id="ex-next" className={s.h2}>
              Next step
            </h3>
            <p style={{ margin: 0 }}>{ex.nextStep}</p>
          </section>

          <section className={s.card} aria-labelledby="ex-links">
            <h3 id="ex-links" className={s.h2}>
              Linked records
            </h3>
            <KV
              rows={[
                { k: "Opened", v: fmtDate(ex.openedAt) },
                {
                  k: "Invoice",
                  v: inv ? (
                    <>
                      <Link href={`/admin/next/finance/invoices/${inv.id}`}>
                        {inv.id}
                      </Link>
                      <span className={f.sub}>
                        remaining <Amount value={gbpMinor(remainingMinor(inv))} />
                      </span>
                    </>
                  ) : (
                    <span className={s.faint}>—</span>
                  ),
                },
                {
                  k: "Collection",
                  v: col ? (
                    <Link href={`/admin/next/finance/collections/${col.id}`}>
                      {col.id}
                    </Link>
                  ) : (
                    <span className={s.faint}>—</span>
                  ),
                },
                {
                  k: "Payout / receipt",
                  v: po ? (
                    <Link href="/admin/next/finance/reconciliation">{po.id}</Link>
                  ) : (
                    <span className={s.faint}>—</span>
                  ),
                },
                {
                  k: "Subscription",
                  v: ex.links.subscriptionId ? (
                    <Link href="/admin/next/finance/subscriptions">
                      {ex.links.subscriptionId}
                    </Link>
                  ) : (
                    <span className={s.faint}>—</span>
                  ),
                },
                {
                  k: "Client",
                  v: <Link href={`/admin/next/clients/${c.id}`}>{c.ref}</Link>,
                },
              ]}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
