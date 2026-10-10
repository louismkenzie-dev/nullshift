"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AGENCY_TYPES,
  EMPTY_PARTNER_APPLICATION,
  MODEL_INTERESTS,
  TEAM_SIZES,
  validatePartnerApplication,
  type PartnerApplication,
  type PartnerErrors,
  type PartnerField,
} from "@/lib/partnerApplication";
import styles from "./partners.module.css";

const TEXT_FIELDS: {
  key: PartnerField;
  label: string;
  autocomplete: string;
  type: string;
  max: number;
  optional?: boolean;
  placeholder?: string;
}[] = [
  {
    key: "agencyName",
    label: "Agency or consultancy name",
    autocomplete: "organization",
    type: "text",
    max: 160,
  },
  {
    key: "website",
    label: "Website",
    autocomplete: "url",
    type: "text",
    max: 254,
    optional: true,
    placeholder: "agency.com",
  },
  {
    key: "country",
    label: "Country",
    autocomplete: "country-name",
    type: "text",
    max: 80,
  },
];
const CONTACT_FIELDS: typeof TEXT_FIELDS = [
  {
    key: "contactName",
    label: "Your name",
    autocomplete: "name",
    type: "text",
    max: 100,
  },
  {
    key: "role",
    label: "Your role",
    autocomplete: "organization-title",
    type: "text",
    max: 100,
    optional: true,
  },
  { key: "email", label: "Work email", autocomplete: "email", type: "email", max: 254 },
];

