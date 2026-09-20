import Link from "next/link";
import {
  activeItems,
  completion,
  nextStep,
  ownerLabel,
  type PortalClient,
} from "@/lib/next/fixtures-portal";
import s from "./portal.module.css";
import {
  portalHref,
  resolveCtx,
  type PortalCtx,
  type SearchParams,
} from "./_lib/context";
import { DateLine, Empty, Frame, StateChip } from "./_ui/Frame";

/**
 * Client portal dashboard (brief §5.10): "Let's get your project ready", a
 * meaningful completion count, ONE next step, upcoming dates and a clear route
 * to help. Reads fixtures only; nothing here writes.
 */
export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = resolveCtx(await searchParams);
  const c = ctx.client;
  const items = activeItems(c);
  const done = completion(items);
  const step = nextStep(items, ctx.role);
  const checklistPath = c.phase === "initial" ? "checklist" : "next-steps";

  return (
    <Frame ctx={ctx} path="" tab="home">
      <header>
        <p className={s.eyebrow}>
          {c.people[ctx.role] ? `Hello ${c.people[ctx.role]?.split(" ")[0]}` : c.name}
        </p>
        <h1 className={s.h1}>{c.headline}</h1>
        <p className={s.lead}>{c.intro}</p>
      </header>

      <section className={s.progress} aria-labelledby="progress-h">
        <div className={s.progressRow}>
          <h2 className={s.h2} id="progress-h">
            {c.phase === "initial" ? "Getting ready" : "Next steps"}
          </h2>
          <span className={s.progressCount}>{done.label}</span>
        </div>
        <meter
          className={s.meter}
          min={0}
          max={done.total || 1}
          value={done.done}
          aria-label={`${done.label} of the required steps`}
        />
        <Link href={portalHref(checklistPath, ctx)} className={`${s.small} ${s.muted}`}>
          See every step and who owns it →
        </Link>
      </section>

      {c.exception ? <ExceptionCard c={c} ctx={ctx} /> : null}

      <section
        className={`${s.card} ${step?.mine ? s.cardPrimary : ""}`}
        aria-labelledby="next-h"
      >
        <p className={s.eyebrow} id="next-h">
          Your next step
        </p>
        {step ? (
          <>
            <div className={s.cardHead}>
              <span className={s.rowTitle}>{step.item.label}</span>
              <StateChip state={step.item.state} mine={step.mine} />
            </div>
            <p className={`${s.p} ${s.muted}`}>{step.item.why}</p>
            <dl className={s.facts}>
              <dt>Owner</dt>
              <dd>
                {ownerLabel(step.item.owner, ctx.role)}
                {!step.mine && step.item.owner !== "nullshift"
                  ? ` (${c.people[step.item.owner] ?? "not yet named"})`
                  : ""}
              </dd>
              {step.item.due ? (
                <>
                  <dt>By</dt>
                  <dd>{step.item.due}</dd>
                </>
              ) : null}
            </dl>
            <div className={s.actions}>
              <Link
                href={portalHref(`checklist/${step.item.id}`, ctx)}
                className={step.mine ? s.btnPrimary : s.btn}
              >
                {step.mine
                  ? step.item.draft
                    ? "Continue where you left off"
                    : "Open this step"
                  : "See what is happening"}
              </Link>
            </div>
            {!step.mine ? (
              <p className={`${s.p} ${s.small} ${s.muted}`}>
                Nothing is waiting on you right now.
              </p>
            ) : null}
          </>
        ) : (
          <Empty>
            Everything on your list is done. We will tell you when there is more.
          </Empty>
        )}
      </section>

      <section className={s.card} aria-labelledby="dates-h">
        <h2 className={s.h2} id="dates-h">
          Upcoming dates
        </h2>
        {c.dates.length ? (
          <dl className={s.kv}>
            {c.dates.map((d) => (
              <DateLine key={d.label} label={d.label} date={d.date} meaning={d.meaning} />
            ))}
          </dl>
        ) : (
          <Empty>No dates yet. They appear here once the agreement is accepted.</Empty>
        )}
      </section>

      <section className={s.card} aria-labelledby="help-h">
        <h2 className={s.h2} id="help-h">
          Stuck or unsure?
        </h2>
        <p className={`${s.p} ${s.muted}`}>
          {c.help.owner} runs your project. Ask anything — including what a step means or
          whether you need to do it.
        </p>
        <div className={s.actions}>
          <Link href={portalHref("help", ctx)} className={s.btn}>
            Get help
          </Link>
        </div>
      </section>
    </Frame>
  );
}

function ExceptionCard({ c, ctx }: { c: PortalClient; ctx: PortalCtx }) {
  const e = c.exception!;
  return (
    <section className={`${s.card} ${s.cardWarning}`} aria-labelledby="exc-h">
      <p className={s.eyebrow} id="exc-h">
        Needs a decision · raised {e.opened}
      </p>
      <span className={s.rowTitle}>{e.title}</span>
      <p className={`${s.p} ${s.muted}`}>Owned by {e.owner}. Your options:</p>
      <ol className={s.ol}>
        {e.options.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ol>
      <p className={`${s.p} ${s.small} ${s.muted}`}>{e.preserved}</p>
      <div className={s.actions}>
        <Link href={portalHref("help", ctx)} className={s.btn}>
          Talk to {e.owner.split(" ")[0]}
        </Link>
      </div>
    </section>
  );
}
