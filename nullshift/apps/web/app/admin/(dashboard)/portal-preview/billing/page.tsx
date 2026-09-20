import Link from "next/link";
import { canVaryContract, money, type PortalInvoice } from "@/lib/next/fixtures-portal";
import s from "../portal.module.css";
import { portalHref, resolveCtx, type SearchParams } from "../_lib/context";
import { DateLine, Empty, Frame } from "../_ui/Frame";

const INVOICE_TONE: Record<PortalInvoice["state"], string> = {
  paid: s.chipSuccess,
  issued: s.chipInfo,
  scheduled: "",
  overdue: s.chipDanger,
};

/**
 * Billing (brief §5.10): invoices and payment setup. The billing admin sees
 * everything here but "cannot vary the contract"; the project contact sees
 * neither invoices nor payment setup. No internal cost, margin or staff note
 * exists in the portal fixture, so none can leak.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = resolveCtx(await searchParams);
  const c = ctx.client;
  const sees = ctx.role === "billing" || ctx.role === "signatory";
  const p = c.payment;

  return (
    <Frame ctx={ctx} path="billing" tab="billing" title="Billing">
      <header>
        <p className={s.eyebrow}>Billing</p>
        <h1 className={s.h1}>Invoices and payment</h1>
        <p className={s.lead}>
          {ctx.role === "billing"
            ? `You can pay invoices and set up payment. You cannot vary the contract: choosing a package or accepting a schedule needs your signatory${c.people.signatory ? ` (${c.people.signatory})` : ""}.`
            : ctx.role === "project"
              ? "Invoices and payment setup are visible to your signatory and billing admin."
              : "Everything issued to you, and how recurring fees are collected."}
        </p>
      </header>

      {!sees ? (
        <Empty>
          Nothing to see here as project contact. Ask{" "}
          {c.people.billing ?? "your billing admin"} for invoice questions.
        </Empty>
      ) : (
        <>
          <section className={s.card} aria-labelledby="inv-h">
            <h2 className={s.h2} id="inv-h">
              Invoices
            </h2>
            {c.invoices.length ? (
              <ul className={s.list} aria-label="Invoices">
                {c.invoices.map((inv, i) => (
                  <li key={`${inv.ref}-${i}`}>
                    <div
                      className={s.row}
                      style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
                    >
                      <div>
                        <div className={s.cardHead}>
                          <span className={s.rowTitle}>{inv.label}</span>
                          <span className={`${s.chip} ${INVOICE_TONE[inv.state]}`}>
                            {inv.state}
                          </span>
                        </div>
                        <div className={s.rowMeta}>
                          {money(inv.amountMinor, inv.currency)} · {inv.ref} ·{" "}
                          {inv.state === "paid" ? "paid" : "due"} {inv.due}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                No invoices yet. The first one follows the accepted agreement.
              </Empty>
            )}
            <p className={`${s.p} ${s.small} ${s.muted}`}>
              Invoices are issued from our accounting system and mirrored here. Paid means
              our accounting system has confirmed it — not that a button was pressed.
            </p>
          </section>

          <section className={s.card} aria-labelledby="pay-h">
            <h2 className={s.h2} id="pay-h">
              {p.route === "independent" ? "Handover fee" : "Recurring payment"}
            </h2>
            {p.route === "independent" ? (
              <dl className={s.kv}>
                <dt>Independent handover</dt>
                <dd>{p.handoverFee ? money(p.handoverFee.amountMinor) : "—"}</dd>
                <dd className={s.kvNote}>
                  One charge, {p.handoverFee?.state ?? "not issued"}. Sandbox figure; tax
                  basis pending decision. No Direct Debit and no recurring Nullshift fee.
                </dd>
              </dl>
            ) : p.package ? (
              <dl className={s.kv}>
                <dt>{p.package.name}</dt>
                <dd>{money(p.package.monthlyMinor)} / month</dd>
                <dd className={s.kvNote}>
                  {p.package.scheduleVersion}, accepted {p.package.acceptedOn}. Sandbox
                  figure.
                </dd>
                <DateLine
                  label="Service starts (contractual)"
                  date={p.contractualStart ?? "—"}
                  meaning="Your billing period starts on this date whatever the provider does."
                />
                <DateLine
                  label="Direct Debit mandate"
                  date={p.mandate === "authorised" ? "Authorised" : "Not set up"}
                  meaning="Authorisation lets us collect under the schedule. It does not start collection."
                />
                <DateLine
                  label="First collection (provider)"
                  date={p.providerCollectionDate ?? "Not yet scheduled"}
                  meaning="Confirmed by the provider once every gate has passed. You get advance notice. It can be later than the contractual start; the start does not move."
                />
              </dl>
            ) : (
              <>
                <Empty>
                  No recurring payment yet. A managed package is agreed as a separate
                  schedule; nothing is collected until it is accepted and a mandate
                  exists.
                </Empty>
                {p.contractualStart ? (
                  <dl className={s.kv}>
                    <DateLine
                      label="Agreed service start"
                      date={p.contractualStart}
                      meaning="Preserved from your Order Form. Not backdated, not moved and not charged without an accepted schedule."
                    />
                  </dl>
                ) : null}
              </>
            )}
          </section>

          {p.route === "managed" ? (
            <section className={s.card} aria-labelledby="dd-h">
              <h2 className={s.h2} id="dd-h">
                Direct Debit
              </h2>
              <p className={`${s.p} ${s.muted}`}>
                Bank details are entered on the provider&apos;s secure page, never in a
                Nullshift form. Nullshift does not see or store your account number or
                sort code.
              </p>
              <div className={s.actions}>
                {p.mandate === "authorised" ? (
                  <p className={`${s.notice} ${s.noticeSuccess}`}>Mandate authorised.</p>
                ) : ctx.role === "billing" || ctx.role === "signatory" ? (
                  <Link
                    href={portalHref("checklist/direct-debit", ctx)}
                    className={`${s.btn} ${s.btnBlock}`}
                  >
                    About setting up Direct Debit
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          {!canVaryContract(ctx.role) ? (
            <p className={`${s.notice} ${s.noticeMuted}`}>
              Changing the package, price or start date is a contract change and needs
              your signatory.
            </p>
          ) : null}
        </>
      )}
    </Frame>
  );
}
