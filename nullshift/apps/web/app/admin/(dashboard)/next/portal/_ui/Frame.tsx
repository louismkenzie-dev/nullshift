import Link from "next/link";
import {
  PORTAL_CLIENTS,
  PORTAL_ROLES,
  STATE_LABEL,
  canAct,
  isComplete,
  ownerLabel,
  type ChecklistItem,
  type ItemState,
} from "@/lib/next/fixtures-portal";
import next from "../../next.module.css";
import s from "../portal.module.css";
import { portalHref, type PortalCtx } from "../_lib/context";

type Tab = "home" | "checklist" | "billing" | "help";

const CLIENT_NOTE: Record<string, string> = {
  brightwell: "onboarding · initial checklist with a saved draft",
  northline: "managed · package pending · build acceptance possible without a package",
  harbour:
    "managed · schedule accepted · start 1 Oct · mandate authorised, not scheduled",
  orbit: "independent handover · £600 route",
  cedar: "date approaching without an accepted package · owned exception",
};

/**
 * Staff-facing preview controls. They are OUTSIDE the phone frame and are not
 * part of the portal: a real client never sees a client or role switcher.
 */
function Controls({ ctx, path }: { ctx: PortalCtx; path: string }) {
  return (
    <div className={s.controls} aria-label="Preview controls (staff only)">
      <div className={s.controlGroup} role="group" aria-label="Client fixture">
        <span className={next.mono}>Client</span>
        {PORTAL_CLIENTS.map((c) => (
          <Link
            key={c.id}
            href={portalHref(path, ctx, { client: c.id })}
            className={`${s.controlLink} ${c.id === ctx.client.id ? s.controlLinkActive : ""}`}
            aria-current={c.id === ctx.client.id ? "true" : undefined}
          >
            {c.name.replace(/ Ltd$/, "")}
          </Link>
        ))}
      </div>
      <div className={s.controlGroup} role="group" aria-label="Viewer role">
        <span className={next.mono}>Role</span>
        {PORTAL_ROLES.map((r) => (
          <Link
            key={r.id}
            href={portalHref(path, ctx, { role: r.id })}
            className={`${s.controlLink} ${r.id === ctx.role ? s.controlLinkActive : ""}`}
            aria-current={r.id === ctx.role ? "true" : undefined}
            title={`${r.can} ${r.cannot}`}
          >
            {r.label}
          </Link>
        ))}
      </div>
      <div className={s.controlGroup} role="group" aria-label="Frame width">
        <span className={next.mono}>Width</span>
        <Link
          href={portalHref(path, ctx, { wide: false })}
          className={`${s.controlLink} ${!ctx.wide ? s.controlLinkActive : ""}`}
          aria-current={!ctx.wide ? "true" : undefined}
        >
          Phone
        </Link>
        <Link
          href={portalHref(path, ctx, { wide: true })}
          className={`${s.controlLink} ${ctx.wide ? s.controlLinkActive : ""}`}
          aria-current={ctx.wide ? "true" : undefined}
        >
          Wide
        </Link>
      </div>
      <p className={s.controlNote}>
        Fixture: {CLIENT_NOTE[ctx.client.id] ?? "fictional client"}. Viewing as the{" "}
        {PORTAL_ROLES.find((r) => r.id === ctx.role)?.label.toLowerCase()}. Read-only
        prototype — no button here accepts, pays or writes anything.
      </p>
    </div>
  );
}

export function Frame({
  ctx,
  path,
  tab,
  back,
  title,
  children,
}: {
  ctx: PortalCtx;
  /** Path inside the portal used to rebuild links when the fixture/role changes. */
  path: string;
  tab: Tab;
  /** Optional back link (path inside the portal). */
  back?: { path: string; label: string };
  title?: string;
  children: React.ReactNode;
}) {
  const tabs: { id: Tab; label: string; path: string }[] = [
    { id: "home", label: "Home", path: "" },
    {
      id: "checklist",
      label: "Checklist",
      path: ctx.client.phase === "initial" ? "checklist" : "next-steps",
    },
    { id: "billing", label: "Billing", path: "billing" },
    { id: "help", label: "Help", path: "help" },
  ];
  return (
    <>
      <Controls ctx={ctx} path={path} />
      <div
        className={`${s.frame} ${ctx.wide ? s.frameWide : ""}`}
        data-portal-preview
        aria-label="Client portal preview"
      >
        <header className={s.bar}>
          {back ? (
            <Link href={portalHref(back.path, ctx)} className={s.barBack}>
              <span aria-hidden="true">←</span>
              <span className={s.srOnly}>{back.label}</span>
            </Link>
          ) : (
            <div className={s.barBrand}>
              <span className={s.barDot} aria-hidden="true" />
              Nullshift
            </div>
          )}
          {title ? <span className={s.barClient}>{title}</span> : null}
          {!title ? <span className={s.barClient}>{ctx.client.name}</span> : null}
        </header>
        <div className={s.body} id="portal-main">
          {children}
        </div>
        <nav className={s.nav} aria-label="Portal">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={portalHref(t.path, ctx)}
              className={`${s.navLink} ${t.id === tab ? s.navLinkActive : ""}`}
              aria-current={t.id === tab ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

/* ── Shared pieces ─────────────────────────────────────── */

export function StateChip({ state, mine }: { state: ItemState; mine?: boolean }) {
  const tone =
    state === "complete"
      ? s.chipSuccess
      : state === "blocked"
        ? s.chipWarning
        : state === "awaiting client" || mine
          ? s.chipInfo
          : "";
  return <span className={`${s.chip} ${tone}`}>{STATE_LABEL[state]}</span>;
}

function Mark({
  item,
  ctx,
  index,
}: {
  item: ChecklistItem;
  ctx: PortalCtx;
  index: number;
}) {
  const done = isComplete(item);
  const cls = done
    ? s.markDone
    : item.state === "blocked"
      ? s.markBlocked
      : canAct(item, ctx.role)
        ? s.markMine
        : "";
  return (
    <span className={`${s.mark} ${cls}`} aria-hidden="true">
      {done ? "✓" : index + 1}
    </span>
  );
}

/** One checklist row: label, state (text, not colour alone), owner and evidence. */
export function ItemRow({
  item,
  ctx,
  index,
}: {
  item: ChecklistItem;
  ctx: PortalCtx;
  index: number;
}) {
  const mine = canAct(item, ctx.role);
  const meta: string[] = [ownerLabel(item.owner, ctx.role)];
  if (item.evidence) meta.push(item.evidence);
  else if (item.draft)
    meta.push(
      `Saved ${item.draft.savedAt} · ${item.draft.fieldsDone} of ${item.draft.fieldsTotal} fields`
    );
  else if (item.due) meta.push(`by ${item.due}`);
  return (
    <li>
      <Link href={portalHref(`checklist/${item.id}`, ctx)} className={s.rowLink}>
        <div className={s.row}>
          <Mark item={item} ctx={ctx} index={index} />
          <div>
            <div className={s.cardHead}>
              <span className={s.rowTitle}>{item.label}</span>
              <StateChip state={item.state} mine={mine} />
            </div>
            <div className={s.rowMeta}>{meta.join(" · ")}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className={s.empty}>{children}</div>;
}

/** A date with its meaning, so a contractual date is never read as a charge date. */
export function DateLine({
  label,
  date,
  meaning,
}: {
  label: string;
  date: string;
  meaning: string;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{date}</dd>
      <dd className={s.kvNote}>{meaning}</dd>
    </>
  );
}