export function PartnerApplicationForm({
  preview,
  contactEmail,
}: {
  preview: boolean;
  contactEmail: string;
}) {
  const [step, setStep] = useState<"form" | "received">("form");
  const [values, setValues] = useState<PartnerApplication>(EMPTY_PARTNER_APPLICATION);
  const [errors, setErrors] = useState<PartnerErrors>({});
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

  const update = (key: PartnerField, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const fieldError = (key: PartnerField) =>
    errors[key] ? (
      <span id={`error-${key}`} className={styles.fieldError}>
        {errors[key]}
      </span>
    ) : null;
  const aria = (key: PartnerField) => ({
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `error-${key}` : undefined,
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const checked = validatePartnerApplication(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      const first = Object.keys(checked.errors)[0];
      document.getElementById(`partner-${first}`)?.focus();
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const response = await fetch("/api/partner-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checked.data,
          company_url: honeypot.current?.value || "",
          preview,
        }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setErrors(result.errors || {});
        setError(
          result.error ||
            "We couldn’t send your application. Your details are still here — please try again."
        );
        return;
      }
      setReceiptSent(result.receiptEmailSent === true);
      setPreviewResult(result.preview === true);
      setStep("received");
    } catch {
      setError(
        "We couldn’t confirm submission. Your details are still here — please try again or email us directly."
      );
    } finally {
      setPending(false);
    }
  }

  const renderText = (field: (typeof TEXT_FIELDS)[number]) => (
    <label className={styles.field} key={field.key} htmlFor={`partner-${field.key}`}>
      {field.label}
      {field.optional && <span> (optional)</span>}
      <input
        id={`partner-${field.key}`}
        name={field.key}
        type={field.type}
        autoComplete={field.autocomplete}
        value={values[field.key]}
        onChange={(event) => update(field.key, event.target.value)}
        required={!field.optional}
        maxLength={field.max}
        placeholder={field.placeholder}
        {...aria(field.key)}
      />
      {fieldError(field.key)}
    </label>
  );

  return (
    <div className={styles.card} id="apply-form">
      {preview && (
        <p className={styles.preview}>
          Local preview only. Nothing will be sent or saved.
        </p>
      )}
      {step === "form" ? (
        <form onSubmit={submit} aria-busy={pending} noValidate>
          <h2 ref={heading} tabIndex={-1}>
            Apply to the programme.
          </h2>
          <p className={styles.helper}>
            Five minutes, no deck required. We reply within two working days, and every
            application goes through our acceptance review before anything is agreed.
          </p>
          <fieldset disabled={pending}>
            <span className={styles.legend}>Your agency</span>
            {TEXT_FIELDS.map(renderText)}
            <div className={styles.fieldPair}>
              <label className={styles.field} htmlFor="partner-agencyType">
                What kind of business
                <select
                  id="partner-agencyType"
                  name="agencyType"
                  value={values.agencyType}
                  onChange={(event) => update("agencyType", event.target.value)}
                  required
                  {...aria("agencyType")}
                >
                  <option value="">Choose the closest match</option>
                  {AGENCY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {fieldError("agencyType")}
              </label>
              <label className={styles.field} htmlFor="partner-teamSize">
                Team size
                <select
                  id="partner-teamSize"
                  name="teamSize"
                  value={values.teamSize}
                  onChange={(event) => update("teamSize", event.target.value)}
                  required
                  {...aria("teamSize")}
                >
                  <option value="">Select</option>
                  {TEAM_SIZES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {fieldError("teamSize")}
              </label>
            </div>

            <span className={styles.legend}>You</span>
            {CONTACT_FIELDS.map(renderText)}

            <span className={styles.legend}>How you want to work with us</span>
            <label className={styles.field} htmlFor="partner-modelInterest">
              Model
              <select
                id="partner-modelInterest"
                name="modelInterest"
                value={values.modelInterest}
                onChange={(event) => update("modelInterest", event.target.value)}
                required
                {...aria("modelInterest")}
              >
                <option value="">Select</option>
                {MODEL_INTERESTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {fieldError("modelInterest")}
            </label>
            <label className={styles.field} htmlFor="partner-clientTypes">
              Who your clients typically are <span>(optional)</span>
              <input
                id="partner-clientTypes"
                name="clientTypes"
                type="text"
                value={values.clientTypes}
                onChange={(event) => update("clientTypes", event.target.value)}
                maxLength={500}
                placeholder="e.g. Trades firms, clinics, e-commerce brands under £5m"
                {...aria("clientTypes")}
              />
              {fieldError("clientTypes")}
            </label>
            <label className={styles.field} htmlFor="partner-message">
              Anything else <span>(optional)</span>
              <textarea
                id="partner-message"
                name="message"
                rows={4}
                value={values.message}
                onChange={(event) => update("message", event.target.value)}
                maxLength={4000}
                placeholder="A client you have in mind, what you sell today, or what you’d want from us."
                {...aria("message")}
              />
              {fieldError("message")}
            </label>
          </fieldset>
          <div className={styles.trap} aria-hidden="true">
            <label>
              Leave this empty
              <input name="company_url" ref={honeypot} tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending
                ? "Sending…"
                : preview
                  ? "Preview confirmation"
                  : "Send application"}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className={styles.privacy}>
            We’ll use these details to assess and reply to your application, not to
            subscribe you to marketing. <Link href="/legal/privacy">Privacy notice</Link>{" "}
            · <Link href="/legal/partner-agreement">Partner agreement</Link>.
          </p>
        </form>
      ) : (
        <div className={styles.received}>
          <p className={styles.eyebrow}>
            {previewResult ? "Preview complete" : "Application received"}
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {previewResult
              ? "This is what applicants see."
              : "Your application is with us."}
          </h2>
          <p>
            {previewResult
              ? "In the live flow, your application reaches the Nullshift team here. This preview has not saved your details or sent an email."
              : "Thank you. We read every application ourselves and will reply within two working days, usually to set up a short call. Nothing is agreed until the acceptance review is done."}
          </p>
          {receiptSent && (
            <p className={styles.helper}>
              We’ve also sent an acknowledgement to {values.email}.
            </p>
          )}
          <Link className={styles.back} href="/client-stories">
            Read the client stories while you wait ↗
          </Link>
        </div>
      )}
      <p className={styles.contact}>
        Prefer email? <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      </p>
      <noscript>
        <p>Please enable JavaScript for the application form, or email us directly.</p>
      </noscript>
    </div>
  );
}
