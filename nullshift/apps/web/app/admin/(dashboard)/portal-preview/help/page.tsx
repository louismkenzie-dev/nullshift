import Link from "next/link";
import { PORTAL_ROLES, activeItems } from "@/lib/next/fixtures-portal";
import s from "../portal.module.css";
import { portalHref, resolveCtx, type SearchParams } from "../_lib/context";
import { Frame } from "../_ui/Frame";

/** The clear route to help (brief §5.10): a named person, hours and what each step means. */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = resolveCtx(await searchParams);
  const c = ctx.client;
  const role = PORTAL_ROLES.find((r) => r.id === ctx.role)!;

  return (
    <Frame ctx={ctx} path="help" tab="help" title="Help">
      <header>
        <p className={s.eyebrow}>Help</p>
        <h1 className={s.h1}>Ask a person</h1>
        <p className={s.lead}>
          {c.help.owner} runs your project and answers everything here, including whether
          a step applies to you.
        </p>
      </header>

      <section className={s.card} aria-labelledby="contact-h">
        <h2 className={s.h2} id="contact-h">
          Contact
        </h2>
        <dl className={s.kv}>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${c.help.email}`}>{c.help.email}</a>
          </dd>
          <dt>Hours</dt>
          <dd>{c.help.hours}</dd>
          <dd className={s.kvNote}>
            We reply during working hours. Urgent live-service problems are handled under
            your agreement&apos;s response terms, not this inbox.
          </dd>
        </dl>
        <div className={s.actions}>
          <button
            type="button"
            className={`${s.btnPrimary} ${s.btnBlock}`}
            aria-disabled="true"
            aria-describedby="req-note"
          >
            Raise a request
          </button>
          <p className={`${s.p} ${s.small} ${s.muted}`} id="req-note">
            Preview only. In the real portal this opens your requests list, where you can
            see everything you have raised and its state.
          </p>
        </div>
      </section>

      <section className={s.card} aria-labelledby="role-h">
        <h2 className={s.h2} id="role-h">
          What you can do as {role.label.toLowerCase()}
        </h2>
        <p className={`${s.p}`}>{role.can}</p>
        <p className={`${s.p} ${s.muted}`}>{role.cannot}</p>
        <p className={`${s.p} ${s.small} ${s.muted}`}>
          Roles are set by your signatory. Ask us if the wrong person is named.
        </p>
      </section>

      <section className={s.card} aria-labelledby="steps-h">
        <h2 className={s.h2} id="steps-h">
          What each step means
        </h2>
        <ul className={s.list}>
          {activeItems(c).map((i) => (
            <li key={i.id}>
              <Link href={portalHref(`checklist/${i.id}`, ctx)} className={s.rowLink}>
                <div className={s.row} style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                  <div>
                    <div className={s.rowTitle}>{i.label}</div>
                    <div className={s.rowMeta}>{i.why}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Frame>
  );
}
