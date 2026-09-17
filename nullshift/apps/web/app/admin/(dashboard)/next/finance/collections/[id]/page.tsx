import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EXCEPTION_KIND_LABEL,
  clientRef,
  collectionById,
  exceptionsFor,
  fmtDate,
  payoutById,
  gbpMinor,
  netPayoutMinor,
} from "@/lib/next/fixtures-finance";
import {
  Amount,
  BankMatchChip,
  ClientLink,
  CollectionStateChip,
  ExceptionStateChip,
  KV,
  MandateChip,
  PayoutStateChip,
  SourceNote,
} from "../../ui";
import s from "../../../next.module.css";
import f from "../../finance.module.css";

/**
 * Finance › Collections › detail (brief §5.6): client, obligation, provider,
 * mandate state, accepted amount, contractual start, requested vs actual charge
 * date, collection state, payout state, bank-match state and owner.
 */
export default async function CollectionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const col = collectionById(id);
  if (!col) notFound();

  const c = clientRef(col.clientId);
  const payout = col.payoutId ? payoutById(col.payoutId) : undefined;
  const exceptions = exceptionsFor({ collectionId: col.id });

  const explain: Record<typeof col.state, string> = {
    authorised_not_scheduled:
      "The client has authorised a mandate but no collection has been requested from the provider. Nothing will be charged until activation approval schedules one with the required notice. This is a first-class state, not a pending schedule.",
    scheduled:
      "The provider has confirmed a charge date. The amount is the accepted amount on the governing schedule; no catalogue price is read.",
    submitted: "Submitted to the banking network; awaiting confirmation or failure.",
    confirmed:
      "The provider confirmed the collection. Payout and bank match follow separately.",
    failed:
      "The provider reported a failure. The obligation stays open; any retry is a new, approved attempt.",
    cancelled: "Cancelled before submission. No amount was collected.",
  };

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/next/finance/collections">Collections</Link> / {col.id}
      </p>
      <div className={s.pageHead}>
        <div>
          <h2 className={s.h1} style={{ fontSize: 22 }}>
            {col.id} · {col.obligation.label}
          </h2>
          <p className={s.lead}>
            <ClientLink id={c.id} name={c.legalName} legacy={c.model === "legacy"} /> ·{" "}
            {c.ref} · {col.provider}
          </p>
        </div>
        <div className={s.chips}>
          <CollectionStateChip state={col.state} />
          <PayoutStateChip state={col.payout} />
          <BankMatchChip state={col.bankMatch} />
        </div>
      </div>
      <SourceNote />

      <div className={f.detail}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="col-state">
            <h3 id="col-state" className={s.h2}>
              Collection state
            </h3>
            <p style={{ marginTop: 0 }}>{explain[col.state]}</p>
            {col.note ? <p className={s.muted}>{col.note}</p> : null}
            <KV
              rows={[
                { k: "Accepted amount", v: <Amount value={col.acceptedAmount} /> },
                { k: "Contractual start", v: fmtDate(col.contractualStart) },
                {
                  k: "Requested charge date",
                  v: col.requestedChargeDate
                    ? fmtDate(col.requestedChargeDate)
                    : "None requested",
                },
                {
                  k: "Actual charge date",
                  v: col.actualChargeDate ? fmtDate(col.actualChargeDate) : "—",
                },
                { k: "Owner", v: col.owner },
              ]}
            />
          </section>

          <section className={s.card} aria-labelledby="col-payout">
            <h3 id="col-payout" className={s.h2}>
              Payout and bank match
            </h3>
            {payout ? (
              <>
                <KV
                  rows={[
                    {
                      k: "Payout",
                      v: (
                        <Link href="/admin/next/finance/reconciliation">{payout.id}</Link>
                      ),
                    },
                    { k: "Received", v: fmtDate(payout.receivedAt) },
                    { k: "Gross", v: <Amount value={gbpMinor(payout.grossMinor)} /> },
                    {
                      k: "Fees",
                      v: (
                        <Amount
                          value={gbpMinor(
                            -payout.fees.reduce((n, l) => n + l.amountMinor, 0)
                          )}
                        />
                      ),
                    },
                    {
                      k: "Net (computed)",
                      v: <Amount value={gbpMinor(netPayoutMinor(payout))} />,
                    },
                    {
                      k: "Bank evidence",
                      v: payout.bankEvidence
                        ? `${payout.bankEvidence.statementLine} · ${fmtDate(payout.bankEvidence.at)}`
                        : "None yet",
                    },
                  ]}
                />
                {col.payout === "late_event" ? (
                  <p className={s.muted} style={{ fontSize: 12 }}>
                    The provider&apos;s payout event arrived late. State is derived from
                    the current obligations, not from event order, so the late event
                    changed nothing.
                  </p>
                ) : null}
              </>
            ) : (
              <p className={s.muted}>
                {col.payout === "pending"
                  ? "Collected but not yet paid out. The gross amount is counted under “Collected, not yet paid out” on the Overview until the provider pays out and the bank line is matched."
                  : "No payout applies to this collection."}
              </p>
            )}
          </section>

          <section className={s.card} aria-labelledby="col-exceptions">
            <h3 id="col-exceptions" className={s.h2}>
              Exceptions
            </h3>
            {exceptions.length === 0 ? (
              <p className={s.muted}>None.</p>
            ) : (
              <ul className={s.list}>
                {exceptions.map((e) => (
                  <li key={e.id} className={s.listItem}>
                    <span>
                      <Link
                        href={`/admin/next/finance/exceptions/${e.id}`}
                        className={s.rowLink}
                      >
                        {e.id} · {e.title}
                      </Link>
                      <span className={f.sub}>
                        {EXCEPTION_KIND_LABEL[e.kind]} · {e.owner}
                      </span>
                    </span>
                    <ExceptionStateChip state={e.state} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className={f.side}>
          <section className={s.card} aria-labelledby="col-mandate">
            <h3 id="col-mandate" className={s.h2}>
              Mandate and provider
            </h3>
            <KV
              rows={[
                { k: "Mandate state", v: <MandateChip state={col.mandate} /> },
                {
                  k: "Mandate id",
                  v: <span className={s.mono}>{col.providerIds.mandate ?? "—"}</span>,
                },
                {
                  k: "Subscription id",
                  v: (
                    <span className={s.mono}>{col.providerIds.subscription ?? "—"}</span>
                  ),
                },
                {
                  k: "Payment id",
                  v: <span className={s.mono}>{col.providerIds.payment ?? "—"}</span>,
                },
                { k: "Environment", v: "Sandbox (fixture) — never mixed with live" },
              ]}
            />
          </section>

          <section className={s.card} aria-labelledby="col-obligation">
            <h3 id="col-obligation" className={s.h2}>
              Obligation
            </h3>
            <KV
              rows={[
                {
                  k: "Obligation id",
                  v: <span className={s.mono}>{col.obligation.id}</span>,
                },
                {
                  k: "Invoice",
                  v: col.obligation.invoiceId ? (
                    <Link
                      href={`/admin/next/finance/invoices/${col.obligation.invoiceId}`}
                    >
                      {col.obligation.invoiceId}
                    </Link>
                  ) : (
                    <span className={s.faint}>not yet issued</span>
                  ),
                },
                { k: "Orchestrator", v: "One per obligation — this collection" },
              ]}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
