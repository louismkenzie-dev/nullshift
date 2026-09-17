import Link from "next/link";
import { completion, money } from "@/lib/next/fixtures-portal";
import s from "../portal.module.css";
import { portalHref, resolveCtx, type SearchParams } from "../_lib/context";
import { DateLine, Empty, Frame, ItemRow } from "../_ui/Frame";

/**
 * Later checklist (brief §5.10, §8.2–8.5): Build review/acceptance → Managed
 * package selection and service-schedule acceptance OR independent handover →
 * activation/transfer completion. Which branch renders comes from the
 * fixture's route; the client never sees both.
 */
export default async function NextSteps({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = resolveCtx(await searchParams);
  const c = ctx.client;
  const done = completion(c.later);
  const independent = c.payment.route === "independent";

  return (
    <Frame
      ctx={ctx}
      path="next-steps"
      tab="checklist"
      back={{ path: "", label: "Back to home" }}
      title="Next steps"
    >
      <header>
        <p className={s.eyebrow}>
          {independent ? "Independent handover" : "Managed service"} · {done.label}
        </p>
        <h1 className={s.h1}>
          {independent
            ? "From accepted build to your own hands"
            : "From accepted build to live service"}
        </h1>
        <p className={s.lead}>
          {independent
            ? "You take over hosting, data and accounts. Nullshift transfers everything, verifies it, then steps back. There is no ongoing Nullshift management on this route."
            : "You accept the build first. A managed package is agreed separately, and nothing is collected until a schedule is accepted, a mandate exists and every gate has passed."}
        </p>
      </header>

      {c.later.length ? (
        <ol className={s.list} aria-label="Next steps">
          {c.later.map((item, i) => (
            <ItemRow key={item.id} item={item} ctx={ctx} index={i} />
          ))}
        </ol>
      ) : (
        <Empty>
          Next steps appear here once onboarding is complete and the build is under way.
        </Empty>
      )}

      {independent ? (
        <section className={s.card} aria-labelledby="fee-h">
          <h2 className={s.h2} id="fee-h">
            What this route costs
          </h2>
          <dl className={s.kv}>
            <dt>Independent handover fee</dt>
            <dd>
              {c.payment.handoverFee
                ? `${money(c.payment.handoverFee.amountMinor)} · ${c.payment.handoverFee.state}`
                : "—"}
            </dd>
            <dd className={s.kvNote}>
              One charge, invoiced once (sandbox figure — tax basis pending decision).
              Includes the transfer deliverables listed in your handover schedule.
            </dd>
            <dt>Ongoing Nullshift fee</dt>
            <dd>None</dd>
            <dd className={s.kvNote}>
              No subscription is created. Hosting, domains and other third-party services
              are paid by you, directly, in accounts you own.
            </dd>
          </dl>
        </section>
      ) : (
        <section className={s.card} aria-labelledby="pkg-h">
          <h2 className={s.h2} id="pkg-h">
            Your managed package
          </h2>
          {c.payment.package ? (
            <dl className={s.kv}>
              <dt>Package</dt>
              <dd>{c.payment.package.name}</dd>
              <dt>Price</dt>
              <dd>{money(c.payment.package.monthlyMinor)} / month</dd>
              <dd className={s.kvNote}>
                Sandbox figure from {c.payment.package.scheduleVersion}, accepted{" "}
                {c.payment.package.acceptedOn}. Tax, cadence and cancellation terms are in
                the schedule.
              </dd>
              <DateLine
                label="Service starts (contractual)"
                date={c.payment.contractualStart ?? "—"}
                meaning="The date in your accepted schedule. Set by agreement, not by the payment provider."
              />
              <DateLine
                label="First collection (provider)"
                date={c.payment.providerCollectionDate ?? "Not yet scheduled"}
                meaning={
                  c.payment.mandate === "authorised"
                    ? "Your mandate is authorised. The collection date is confirmed by the provider and shown here when it exists; you receive notice before any collection."
                    : "Needs an authorised mandate."
                }
              />
            </dl>
          ) : (
            <>
              <Empty>
                No package chosen. That is expected right now: acceptance of the build
                does not depend on it, and no plan is selected for you by default.
              </Empty>
              {c.payment.contractualStart ? (
                <dl className={s.kv}>
                  <DateLine
                    label="Agreed service start"
                    date={c.payment.contractualStart}
                    meaning="From your Order Form. Preserved until an amendment is accepted; nothing is charged without an accepted schedule."
                  />
                </dl>
              ) : null}
            </>
          )}
        </section>
      )}

      <div className={s.actions}>
        <Link href={portalHref("checklist", ctx)} className={s.btn}>
          See the completed onboarding steps
        </Link>
      </div>
    </Frame>
  );
}
