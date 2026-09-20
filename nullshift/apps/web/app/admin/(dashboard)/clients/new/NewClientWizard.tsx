"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from "lucide-react";
import {
  type NewClientInput,
  type NewClientResult,
  validateNewClient,
} from "@/lib/next/live-model";
import { createWorkspace } from "./actions";
import s from "../../shell.module.css";

const STEPS = ["Company", "Project", "After launch", "Review"];
const ROUTES = [
  {
    value: "undecided",
    title: "Discuss it with the client",
    detail: "Record the preference now; agree the service route in the contract.",
  },
  {
    value: "managed",
    title: "Managed by Nullshift",
    detail:
      "Choose the package after build acceptance. Monthly billing starts on the date agreed in the contract.",
  },
  {
    value: "handover",
    title: "Independent handover",
    detail:
      "£600 handover / migration guidance. Confirm scope and tax treatment in the quote. No ongoing Nullshift management fee; third-party costs remain the client’s responsibility.",
  },
] as const;

export function NewClientWizard({
  draftId,
  projectId,
  owner,
  enabled,
}: {
  draftId: string;
  projectId: string;
  owner: string;
  enabled: boolean;
}) {
  const blank: NewClientInput = {
    draftId,
    projectId,
    owner,
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    projectName: "",
    brief: "",
    serviceRoute: "undecided",
  };
  const [input, setInput] = useState<NewClientInput>(blank);
  const [step, setStep] = useState(0);
  const [practice, setPractice] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<NewClientResult | null>(null);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submissionLock = useRef(false);
  useEffect(() => {
    if (step > 0) heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function update(key: keyof NewClientInput, value: string) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setError("");
    setResult(null);
    setConfirmed(false);
  }
  function startPractice() {
    setPractice(true);
    setStep(0);
    setError("");
    setConfirmed(false);
    setResult(null);
    setInput({
      ...blank,
      businessName: "Example Studio (practice)",
      contactName: "Alex Example",
      email: "alex@example.com",
      projectName: "Bookings & member portal",
      brief:
        "Bring bookings, customer communication and payments into one simple system.",
      serviceRoute: "managed",
    });
    heading.current?.focus();
  }
  function reset() {
    setPractice(false);
    setStep(0);
    setInput(blank);
    setError("");
    setResult(null);
    setConfirmed(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submissionLock.current) return;
    if (step < 3) {
      setStep(step + 1);
      setError("");
      return;
    }
    const invalid = validateNewClient(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!confirmed) {
      setError("Please confirm what will be saved before continuing.");
      return;
    }
    if (practice) {
      setResult({ ok: true });
      return;
    }
    if (!enabled) {
      setError(
        "Creating real clients is disabled here. You can still try the walkthrough."
      );
      return;
    }
    submissionLock.current = true;
    setPending(true);
    setError("");
    try {
      const saved = await createWorkspace(input);
      setResult(saved);
      if (!saved.ok) setError(saved.error ?? "The workspace could not be saved.");
    } catch {
      setError(
        "We could not confirm the save. Your entries are still here. Retry this same draft to avoid duplicates, or check Clients."
      );
    } finally {
      setPending(false);
      submissionLock.current = false;
    }
  }
  function field(
    key: keyof NewClientInput,
    label: string,
    options: {
      required?: boolean;
      type?: string;
      max?: number;
      placeholder?: string;
      autoComplete?: string;
    } = {}
  ) {
    return (
      <label className={s.formField} key={key}>
        <span>
          {label}
          {!options.required && <small> Optional</small>}
        </span>
        <input
          className={s.formInput}
          name={key}
          type={options.type ?? "text"}
          value={input[key]}
          onChange={(e) => update(key, e.target.value)}
          required={options.required}
          maxLength={options.max ?? 160}
          placeholder={options.placeholder}
          autoComplete={options.autoComplete}
        />
      </label>
    );
  }

  if (result?.ok)
    return (
      <section className={s.successPanel} role="status">
        <CheckCircle2 size={36} strokeWidth={1.5} />
        <p className={s.eyebrow}>
          {practice ? "Walkthrough complete" : "A clear starting point"}
        </p>
        <h2>
          {practice
            ? "That’s how a client starts."
            : result.projectPending
              ? "Client saved. Project needs attention."
              : "Their workspace is ready."}
        </h2>
        <p>
          {practice
            ? "No records were created. In the real flow, this saves the client and an initial discovery project, ready for a scoped quote."
            : result.projectPending
              ? "The client was saved, but we could not confirm their project. Retry this same draft to finish it safely."
              : "You have a client record and a discovery project. Next: confirm the brief, prepare the quote and agree the contract."}
        </p>
        <p>No invitation, contract, invoice or payment has been sent.</p>
        <div className={s.actions}>
          {practice ? (
            <button className={s.btnPrimary} onClick={reset}>
              Start a real client <ArrowRight size={16} />
            </button>
          ) : (
            <Link
              className={s.btnPrimary}
              href={`/admin/next/clients/${result.clientId}`}
            >
              Open client workspace <ArrowRight size={16} />
            </Link>
          )}
          {result.projectPending && (
            <button
              className={s.btnGhost}
              onClick={() => {
                setResult(null);
                setStep(3);
              }}
            >
              Retry project setup
            </button>
          )}
          <Link className={s.btnGhost} href="/admin/next/clients">
            All clients
          </Link>
        </div>
      </section>
    );

  return (
    <div className={s.wizard}>
      <form className={s.wizardMain} onSubmit={submit} aria-label="New client onboarding">
        <ol className={s.wizardSteps} aria-label="Onboarding steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={[s.wizardStep, step === index ? s.wizardStepActive : ""].join(
                " "
              )}
              aria-current={step === index ? "step" : undefined}
            >
              <span className={s.stepNumber}>
                {index < step ? <Check size={13} /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <div className={s.wizardBody}>
          {practice && (
            <p className={s.quietNotice}>
              Practice mode · Fictional details · Nothing will be saved.
            </p>
          )}
          <h2 ref={heading} tabIndex={-1}>
            {
              [
                "Who are we building for?",
                "What are we creating?",
                "What happens after launch?",
                "A moment to check.",
              ][step]
            }
          </h2>
          <p className={s.wizardIntro}>
            {
              [
                "Add the business and the person you’ll work with. This does not invite them to the portal.",
                "Give the project a starting point. You can develop the full scope with the client.",
                "Capture a preference, not a commitment. No package, subscription or billing date is set here.",
                "This creates internal records only. Every client-facing or financial action stays separate.",
              ][step]
            }
          </p>
          {error && (
            <div ref={errorRef} tabIndex={-1} role="alert" className={s.formError}>
              {error}
              {result?.duplicateId && (
                <Link
                  className={s.subtleLink}
                  href={`/admin/next/clients/${result.duplicateId}`}
                >
                  Open existing client <ArrowRight size={14} />
                </Link>
              )}
            </div>
          )}
          {step === 0 && (
            <div className={s.formGrid}>
              {field("businessName", "Business name", {
                required: true,
                autoComplete: "organization",
                placeholder: "Company or trading name",
              })}
              {field("contactName", "Main contact", {
                required: true,
                autoComplete: "name",
                max: 120,
              })}
              {field("email", "Contact email", {
                required: true,
                type: "email",
                autoComplete: "email",
                max: 254,
              })}
              {field("phone", "Phone number", {
                type: "tel",
                autoComplete: "tel",
                max: 60,
              })}
            </div>
          )}
          {step === 1 && (
            <div className={s.formGrid}>
              {field("projectName", "Project name", {
                required: true,
                placeholder: "e.g. Booking & operations platform",
              })}
              {field("owner", "Nullshift owner", { max: 120 })}
              <label className={s.formFieldWide}>
                <span>
                  What should this solve? <small>Optional</small>
                </span>
                <textarea
                  className={s.formInput}
                  name="brief"
                  rows={5}
                  maxLength={4000}
                  value={input.brief}
                  onChange={(e) => update("brief", e.target.value)}
                  placeholder="The problem, the people who use it, and what a good outcome looks like."
                />
                <span className={s.formHelp}>
                  An initial brief — not the agreed build scope or a quote.
                </span>
              </label>
            </div>
          )}
          {step === 2 && (
            <fieldset className={s.routeOptions}>
              <legend className={s.srOnly}>Service preference</legend>
              {ROUTES.map((route) => (
                <label className={s.routeOption} key={route.value}>
                  <input
                    type="radio"
                    name="serviceRoute"
                    value={route.value}
                    checked={input.serviceRoute === route.value}
                    onChange={() => update("serviceRoute", route.value)}
                  />
                  <span>
                    <strong>{route.title}</strong>
                    <small>{route.detail}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {step === 3 && (
            <>
              <dl className={s.reviewGrid}>
                <div>
                  <dt>Business</dt>
                  <dd>{input.businessName}</dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {input.contactName}
                    <br />
                    {input.email}
                    {input.phone && (
                      <>
                        <br />
                        {input.phone}
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Initial project</dt>
                  <dd>{input.projectName}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{input.owner || "Not assigned"}</dd>
                </div>
                <div>
                  <dt>After launch</dt>
                  <dd>
                    {ROUTES.find((r) => r.value === input.serviceRoute)?.title}
                    <small>Preference only. Confirm in the contract.</small>
                  </dd>
                </div>
                <div>
                  <dt>Initial brief</dt>
                  <dd>{input.brief || "To discuss with the client"}</dd>
                </div>
              </dl>
              <label className={s.confirmation}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  {practice
                    ? "I understand this is a practice walkthrough and nothing will be saved."
                    : "Create the client and discovery project in our existing database. Do not send anything or set up billing."}
                </span>
              </label>
            </>
          )}
        </div>
        <div className={s.wizardFoot}>
          {step > 0 ? (
            <button
              type="button"
              className={s.btnGhost}
              disabled={pending}
              onClick={() => {
                setStep(step - 1);
                setError("");
              }}
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <Link className={s.btnGhost} href="/admin/next/clients">
              Cancel
            </Link>
          )}
          <button
            className={s.btnPrimary}
            type="submit"
            disabled={pending || (step === 3 && (!confirmed || (!enabled && !practice)))}
          >
            {pending
              ? "Saving…"
              : step < 3
                ? "Continue"
                : practice
                  ? "Finish walkthrough"
                  : "Create client workspace"}
            {!pending && <ArrowRight size={16} />}
          </button>
        </div>
      </form>
      <aside className={s.wizardAside}>
        <p className={s.eyebrow}>One step at a time</p>
        <h3>A workspace, not a commitment.</h3>
        <p>
          Start with the client and their project. Then work through the decisions in
          order.
        </p>
        <ol>
          <li>Confirm the brief and scope</li>
          <li>Prepare a pricing proposal</li>
          <li>Agree and sign the contract</li>
          <li>Deliver and get acceptance</li>
          <li>Activate the agreed service route</li>
        </ol>
        <p>Existing client agreements and prices are unchanged.</p>
        {!practice && (
          <button type="button" className={s.practiceButton} onClick={startPractice}>
            Try a practice walkthrough <ArrowRight size={14} />
          </button>
        )}
        {!enabled && (
          <p className={s.formHelp}>
            Real-client creation is disabled in this environment.
          </p>
        )}
      </aside>
    </div>
  );
}
