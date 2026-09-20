import Link from "next/link";
import { completion } from "@/lib/next/fixtures-portal";
import s from "../portal.module.css";
import { portalHref, resolveCtx, type SearchParams } from "../_lib/context";
import { Empty, Frame, ItemRow } from "../_ui/Frame";

/**
 * Initial checklist (brief §5.10): Company/billing details → Agreement →
 * Initial payment → Assets/access → Kickoff readiness. Every row shows why it
 * is required (on the step screen), who owns it and its state as text.
 */
export default async function InitialChecklist({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = resolveCtx(await searchParams);
  const c = ctx.client;
  const done = completion(c.initial);

  return (
    <Frame
      ctx={ctx}
      path="checklist"
      tab="checklist"
      back={{ path: "", label: "Back to home" }}
      title="Getting ready"
    >
      <header>
        <p className={s.eyebrow}>Getting ready · {done.label}</p>
        <h1 className={s.h1}>Before the build starts</h1>
        <p className={s.lead}>
          Five things unlock the build. Open any step to see why it is needed, who does it
          and what happens next. Anything you start is saved until you submit it.
        </p>
      </header>

      {c.initial.length ? (
        <ol className={s.list} aria-label="Initial checklist">
          {c.initial.map((item, i) => (
            <ItemRow key={item.id} item={item} ctx={ctx} index={i} />
          ))}
        </ol>
      ) : (
        <Empty>Nothing to do yet.</Empty>
      )}

      {c.phase === "later" ? (
        <section className={`${s.card}`} aria-labelledby="later-h">
          <h2 className={s.h2} id="later-h">
            Onboarding is complete
          </h2>
          <p className={`${s.p} ${s.muted}`}>
            The build is under way. Your remaining steps live under Next steps.
          </p>
          <div className={s.actions}>
            <Link href={portalHref("next-steps", ctx)} className={s.btn}>
              Go to next steps
            </Link>
          </div>
        </section>
      ) : null}
    </Frame>
  );
}
