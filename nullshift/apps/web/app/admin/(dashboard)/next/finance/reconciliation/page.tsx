import Link from "next/link";
import {
  PAYOUTS,
  allocatedMinor,
  clientRef,
  fmtDate,
  gbpMinor,
  invoiceById,
  netPayoutMinor,
  payoutBalances,
  payoutOverAllocated,
  remainingMinor,
  sumMinor,
  type Payout,
} from "@/lib/next/fixtures-finance";
import { Amount, Chip, ClientLink, SourceNote } from "../ui";
import s from "../../next.module.css";
import f from "../finance.module.css";

const SOURCE_LABEL: Record<Payout["source"], string> = {
  gocardless_payout: "Provider payout",
  bank_receipt: "Bank receipt",
};

function Equation({ p }: { p: Payout }) {
  const refunds = sumMinor(p.refunds.map((l) => l.amountMinor));
  const fees = sumMinor(p.fees.map((l) => l.amountMinor));
  const adjustments = sumMinor(p.adjustments.map((l) => l.amountMinor));
  const net = netPayoutMinor(p);
  const balances = payoutBalances(p);
  return (
    <div className={f.equation}>
      <span className={f.equationLabel}>Gross collections</span>
      <Amount value={gbpMinor(p.grossMinor)} />
      <span className={f.equationLabel}>
        − refunds
        {p.refunds.length ? ` (${p.refunds.map((l) => l.label).join(", ")})` : ""}
      </span>
      <Amount value={gbpMinor(refunds)} />
      <span className={f.equationLabel}>
        − fees{p.fees.length ? ` (${p.fees.map((l) => l.label).join(", ")})` : ""}
      </span>
      <Amount value={gbpMinor(fees)} />
      <span className={f.equationLabel}>
        ± adjustments
        {p.adjustments.length ? ` (${p.adjustments.map((l) => l.label).join(", ")})` : ""}
      </span>
      <Amount value={gbpMinor(adjustments)} signed />
      <span className={`${f.equationLabel} ${f.equationTotal}`}>
        = net payout (computed)
      </span>
      <span className={f.equationTotal}>
        <Amount value={gbpMinor(net)} />
      </span>
      <span className={f.equationLabel}>
        Stated by {SOURCE_LABEL[p.source].toLowerCase()}
      </span>
      <span>
        <Amount value={gbpMinor(p.statedNetMinor)} />{" "}
        <Chip
          state={balances ? "matched" : "unmatched"}
          label={balances ? "Balances" : "Does not balance"}
        />
      </span>
    </div>
  );
}

/**
 * Finance › Reconciliation (brief §5.6): gross − refunds − fees ± adjustments =
 * net payout, linked to bank evidence. Partial payments, split transfers and
 * several invoices in one transfer are all represented; ambiguous matches need
 * a human.
 */
