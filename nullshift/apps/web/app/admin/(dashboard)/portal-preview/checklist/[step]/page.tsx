import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OWNER_LABEL,
  canAct,
  canVaryContract,
  isComplete,
  ownerLabel,
  portalItemById,
  type ChecklistItem,
  type PortalRole,
} from "@/lib/next/fixtures-portal";
import s from "../../portal.module.css";
import {
  portalHref,
  resolveCtx,
  type PortalCtx,
  type SearchParams,
} from "../../_lib/context";
import { Frame, StateChip } from "../../_ui/Frame";

/** Items that vary the contract: only the signatory may complete them (brief §5.10). */
const CONTRACT_ITEMS = new Set([
  "agreement",
  "acceptance",
  "package",
  "schedule",
  "handover-plan",
]);

/** Prototype form for the one save-and-return example (Brightwell, company details). */
const COMPANY_FIELDS: { label: string; hint?: string; value?: string }[] = [
  { label: "Legal company name", value: "Brightwell Demo Ltd" },
  { label: "Company number", value: "00000000 (fixture)" },
  { label: "Registered address", value: "1 Example Street, Ipswich (fixture)" },
  { label: "Trading name (if different)", value: "Brightwell" },
  { label: "Invoice email", hint: "Where invoices and payment receipts are sent" },
  { label: "VAT registered?", hint: "Yes or no. If yes, your VAT number" },
  {
    label: "Purchase order required?",
    hint: "If your finance team needs a PO on every invoice",
  },
];

export default async function StepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ step }, sp] = await Promise.all([params, searchParams]);
  const ctx = resolveCtx(sp);
  const found = portalItemById(ctx.client, step);
  if (!found) notFound();
  const { item, phase } = found;
  const listPath = phase === "initial" ? "checklist" : "next-steps";
  const list = phase === "initial" ? ctx.client.initial : ctx.client.later;
  const index = list.findIndex((i) => i.id === item.id);
  const mine = canAct(item, ctx.role);
  const ownerName =
    item.owner === "nullshift" ? ctx.client.help.owner : ctx.client.people[item.owner];

  return (
    <Frame
      ctx={ctx}
      path={`checklist/${item.id}`}
      tab="checklist"
      back={{
        path: listPath,
        label: phase === "initial" ? "Back to getting ready" : "Back to next steps",
      }}
      title={`Step ${index + 1} of ${list.length}`}
    >
      <header>
        <p className={s.eyebrow}>
          {phase === "initial" ? "Getting ready" : "Next steps"}
        </p>
        <h1 className={s.h1}>{item.label}</h1>
        <div className={s.chips} style={{ marginTop: 10 }}>
          <StateChip state={item.state} mine={mine} />
        </div>
      </header>

      <dl className={s.facts}>
        <dt>Why</dt>
        <dd>{item.why}</dd>
        <dt>Who</dt>
        <dd>
          {ownerLabel(item.owner, ctx.role)}
          {ownerName && item.owner !== ctx.role ? ` — ${ownerName}` : ""}
        </dd>
        <dt>Source</dt>
        <dd>{item.source}</dd>
        {item.due ? (
          <>
            <dt>By</dt>
            <dd>{item.due}</dd>
          </>
        ) : null}
        {item.evidence ? (
          <>
            <dt>Done</dt>
            <dd>{item.evidence}</dd>
          </>
        ) : null}
      </dl>

      <Status item={item} ctx={ctx} />

      <section aria-labelledby="what-h">
        <h2 className={s.h2} id="what-h">
          What happens
        </h2>
        <ol className={s.ol} style={{ marginTop: 8 }}>
          {item.steps.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </section>

      {item.hostedFlow ? <HostedFlowNotice item={item} /> : null}

      {mine && item.id === "company" && !isComplete(item) ? (
        <CompanyForm item={item} />
      ) : null}

      <ActionBar item={item} ctx={ctx} mine={mine} listPath={listPath} />
    </Frame>
  );
}

/** Role and state explanation, always in words (colour only reinforces). */
function Status({ item, ctx }: { item: ChecklistItem; ctx: PortalCtx }) {
  const name = item.owner === "nullshift" ? undefined : ctx.client.people[item.owner];
  if (isComplete(item))
    return (
      <p className={`${s.notice} ${s.noticeSuccess}`}>
        Done{item.evidence ? ` — ${item.evidence}` : ""}. Need to change something? Use
        Help and we will tell you what can be varied and how.
      </p>
    );
  if (item.state === "blocked")
    return (
      <p className={`${s.notice} ${s.noticeWarning}`}>
        Not available yet. {item.note ?? "An earlier step has to finish first."}
      </p>
    );
  if (item.owner === "nullshift")
    return (
      <p className={`${s.notice} ${s.noticeMuted}`}>
        Nullshift is doing this. {item.note ?? "You will be told here when it is done."}
      </p>
    );
  if (item.owner !== ctx.role)
    return <RoleNotice item={item} role={ctx.role} name={name} />;
  return item.note ? <p className={s.notice}>{item.note}</p> : null;
}

