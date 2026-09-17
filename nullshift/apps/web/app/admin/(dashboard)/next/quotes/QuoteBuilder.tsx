"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Plus, Printer, Save, Trash2 } from "lucide-react";
import {
  emptyQuote,
  gbp,
  parseQuote,
  quoteTotals,
  type QuoteCosts,
  type QuoteDocument,
  type QuoteDraft,
} from "@/lib/next/quote-builder";
import { saveBuilderQuote } from "./builder-actions";
import s from "../next.module.css";
import q from "./builder.module.css";

type Client = { id: string; name: string; contact_email: string | null };
const STEPS = [
  "Client & brief",
  "Scope & price",
  "After launch",
  "Payment terms",
  "Review",
];
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className={q.field}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function MoneyInput({
  label,
  value,
  onChange,
  nullable = false,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  nullable?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value === null ? "" : value / 100}
        onChange={(e) =>
          onChange(
            nullable && e.target.value === ""
              ? null
              : Math.round(Number(e.target.value) * 100)
          )
        }
      />
    </Field>
  );
}

export function QuoteBuilder({
  id,
  initial = emptyQuote(),
  updatedAt = null,
  status = "draft",
  clients,
  version = 1,
}: {
  id: string;
  initial?: QuoteDraft;
  updatedAt?: string | null;
  status?: string;
  clients: Client[];
  version?: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [revision, setRevision] = useState(updatedAt);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const d = draft.document,
    c = draft.costs;
  const dirty = saved !== JSON.stringify(draft);
  const editable = ["draft", "internal_review"].includes(status);
  const totals = quoteTotals(d, c);
  const update = <K extends keyof QuoteDocument>(key: K, value: QuoteDocument[K]) =>
    setDraft((old) => ({ ...old, document: { ...old.document, [key]: value } }));
  const cost = <K extends keyof QuoteCosts>(key: K, value: QuoteCosts[K]) =>
    setDraft((old) => ({ ...old, costs: { ...old.costs, [key]: value } }));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const intercept = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a[href]");
      if (
        anchor &&
        !window.confirm("You have unsaved quote changes. Leave without saving?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty]);
  function save() {
    const parsed = parseQuote(draft);
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    setMessage("");
    startTransition(async () => {
      try {
        const result = await saveBuilderQuote({
          id,
          updatedAt: revision,
          draft: parsed.value,
        });
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        setDraft(parsed.value);
        setSaved(JSON.stringify(parsed.value));
        setRevision(result.updatedAt);
        setMessage("Saved. No email, contract or payment has been created.");
        // Keep the current form mounted while making the saved quote reopenable.
        window.history.replaceState(null, "", `/admin/next/quotes/${id}`);
        router.refresh();
      } catch {
        setMessage(
          "The save could not be confirmed. Retry before leaving; the same draft ID prevents duplicates."
        );
      }
    });
  }
  return (
    <div className={q.builder}>
      <div className={q.controls}>
        <Link href="/admin/next/quotes" className={s.backLink}>
          <ArrowLeft size={14} /> All quotes
        </Link>
        <div className={q.heading}>
          <div>
            <p className={s.eyebrow}>BUILD / RUN / GROW / TRANSACT</p>
            <h1 className={s.h1}>{revision ? "Your quote" : "Build a quote"}</h1>
            <p className={s.muted}>
              A clear scope. A considered price. Everything in one place.
            </p>
          </div>
          <span className={s.chip}>
            {dirty ? "Unsaved changes" : revision ? "Saved draft" : "New draft"} · v
            {version}
          </span>
        </div>
        <div className={q.toolbar}>
          <button
            className={s.btnPrimary}
            onClick={save}
            disabled={pending || !editable || !dirty}
          >
            <Save size={16} />
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            className={s.btn}
            onClick={() => {
              setPreview(!preview);
              setMessage("");
            }}
          >
            {preview ? "Back to editor" : "Client preview"}
          </button>
          {preview && (
            <button
              className={s.btn}
              disabled={!revision || dirty || pending}
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print / save PDF
            </button>
          )}
          <span className={s.muted}>Draft only · nothing sent automatically</span>
        </div>
        {message && (
          <p role="status" className={q.message}>
            {message}
          </p>
        )}
        {preview && dirty && (
          <p className={q.message}>Save your changes before printing the client copy.</p>
        )}
        {!editable && (
          <p className={q.message}>
            This version is frozen. Its content cannot be changed.
          </p>
        )}
      </div>
      {preview ? (
        <QuotePreview document={d} id={id} version={version} />
      ) : (
        <div className={q.editor}>
          <div className={q.formColumn}>
            <nav className={q.steps} aria-label="Quote steps">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-current={step === i ? "step" : undefined}
                  onClick={() => setStep(i)}
                >
                  <span>{i + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
            <fieldset disabled={pending || !editable} className={q.panel}>
              <h2>{STEPS[step]}</h2>
              {step === 0 && (
                <>
                  <Field
                    label="Client"
                    hint={
                      revision
                        ? "A saved quote stays with its original client."
                        : "Choose an existing client, or quote for a prospect without creating a client account."
                    }
                  >
                    <select
                      value={d.clientId}
                      disabled={!!revision}
                      onChange={(e) => {
                        const client = clients.find((x) => x.id === e.target.value);
                        setDraft((old) => ({
                          ...old,
                          document: {
                            ...old.document,
                            clientId: e.target.value,
                            business: client?.name || "",
                            email: client?.contact_email || "",
                          },
                        }));
                      }}
                    >
                      <option value="">New prospect</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className={q.two}>
                    <Field label="Business name">
                      <input
                        value={d.business}
                        maxLength={250}
                        onChange={(e) => update("business", e.target.value)}
                      />
                    </Field>
                    <Field label="Contact email (optional)">
                      <input
                        type="email"
                        value={d.email}
                        maxLength={250}
                        onChange={(e) => update("email", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Project name">
                    <input
                      value={d.title}
                      maxLength={250}
                      placeholder="e.g. Booking and operations platform"
                      onChange={(e) => update("title", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="The outcome"
                    hint="What will be better for their team and customers?"
                  >
                    <textarea
                      rows={5}
                      value={d.summary}
                      maxLength={10000}
                      onChange={(e) => update("summary", e.target.value)}
                    />
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <Field
                    label="Included scope"
                    hint="One deliverable per line. Be explicit about what you are building."
                  >
                    <textarea
                      rows={4}
                      value={d.included}
                      maxLength={10000}
                      onChange={(e) => update("included", e.target.value)}
                    />
                  </Field>
                  <Field label="Not included">
                    <textarea
                      rows={3}
                      value={d.excluded}
                      maxLength={10000}
                      placeholder="e.g. Copywriting, historical data clean-up, additional integrations"
                      onChange={(e) => update("excluded", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Acceptance criteria"
                    hint="How will both sides know the agreed build is complete?"
                  >
                    <textarea
                      rows={3}
                      value={d.acceptance}
                      maxLength={10000}
                      onChange={(e) => update("acceptance", e.target.value)}
                    />
                  </Field>
                  <h3>Build line items</h3>
                  {d.lines.map((line, i) => (
                    <div className={q.line} key={i}>
                      <Field label={`Item ${i + 1}`}>
                        <input
                          value={line.name}
                          maxLength={300}
                          onChange={(e) =>
                            update(
                              "lines",
                              d.lines.map((l, n) =>
                                n === i ? { ...l, name: e.target.value } : l
                              )
                            )
                          }
                        />
                      </Field>
                      <Field label={`Quantity ${i + 1}`}>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          step="1"
                          value={line.quantity}
                          onChange={(e) =>
                            update(
                              "lines",
                              d.lines.map((l, n) =>
                                n === i ? { ...l, quantity: Number(e.target.value) } : l
                              )
                            )
                          }
                        />
                      </Field>
                      <MoneyInput
                        label={`Unit price ${i + 1} (£)`}
                        value={line.unitMinor}
                        onChange={(value) =>
                          update(
                            "lines",
                            d.lines.map((l, n) =>
                              n === i ? { ...l, unitMinor: value || 0 } : l
                            )
                          )
                        }
                      />
                      <button
                        type="button"
                        className={s.btn}
                        aria-label={`Remove item ${i + 1}`}
                        disabled={d.lines.length === 1}
                        onClick={() =>
                          update(
                            "lines",
                            d.lines.filter((_, n) => n !== i)
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={s.btn}
                    disabled={d.lines.length >= 50}
                    onClick={() =>
                      update("lines", [
                        ...d.lines,
                        { name: "", quantity: 1, unitMinor: 0 },
                      ])
                    }
                  >
                    <Plus size={15} />
                    Add line item
                  </button>
                  <details className={q.costs}>
                    <summary>
                      Internal pricing calculator · never shown to the client
                    </summary>
                    <p>
                      Enter your own delivery costs. These are per-quote assumptions, not
                      approved company rates. Suggested build price = cost including
                      contingency and reserve ÷ (1 − target margin).
                    </p>
                    <div className={q.two}>
                      <MoneyInput
                        label="Delivery cost (£)"
                        value={c.deliveryMinor}
                        onChange={(n) => cost("deliveryMinor", n || 0)}
                      />
                      <MoneyInput
                        label="External costs (£)"
                        value={c.externalMinor}
                        onChange={(n) => cost("externalMinor", n || 0)}
                      />
                      <MoneyInput
                        label="Warranty / risk reserve (£)"
                        value={c.reserveMinor}
                        onChange={(n) => cost("reserveMinor", n || 0)}
                      />
                      <Field label="Contingency (%)">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={c.contingencyPct}
                          onChange={(e) => cost("contingencyPct", Number(e.target.value))}
                        />
                      </Field>
                      <Field label="Target gross margin (%)">
                        <input
                          type="number"
                          min="0"
                          max="95"
                          value={c.targetMarginPct}
                          onChange={(e) =>
                            cost("targetMarginPct", Number(e.target.value))
                          }
                        />
                      </Field>
                    </div>
                    <p>
                      Cost including risk: <strong>{gbp(totals.cost)}</strong>
                      <br />
                      Suggested build:{" "}
                      <strong>
                        {totals.cost > 0
                          ? gbp(totals.suggested)
                          : "Enter your delivery costs"}
                      </strong>
                      <br />
                      Current build margin:{" "}
                      <strong>
                        {totals.cost === 0 || totals.marginPct === null
                          ? "Not assessed"
                          : `${totals.marginPct.toFixed(1)}%`}
                      </strong>
                    </p>
                    <small>
                      The suggestion does not overwrite your line items. Monthly service
                      costs are not included in this calculation.
                    </small>
                  </details>
                </>
              )}
              {step === 2 && (
                <>
                  <Field
                    label="After the build"
                    hint="Record the preferred route now; finalise it in the contract. Managed package selection can follow build acceptance."
                  >
                    <select
                      value={d.route}
                      onChange={(e) =>
                        update("route", e.target.value as QuoteDocument["route"])
                      }
                    >
                      <option value="unresolved">To be agreed before contract</option>
                      <option value="managed">Nullshift Managed Platform</option>
                      <option value="independent">Independent handover</option>
                    </select>
                  </Field>
                  {d.route === "managed" && (
                    <>
                      <MoneyInput
                        label="Proposed monthly fee (£) — optional"
                        nullable
                        value={d.monthlyMinor}
                        onChange={(n) => update("monthlyMinor", n)}
                      />
                      <Field
                        label="Proposed billing start — optional"
                        hint="The contract must agree a date before billing begins. Nothing is activated here."
                      >
                        <input
                          type="date"
                          value={d.billingDate}
                          onChange={(e) => update("billingDate", e.target.value)}
                        />
                      </Field>
                      <p>
                        RUN operates and maintains the existing platform. New features and
                        design changes are quoted separately under GROW.
                      </p>
                    </>
                  )}
                  {d.route === "independent" && (
                    <>
                      <MoneyInput
                        label="One-off handover / migration fee (£)"
                        value={d.handoverMinor}
                        onChange={(n) => update("handoverMinor", n || 0)}
                      />
                      <p>
                        No ongoing Nullshift management fee. The client takes
                        responsibility for hosting, providers and ongoing operation;
                        third-party costs may continue.
                      </p>
                    </>
                  )}
                  <Field
                    label="Platform transaction fee (%) — optional"
                    hint="Only where relevant. Processor fees remain separate; no merchant-of-record claim."
                  >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={d.transactPct ?? ""}
                      placeholder="Not proposed"
                      onChange={(e) =>
                        update(
                          "transactPct",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                    />
                  </Field>
                  <Field label="Defect warranty (days after launch)">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={d.warrantyDays}
                      onChange={(e) => update("warrantyDays", Number(e.target.value))}
                    />
                  </Field>
                </>
              )}
              {step === 3 && (
                <>
                  <p className={s.muted}>
                    Milestones apply to the build fee before VAT. Any handover fee is a
                    separate payment on handover.
                  </p>
                  {d.milestones.map((m, i) => (
                    <div className={q.two} key={i}>
                      <Field label={`Milestone ${i + 1}`}>
                        <input
                          value={m.label}
                          maxLength={200}
                          onChange={(e) =>
                            update(
                              "milestones",
                              d.milestones.map((x, n) =>
                                n === i ? { ...x, label: e.target.value } : x
                              )
                            )
                          }
                        />
                      </Field>
                      <Field label={`Percentage ${i + 1}`}>
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={m.pct}
                          onChange={(e) =>
                            update(
                              "milestones",
                              d.milestones.map((x, n) =>
                                n === i ? { ...x, pct: Number(e.target.value) } : x
                              )
                            )
                          }
                        />
                      </Field>
                    </div>
                  ))}
                  <p>
                    Total: {d.milestones.reduce((n, m) => n + m.pct, 0)}% · must equal
                    100%
                  </p>
                  <div className={q.two}>
                    <Field
                      label="VAT rate (%)"
                      hint="Confirm Nullshift’s applicable VAT treatment. No tax is added by default."
                    >
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={d.vatPct}
                        onChange={(e) => update("vatPct", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Quote valid until (optional)">
                      <input
                        type="date"
                        value={d.validUntil}
                        onChange={(e) => update("validUntil", e.target.value)}
                      />
                    </Field>
                  </div>
                </>
              )}
              {step === 4 && (
                <>
                  <p>
                    Check the client-facing copy before sharing it. Saving a quote does
                    not accept an agreement, create a project, raise an invoice or start
                    billing.
                  </p>
                  <dl className={q.review}>
                    <dt>Client</dt>
                    <dd>{d.business || "Required"}</dd>
                    <dt>Project</dt>
                    <dd>{d.title || "Required"}</dd>
                    <dt>Included scope</dt>
                    <dd>{d.included || "Required"}</dd>
                    <dt>Service route</dt>
                    <dd>
                      {d.route === "unresolved"
                        ? "To be agreed before contract"
                        : d.route === "managed"
                          ? "Managed Platform"
                          : "Independent handover"}
                    </dd>
                    <dt>Monthly fee</dt>
                    <dd>
                      {d.route === "managed"
                        ? d.monthlyMinor === null
                          ? "To be agreed after build acceptance"
                          : gbp(d.monthlyMinor)
                        : "Not proposed"}
                    </dd>
                  </dl>
                  <button
                    type="button"
                    className={s.btn}
                    onClick={() => setPreview(true)}
                  >
                    Review client copy →
                  </button>
                </>
              )}
              <div className={q.stepActions}>
                <button
                  type="button"
                  className={s.btn}
                  disabled={step === 0}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
                {step < 4 ? (
                  <button
                    type="button"
                    className={s.btnPrimary}
                    onClick={() => setStep(step + 1)}
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    className={s.btnPrimary}
                    onClick={save}
                    disabled={!dirty}
                  >
                    <Save size={15} />
                    Save draft
                  </button>
                )}
              </div>
            </fieldset>
          </div>
          <aside className={q.summary}>
            <p className={s.eyebrow}>Quote summary</p>
            <h2>{d.title || "Your next project"}</h2>
            <p>{d.business || "Select a client or prospect"}</p>
            <dl>
              <dt>BUILD</dt>
              <dd>{gbp(totals.build)}</dd>
              {totals.handover > 0 && (
                <>
                  <dt>Handover</dt>
                  <dd>{gbp(totals.handover)}</dd>
                </>
              )}
              <dt>VAT ({d.vatPct}%)</dt>
              <dd>{gbp(totals.vat)}</dd>
              <dt>One-off total</dt>
              <dd className={q.total}>{gbp(totals.total)}</dd>
            </dl>
            <div className={q.summaryNote}>
              <Check size={16} />
              <span>
                Monthly fees are separate. No payment is taken by saving a quote.
              </span>
            </div>
            <p className={s.muted}>
              Internal cost and margin details stay out of the client preview and printed
              PDF.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function QuotePreview({
  document: d,
  id,
  version,
}: {
  document: QuoteDocument;
  id: string;
  version: number;
}) {
  // Deliberately accepts only the public document, never internal pricing inputs.
  const t = quoteTotals(d, emptyQuote().costs);
  return (
    <article className={q.document} data-quote-document>
      <header>
        <strong>NULLSHIFT</strong>
        <span>
          Draft proposal · v{version}
          <br />
          {id.slice(0, 8).toUpperCase()}
        </span>
      </header>
      <p className={q.kicker}>Custom software. Built around you.</p>
      <h1>{d.title || "Project proposal"}</h1>
      <p>
        Prepared for <strong>{d.business || "Client"}</strong>
        {d.email && <> · {d.email}</>}
      </p>
      {d.validUntil && <p>Valid until {d.validUntil.split("-").reverse().join("/")}</p>}
      <p className={q.prose}>{d.summary}</p>
      <h2>01 / Build</h2>
      <h3>Included scope</h3>
      <p className={q.prose}>{d.included || "To be defined"}</p>
      {d.excluded && (
        <>
          <h3>Not included</h3>
          <p className={q.prose}>{d.excluded}</p>
        </>
      )}
      <h3>Acceptance criteria</h3>
      <p className={q.prose}>{d.acceptance || "To be agreed"}</p>
      <table>
        <thead>
          <tr>
            <th>Deliverable</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.name || "Line item"}</td>
              <td>{l.quantity}</td>
              <td>{gbp(l.unitMinor)}</td>
              <td>{gbp(l.unitMinor * l.quantity)}</td>
            </tr>
          ))}
          {t.handover > 0 && (
            <tr>
              <td>Independent handover / migration</td>
              <td>1</td>
              <td>{gbp(t.handover)}</td>
              <td>{gbp(t.handover)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <dl className={q.documentTotals}>
        <dt>Subtotal</dt>
        <dd>{gbp(t.subtotal)}</dd>
        <dt>VAT ({d.vatPct}%)</dt>
        <dd>{gbp(t.vat)}</dd>
        <dt>One-off total</dt>
        <dd>
          <strong>{gbp(t.total)}</strong>
        </dd>
      </dl>
      <h3>Build payment milestones</h3>
      {t.milestones.map((m, i) => (
        <p key={i}>
          {m.label} — {m.pct}% · {gbp(m.amount)} before VAT
        </p>
      ))}
      {t.handover > 0 && (
        <p>Handover fee payable on handover, separately from the build milestones.</p>
      )}
      <h3>Defect warranty</h3>
      <p>
        {d.warrantyDays} days after launch. A defect is a reproducible failure of an
        existing feature to materially perform functionality previously agreed and
        implemented. Work outside the agreed initial scope is quoted separately.
      </p>
      <h2>02 / After launch</h2>
      {d.route === "managed" ? (
        <>
          <h3>Nullshift Managed Platform</h3>
          <p>
            {d.monthlyMinor === null
              ? "Package and monthly fee to be agreed after build acceptance."
              : `Proposed monthly fee: ${gbp(d.monthlyMinor)}, with applicable VAT treated in the final agreement.`}{" "}
            Billing starts on a date agreed in the contract
            {d.billingDate ? ` (proposed: ${d.billingDate})` : ""}.
          </p>
          <p>
            RUN keeps the existing system operational: agreed hosting, monitoring,
            maintenance, backups and support. It does not include new features or design
            changes. Normal infrastructure usage is included; material usage-related
            third-party cost increases may be charged separately following notice. Routine
            compatibility maintenance is included; substantial third-party redevelopment
            is quoted separately.
          </p>
        </>
      ) : d.route === "independent" ? (
        <p>
          Independent handover for {gbp(d.handoverMinor)} before VAT. No ongoing Nullshift
          management fee. You take responsibility for hosting, providers and ongoing
          operation; third-party charges may continue.
        </p>
      ) : (
        <p>
          The contract will record your choice of Managed Platform or independent
          handover. The route, scope, fees and any monthly billing date must be agreed
          before those services begin.
        </p>
      )}
      <h3>Grow</h3>
      <p>
        New features, design work and additional capabilities are quoted separately.
        Training, content, migration, consulting, onboarding, integrations and rollout are
        chargeable unless expressly included above or in the Order Form.
      </p>
      {d.transactPct !== null && (
        <>
          <h3>Transact</h3>
          <p>
            Proposed Nullshift application fee: {d.transactPct}% of processed payments.
            Stripe or other processor fees are separate. Payment architecture and
            responsibilities will be recorded in the Order Form.
          </p>
        </>
      )}
      <footer>
        This is a draft proposal for discussion, not an accepted contract or invoice.
        Final scope, service route and terms will be confirmed in the Order Form. Nothing
        here changes an existing agreement.
        <br />
        Nullshift Development Ltd · hello@nullshift.co.uk
      </footer>
    </article>
  );
}
