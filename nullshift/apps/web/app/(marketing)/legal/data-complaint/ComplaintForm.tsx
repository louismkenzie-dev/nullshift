"use client";

import { useActionState } from "react";
import { T } from "@nullshift/ui/tokens";
import { submitDataComplaint, type ComplaintResult } from "./actions";

/**
 * The electronic complaint route (spec §11). Deliberately short: a complaints
 * form that interrogates the complainant is a complaints form people abandon.
 * On success the case reference is shown on screen, so they always leave with
 * evidence they complained even if the acknowledgement email fails.
 */
export function ComplaintForm({ privacyEmail }: { privacyEmail: string }) {
  const [state, action, pending] = useActionState<ComplaintResult | null, FormData>(
    submitDataComplaint,
    null
  );

  const label: React.CSSProperties = {
    fontFamily: T.mono,
    fontSize: "0.66rem",
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--k-muted)",
    display: "block",
    marginBottom: 6,
  };
  const field: React.CSSProperties = {
    fontFamily: T.sans,
    fontSize: "0.92rem",
    color: "var(--k-fg)",
    background: "var(--k-bg)",
    border: "1px solid var(--k-border)",
    borderRadius: 0,
    padding: "10px 12px",
    width: "100%",
  };

  if (state?.ok) {
    return (
      <div
        className="mt-8"
        style={{
          border: "1px solid color-mix(in oklab, var(--k-accent) 45%, transparent)",
          background: "color-mix(in oklab, var(--k-accent) 8%, transparent)",
          padding: "22px 24px",
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.68rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-accent)",
          }}
        >
          Complaint received
        </span>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "1.05rem",
            color: "var(--k-fg)",
            marginTop: 10,
          }}
        >
          Your case reference is <strong>{state.caseRef}</strong>. Please keep it.
        </p>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.9rem",
            lineHeight: 1.7,
            color: "var(--k-muted)",
            marginTop: 10,
          }}
        >
          {state.acknowledged
            ? "We've emailed you an acknowledgement. We'll investigate and respond without undue delay, and tell you the outcome."
            : `We've logged your complaint. We couldn't send the acknowledgement email automatically — if you don't hear from us shortly, email ${privacyEmail} quoting your case reference.`}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label>
          <span style={label}>Your name *</span>
          <input name="name" required style={field} />
        </label>
        <label>
          <span style={label}>Email *</span>
          <input name="email" type="email" required style={field} />
        </label>
      </div>

      <label>
        <span style={label}>Your relationship to us</span>
        <select name="relationship" defaultValue="" style={{ ...field, height: 42 }}>
          <option value="">Select…</option>
          <option value="client">I&apos;m a Nullshift client</option>
          <option value="client_customer">
            I&apos;m a customer of a Nullshift client
          </option>
          <option value="website_visitor">I visited the Nullshift website</option>
          <option value="job_applicant">I applied for a role</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label>
        <span style={label}>What has happened? *</span>
        <textarea
          name="nature"
          required
          rows={7}
          placeholder="Tell us what you're complaining about, in your own words."
          style={{ ...field, resize: "vertical", lineHeight: 1.6 }}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label>
          <span style={label}>Relevant dates (optional)</span>
          <input name="relevant_dates" style={field} />
        </label>
        <label>
          <span style={label}>Business or system involved (optional)</span>
          <input name="related_client" style={field} />
        </label>
      </div>

      {state && !state.ok && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "0.72rem",
            letterSpacing: "0.04em",
            color: T.danger,
          }}
        >
          {state.error}
        </p>
      )}

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.82rem",
          lineHeight: 1.65,
          color: "var(--k-faint)",
        }}
      >
        We use what you send here to investigate and respond to your complaint, and to
        keep a record of it. We acknowledge complaints within 30 days of receipt and
        respond without undue delay.
      </p>

      <div>
        <button type="submit" disabled={pending} className="kb kb-primary">
          {pending ? "Sending…" : "Submit complaint"}
          {!pending && (
            <span className="k-arrow" aria-hidden>
              →
            </span>
          )}
        </button>
      </div>
    </form>
  );
}
