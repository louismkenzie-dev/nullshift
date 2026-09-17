"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PROJECT_BUDGETS,
  PROJECT_TIMINGS,
  londonToday,
  validateProjectEnquiry,
  type ProjectEnquiry,
  type EnquiryErrors,
  type EnquiryField,
} from "@/lib/projectEnquiry";
import styles from "./project.module.css";

const EMPTY: ProjectEnquiry = {
  name: "",
  email: "",
  business: "",
  challenge: "",
  budget: "",
  timing: "",
  preferredDate: "",
  preferredTime: "",
};
const CONTACT_FIELDS = [
  { key: "name", label: "Your name", autocomplete: "name", type: "text", max: 100 },
  { key: "email", label: "Work email", autocomplete: "email", type: "email", max: 254 },
  {
    key: "business",
    label: "Company / organisation",
    autocomplete: "organization",
    type: "text",
    max: 160,
  },
] as const;

export function ProjectEnquiryForm({
  calendarUrl,
  preview,
  contactEmail,
}: {
  calendarUrl: string | null;
  preview: boolean;
  contactEmail: string;
}) {
  const [step, setStep] = useState<"details" | "call" | "received">("details");
  const [values, setValues] = useState<ProjectEnquiry>(EMPTY);
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  const [previewResult, setPreviewResult] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    heading.current?.focus();
  }, [step]);
  const update = (key: EnquiryField, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const fieldError = (key: EnquiryField) =>
    errors[key] ? (
      <span id={`error-${key}`} className={styles.fieldError}>
        {errors[key]}
      </span>
    ) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const checked = validateProjectEnquiry(
      step === "details" ? { ...values, preferredDate: "", preferredTime: "" } : values
    );
    if (!checked.ok) {
      setErrors(checked.errors);
      const first = Object.keys(checked.errors)[0];
      document.getElementById(`enquiry-${first}`)?.focus();
      return;
    }
    setErrors({});
    if (step === "details") {
      setStep("call");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/project-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checked.data,
          website: honeypot.current?.value || "",
          preview,
        }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setErrors(result.errors || {});
        setError(
          result.error ||
            "We couldn’t send your enquiry. Your details are still here—please try again."
        );
        if (
          result.errors &&
          ["name", "email", "business", "challenge", "budget", "timing"].some(
            (key) => result.errors[key]
          )
        )
          setStep("details");
        return;
      }
      setReceiptSent(result.receiptEmailSent === true);
      setPreviewResult(result.preview === true);
      setStep("received");
    } catch {
      setError(
        "We couldn’t confirm submission. Your details are still here—please try again or email us directly."
      );
    } finally {
      setPending(false);
    }
  }

  const stage = step === "details" ? 0 : step === "call" ? 1 : 2;
  return (
    <div className={styles.card}>
      <ol className={styles.progress} aria-label="Enquiry progress">
        {["Your project", "Your conversation", "Next step"].map((label, index) => (
          <li key={label} aria-current={index === stage ? "step" : undefined}>
            <span>0{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {preview && (
        <p className={styles.preview}>
          Local preview only. Nothing will be sent or saved.
        </p>
      )}
      {step !== "received" ? (
        <form onSubmit={submit} aria-busy={pending}>
          <h2 ref={heading} tabIndex={-1}>
            {step === "details"
              ? "What would you like to build?"
              : calendarUrl
                ? "Let’s find a time to talk."
                : "When works for you?"}
          </h2>
          <p className={styles.helper}>
            {step === "details"
              ? "A few details are enough to start. Fields marked optional can wait."
              : calendarUrl
                ? "Send your enquiry, then choose an available slot in our calendar. Your call is only booked once you complete the calendar booking."
                : "Share a preferred day and we’ll confirm a suitable time by email. Or leave these blank and we’ll arrange it together."}
          </p>
          <fieldset disabled={pending} hidden={step !== "details"}>
            {CONTACT_FIELDS.map((field) => (
              <label
                className={styles.field}
                key={field.key}
                htmlFor={`enquiry-${field.key}`}
              >
                {field.label}
                <input
                  id={`enquiry-${field.key}`}
                  name={field.key}
                  type={field.type}
                  autoComplete={field.autocomplete}
                  value={values[field.key]}
                  onChange={(event) => update(field.key, event.target.value)}
                  required={step === "details"}
                  maxLength={field.max}
                  aria-invalid={!!errors[field.key]}
                  aria-describedby={errors[field.key] ? `error-${field.key}` : undefined}
                />
                {fieldError(field.key)}
              </label>
            ))}
            <label className={styles.field} htmlFor="enquiry-challenge">
              What would you like to improve or build?
              <textarea
                id="enquiry-challenge"
                name="challenge"
                rows={4}
                value={values.challenge}
                onChange={(event) => update("challenge", event.target.value)}
                minLength={10}
                maxLength={4000}
                required={step === "details"}
                placeholder="Tell us about the challenge, the people it affects, or the idea you want to bring to life."
                aria-invalid={!!errors.challenge}
                aria-describedby={errors.challenge ? "error-challenge" : undefined}
              />
              {fieldError("challenge")}
            </label>
            <div className={styles.fieldPair}>
              <label className={styles.field} htmlFor="enquiry-budget">
                Budget <span>(optional)</span>
                <select
                  id="enquiry-budget"
                  name="budget"
                  value={values.budget}
                  onChange={(event) => update("budget", event.target.value)}
                  aria-invalid={!!errors.budget}
                  aria-describedby={errors.budget ? "error-budget" : undefined}
                >
                  <option value="">Select if known</option>
                  {PROJECT_BUDGETS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                {fieldError("budget")}
              </label>
              <label className={styles.field} htmlFor="enquiry-timing">
                Timing <span>(optional)</span>
                <select
                  id="enquiry-timing"
                  name="timing"
                  value={values.timing}
                  onChange={(event) => update("timing", event.target.value)}
                  aria-invalid={!!errors.timing}
                  aria-describedby={errors.timing ? "error-timing" : undefined}
                >
                  <option value="">Select if known</option>
                  {PROJECT_TIMINGS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                {fieldError("timing")}
              </label>
            </div>
          </fieldset>
          {step === "call" && (
            <>
              <div className={styles.summary}>
                <span>Your enquiry</span>
                <strong>{values.business}</strong>
                <p>{values.challenge}</p>
              </div>
              {!calendarUrl && (
                <fieldset disabled={pending} className={styles.fieldPair}>
                  <label className={styles.field} htmlFor="enquiry-preferredDate">
                    Preferred day <span>(optional)</span>
                    <input
                      id="enquiry-preferredDate"
                      type="date"
                      name="preferredDate"
                      min={londonToday()}
                      value={values.preferredDate}
                      onChange={(event) => update("preferredDate", event.target.value)}
                      aria-invalid={!!errors.preferredDate}
                      aria-describedby={
                        errors.preferredDate ? "error-preferredDate" : undefined
                      }
                    />
                    {fieldError("preferredDate")}
                  </label>
                  <label className={styles.field} htmlFor="enquiry-preferredTime">
                    Time of day <span>(UK time)</span>
                    <select
                      id="enquiry-preferredTime"
                      name="preferredTime"
                      value={values.preferredTime}
                      onChange={(event) => update("preferredTime", event.target.value)}
                      aria-invalid={!!errors.preferredTime}
                      aria-describedby={
                        errors.preferredTime ? "error-preferredTime" : undefined
                      }
                    >
                      <option value="">No preference</option>
                      <option value="morning">Morning · 9am–12pm</option>
                      <option value="afternoon">Afternoon · 12pm–5pm</option>
                    </select>
                    {fieldError("preferredTime")}
                  </label>
                </fieldset>
              )}
              {!calendarUrl && (
                <p className={styles.helper}>
                  This is a preference, not a confirmed booking. Times are Europe/London.
                </p>
              )}
            </>
          )}
          <div className={styles.trap} aria-hidden="true">
            <label>
              Leave this empty
              <input name="website" ref={honeypot} tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            {step === "call" && (
              <button
                type="button"
                className={styles.back}
                disabled={pending}
                onClick={() => {
                  setError("");
                  setErrors({});
                  setStep("details");
                }}
              >
                ← Back
              </button>
            )}
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending
                ? "Sending…"
                : step === "details"
                  ? "Continue"
                  : preview
                    ? "Preview confirmation"
                    : calendarUrl
                      ? "Send enquiry & choose a time"
                      : "Send project enquiry"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className={styles.privacy}>
            We’ll use these details to respond to your enquiry, not subscribe you to
            marketing. <Link href="/legal/privacy">Privacy notice</Link>.
          </p>
        </form>
      ) : (
        <div className={styles.received}>
          <p className={styles.eyebrow}>
            {previewResult ? "Preview complete" : "Enquiry received"}
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {previewResult ? "This is your next step." : "Your enquiry is with us."}
          </h2>
          <p>
            {previewResult
              ? "In the live flow, your enquiry will reach the Nullshift team here. This preview has not saved your details, sent an email or booked a call."
              : "Thank you. We’ll review what you’ve shared and contact you about the next step."}
          </p>
          {receiptSent && (
            <p className={styles.helper}>
              We’ve also sent an acknowledgement to {values.email}.
            </p>
          )}
          {calendarUrl && !previewResult ? (
            <div className={styles.calendar}>
              <h3>Choose your call time</h3>
              <p className={styles.helper}>
                Complete your booking below. Cal.com will show and send your booking
                confirmation. Your enquiry alone does not reserve a slot.
              </p>
              <iframe
                src={calendarUrl + "?theme=dark"}
                title="Choose a project call time with Nullshift"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
                Calendar not loading? Open it in a new tab ↗
              </a>
            </div>
          ) : (
            <p className={styles.helper}>
              {values.preferredDate
                ? `Preferred day: ${values.preferredDate}${values.preferredTime ? " · " + values.preferredTime : ""} (UK time). `
                : ""}
              No call is booked until a time is confirmed.
            </p>
          )}
          <Link className={styles.back} href="/">
            Back to Nullshift ↗
          </Link>
        </div>
      )}
      <p className={styles.contact}>
        Prefer email? <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
      <noscript>
        <p>
          Please enable JavaScript for the enquiry form, or email us directly using the
          link above. No account is needed.
        </p>
      </noscript>
    </div>
  );
}