export default function ReconciliationPage() {
  const needsReview = PAYOUTS.filter((p) => p.matchState !== "matched");
  const matched = PAYOUTS.filter((p) => p.matchState === "matched").sort((a, b) =>
    a.receivedAt < b.receivedAt ? 1 : -1
  );

  return (
    <>
      <SourceNote />

      <section aria-labelledby="needs-review" className={s.stack}>
        <h3 id="needs-review" className={s.h2} style={{ marginBottom: 0 }}>
          Needs human review ({needsReview.length})
        </h3>
        {needsReview.length === 0 ? (
          <p className={s.muted}>
            Every payout and receipt is matched to bank evidence and allocated.
          </p>
        ) : (
          needsReview.map((p) => (
            <article key={p.id} className={s.card} aria-labelledby={`po-${p.id}`}>
              <div className={s.cardTitle}>
                <h4 id={`po-${p.id}`} className={s.h2} style={{ marginBottom: 0 }}>
                  {p.id} · {SOURCE_LABEL[p.source]} ·{" "}
                  <Amount value={gbpMinor(p.statedNetMinor)} />
                </h4>
                <Chip state="needs_review" label="Needs human review" />
              </div>
              <div className={f.detail}>
                <div>
                  <Equation p={p} />
                  <div className={f.review}>
                    <strong>
                      Suggested match —{" "}
                      {p.suggestedMatch?.confidence === "ambiguous"
                        ? "ambiguous"
                        : "high confidence"}
                      .
                    </strong>{" "}
                    {p.suggestedMatch ? (
                      <>
                        Allocate <Amount value={gbpMinor(p.suggestedMatch.amountMinor)} />{" "}
                        to{" "}
                        <Link
                          href={`/admin/next/finance/invoices/${p.suggestedMatch.invoiceId}`}
                          className={s.rowLink}
                        >
                          {p.suggestedMatch.invoiceId}
                        </Link>
                        {(() => {
                          const inv = invoiceById(p.suggestedMatch.invoiceId);
                          return inv ? (
                            <>
                              {" "}
                              (remaining <Amount value={gbpMinor(remainingMinor(inv))} />)
                            </>
                          ) : null;
                        })()}
                        .
                        <p className={s.mono} style={{ margin: "10px 0 4px" }}>
                          Evidence
                        </p>
                        <ul className={f.evidence}>
                          {p.suggestedMatch.evidence.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                        {p.suggestedMatch.ambiguity ? (
                          <p style={{ margin: "10px 0 0" }} className={s.muted}>
                            {p.suggestedMatch.ambiguity}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      "No suggestion."
                    )}
                    <div className={s.chips} style={{ marginTop: 12 }}>
                      <button
                        className={s.btn}
                        type="button"
                        disabled
                        title="Second-person allocation is not available in this prototype; nothing is written"
                      >
                        Accept match (second person)
                      </button>
                      <button
                        className={s.btn}
                        type="button"
                        disabled
                        title="Not in this slice"
                      >
                        Hold
                      </button>
                      <button
                        className={s.btn}
                        type="button"
                        disabled
                        title="A refund is a typed operation — not in this slice"
                      >
                        Propose refund
                      </button>
                    </div>
                  </div>
                </div>
                <aside className={f.side}>
                  <div>
                    <p className={s.mono}>Bank evidence</p>
                    {p.bankEvidence ? (
                      <dl className={s.kv}>
                        <dt>Statement line</dt>
                        <dd>{p.bankEvidence.statementLine}</dd>
                        <dt>Reference</dt>
                        <dd>{p.bankEvidence.reference}</dd>
                        <dt>Date</dt>
                        <dd>{fmtDate(p.bankEvidence.at)}</dd>
                        <dt>Payer</dt>
                        <dd>
                          {p.clientId ? clientRef(p.clientId).legalName : "Unidentified"}
                        </dd>
                      </dl>
                    ) : (
                      <p className={s.muted}>No bank line yet.</p>
                    )}
                  </div>
                  <div>
                    <p className={s.mono}>Exceptions</p>
                    {p.exceptionIds.map((id) => (
                      <Link
                        key={id}
                        href={`/admin/next/finance/exceptions/${id}`}
                        className={s.rowLink}
                      >
                        {id}
                      </Link>
                    ))}
                  </div>
                  <div>
                    <p className={s.mono}>Owner</p>
                    <span className={s.muted}>{p.owner}</span>
                  </div>
                </aside>
              </div>
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="matched" style={{ marginTop: 32 }}>
        <h3 id="matched" className={s.h2}>
          Matched ({matched.length})
        </h3>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">Payout / receipt</th>
              <th scope="col">Client</th>
              <th scope="col">Received</th>
              <th scope="col" className={s.num}>
                Gross
              </th>
              <th scope="col" className={s.num}>
                − Refunds
              </th>
              <th scope="col" className={s.num}>
                − Fees
              </th>
              <th scope="col" className={s.num}>
                ± Adj.
              </th>
              <th scope="col" className={s.num}>
                = Net
              </th>
              <th scope="col">Bank evidence</th>
              <th scope="col">Allocated to</th>
            </tr>
          </thead>
          <tbody>
            {matched.map((p) => {
              const c = p.clientId ? clientRef(p.clientId) : undefined;
              const balances = payoutBalances(p);
              const over = payoutOverAllocated(p);
              return (
                <tr key={p.id}>
                  <td>
                    <span className={s.rowLink}>{p.id}</span>
                    <span className={f.sub}>{SOURCE_LABEL[p.source]}</span>
                  </td>
                  <td>
                    {c ? (
                      <ClientLink
                        id={c.id}
                        name={c.legalName}
                        legacy={c.model === "legacy"}
                      />
                    ) : (
                      <span className={s.faint}>—</span>
                    )}
                  </td>
                  <td>{fmtDate(p.receivedAt)}</td>
                  <td className={s.num}>
                    <Amount value={gbpMinor(p.grossMinor)} />
                  </td>
                  <td className={s.num}>
                    <Amount
                      value={gbpMinor(sumMinor(p.refunds.map((l) => l.amountMinor)))}
                    />
                  </td>
                  <td className={s.num}>
                    <Amount
                      value={gbpMinor(sumMinor(p.fees.map((l) => l.amountMinor)))}
                    />
                  </td>
                  <td className={s.num}>
                    <Amount
                      value={gbpMinor(sumMinor(p.adjustments.map((l) => l.amountMinor)))}
                      signed
                    />
                  </td>
                  <td className={s.num}>
                    <Amount value={gbpMinor(netPayoutMinor(p))} />
                    {!balances ? (
                      <span className={f.sub}>
                        <Chip state="unmatched" label="Does not balance" />
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {p.bankEvidence ? (
                      <>
                        {p.bankEvidence.statementLine}
                        <span className={f.sub}>{fmtDate(p.bankEvidence.at)}</span>
                      </>
                    ) : (
                      <span className={s.faint}>none</span>
                    )}
                  </td>
                  <td>
                    {p.allocations.map((a) => (
                      <span key={a.invoiceId} style={{ display: "block" }}>
                        <Link href={`/admin/next/finance/invoices/${a.invoiceId}`}>
                          {a.invoiceId}
                        </Link>{" "}
                        <Amount value={gbpMinor(a.amountMinor)} />
                      </span>
                    ))}
                    {p.allocations.length > 1 ? (
                      <span className={f.sub}>several invoices in one transfer</span>
                    ) : null}
                    {p.allocations.length === 1 &&
                    allocatedMinor(p) <
                      (invoiceById(p.allocations[0].invoiceId)?.grossMinor ?? 0) ? (
                      <span className={f.sub}>partial payment</span>
                    ) : null}
                    {over ? (
                      <Chip state="unmatched" label="Over-allocated — defect" />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={s.faint} style={{ fontSize: 12 }}>
          Split transfers (one invoice paid by several receipts) show on the
          invoice&apos;s allocations, e.g.{" "}
          <Link href="/admin/next/finance/invoices/INV-1041-01">INV-1041-01</Link>.
          Provider fees on payouts are the provider&apos;s charge to Nullshift; they are
          not client sales.
        </p>
      </section>
    </>
  );
}