function RoleNotice({
  item,
  role,
  name,
}: {
  item: ChecklistItem;
  role: PortalRole;
  name?: string;
}) {
  const who = `${OWNER_LABEL[item.owner]}${name ? ` (${name})` : ""}`;
  if (CONTRACT_ITEMS.has(item.id) && !canVaryContract(role))
    return (
      <p className={`${s.notice} ${s.noticeWarning}`}>
        {role === "billing"
          ? "As billing admin you can see this but cannot vary the contract. "
          : "As project contact you can see this but cannot accept it. "}
        Accepting it needs {who}.
      </p>
    );
  return (
    <p className={`${s.notice} ${s.noticeMuted}`}>
      This step belongs to {who}. You can read it; only they can complete it.
    </p>
  );
}

function HostedFlowNotice({ item }: { item: ChecklistItem }) {
  const dd = item.id === "direct-debit";
  return (
    <section className={s.card} aria-labelledby="hosted-h">
      <h2 className={s.h2} id="hosted-h">
        {dd ? "Where your bank details go" : "Where your payment details go"}
      </h2>
      <p className={`${s.p} ${s.muted}`}>
        {dd
          ? "Your account number and sort code are entered on the Direct Debit provider's secure page, never in a Nullshift form. Nullshift does not see or store them. Setting up the mandate authorises collection under your accepted schedule; it does not start it, and you receive notice before any collection."
          : "Card or bank details are entered on the payment provider's hosted page, never in a Nullshift form. Nullshift does not see or store them."}
      </p>
    </section>
  );
}

function CompanyForm({ item }: { item: ChecklistItem }) {
  return (
    <form aria-labelledby="form-h">
      <fieldset className={s.fieldset}>
        <legend className={s.h2} id="form-h">
          Your details
        </legend>
        {item.draft ? (
          <p className={s.notice}>
            Saved {item.draft.savedAt} · {item.draft.fieldsDone} of{" "}
            {item.draft.fieldsTotal} fields. Nothing is sent to Nullshift until you press
            Submit.
          </p>
        ) : null}
        {COMPANY_FIELDS.map((f, i) => {
          const id = `f-${i}`;
          return (
            <div className={s.field} key={f.label}>
              <label className={s.label} htmlFor={id}>
                {f.label}
              </label>
              {f.hint ? (
                <span className={s.hint} id={`${id}-hint`}>
                  {f.hint}
                </span>
              ) : null}
              <input
                id={id}
                className={`${s.input} ${f.value ? s.inputDone : s.inputEmpty}`}
                type="text"
                defaultValue={f.value ?? ""}
                placeholder={f.value ? undefined : "Not filled in yet"}
                aria-describedby={f.hint ? `${id}-hint` : undefined}
                readOnly
              />
            </div>
          );
        })}
      </fieldset>
    </form>
  );
}

/**
 * Sticky primary action. Buttons are inert in this prototype (they would call
 * a portal server action behind a flag); they stay focusable so the tab order
 * and the sticky-vs-keyboard behaviour can be reviewed.
 */
function ActionBar({
  item,
  ctx,
  mine,
  listPath,
}: {
  item: ChecklistItem;
  ctx: PortalCtx;
  mine: boolean;
  listPath: string;
}) {
  if (!mine) {
    return (
      <div className={s.sticky}>
        <div className={s.actions}>
          <Link href={portalHref(listPath, ctx)} className={`${s.btn} ${s.btnBlock}`}>
            Back to the list
          </Link>
        </div>
      </div>
    );
  }
  const primary =
    item.id === "direct-debit"
      ? "Continue to the provider's secure page"
      : item.id === "initial-payment"
        ? "Open the invoice"
        : CONTRACT_ITEMS.has(item.id)
          ? "Review and accept"
          : item.draft
            ? "Submit"
            : "Mark as done";
  return (
    <div className={s.sticky}>
      <div className={s.actions}>
        <button
          type="button"
          className={`${s.btnPrimary} ${s.btnBlock}`}
          aria-disabled="true"
          aria-describedby="proto-note"
        >
          {primary}
        </button>
        <Link href={portalHref(listPath, ctx)} className={`${s.btn} ${s.btnBlock}`}>
          {item.draft || item.id === "company" ? "Save and return later" : "Not now"}
        </Link>
        <p className={`${s.p} ${s.small} ${s.muted}`} id="proto-note">
          Preview only: this button does nothing here. In the real portal it runs a
          permission-checked, audited action and never optimistically marks a payment or
          signature as done.
        </p>
      </div>
    </div>
  );
}
