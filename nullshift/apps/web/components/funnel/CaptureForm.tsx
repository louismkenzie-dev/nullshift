"use client";

import { useRef, useState } from "react";
import { T } from "@nullshift/ui/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CaptureContact = {
  name: string;
  business: string;
  email: string;
  phone: string;
  website: string; // honeypot
  elapsedMs: number; // time-trap
};

/** Stage 4 — contact capture, shown only after the visitor is invested (post
 *  hold). Name + email required, phone optional. Lightweight bot protection:
 *  a hidden honeypot field + a time-trap (mount timestamp). On submit the
 *  parent persists the lead and reveals the personalised result. */
export function CaptureForm({
  onCapture,
}: {
  onCapture: (c: CaptureContact) => Promise<void>;
}) {
  const mountedAt = useRef(Date.now());
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Required";
    if (!email.trim() || !EMAIL_RE.test(email.trim())) next.email = "Enter a valid email";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    await onCapture({
      name: name.trim(),
      business: business.trim(),
      email: email.trim(),
      phone: phone.trim(),
      website,
      elapsedMs: Date.now() - mountedAt.current,
    });
    // Parent transitions to the result view on resolve; keep the button busy
    // until then so it can't be double-submitted.
  }

  return (
    <div>
      <span
        className="inline-flex items-center gap-2"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: T.primary,
            display: "inline-block",
            boxShadow: `0 0 0 4px ${T.primarySoft}`,
          }}
        />
        Last step
      </span>

      <h1
        className="mt-4"
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "clamp(1.9rem,5.2vw,2.75rem)",
          lineHeight: 1.06,
          letterSpacing: "-0.03em",
          color: T.fg,
        }}
      >
        Your build plan
        <br />
        is ready.
      </h1>
      <p
        className="mt-3 max-w-[46ch]"
        style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.6, color: T.muted }}
      >
        See exactly what we&apos;d build you — itemised and priced — plus a preview of
        your own system. We&apos;ll save it to a link and email you a copy. No spam, ever.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
        {/* Honeypot — visually hidden, off the tab order, ignored by humans */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "-9999px",
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
          <label>
            Company website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <Field label="Your name" error={errors.name}>
          <input
            className={`brief-input${errors.name ? " brief-input-err" : ""}`}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
            }}
            placeholder="Alex Johnson"
          />
        </Field>

        <Field label="Business name" note="optional">
          <input
            className="brief-input"
            type="text"
            autoComplete="organization"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="e.g. Riverside Physio"
          />
        </Field>

        <Field label="Email address" error={errors.email}>
          <input
            className={`brief-input${errors.email ? " brief-input-err" : ""}`}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
            }}
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Phone" note="optional">
          <input
            className="brief-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07… (optional)"
          />
        </Field>

        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex items-center justify-center font-medium disabled:opacity-60"
          style={{
            height: 52,
            background: T.primary,
            color: T.primaryFg,
            borderRadius: T.r.md,
            fontFamily: T.sans,
            fontSize: "0.9375rem",
            fontWeight: 500,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          {busy ? "Revealing…" : "See my recommendation →"}
        </button>

        <p style={{ fontFamily: T.sans, fontSize: "0.75rem", color: T.faint }}>
          🔒 We&apos;ll only use this to send your recommendation and follow up.
          Unsubscribe anytime.
        </p>
      </form>

      {/* No-commitment escape — let them browse the site instead. */}
      <div
        className="mt-7 pt-5 text-center"
        style={{ borderTop: `1px solid ${T.border}` }}
      >
        <a
          href="/"
          style={{
            fontFamily: T.sans,
            fontSize: "0.8125rem",
            color: T.muted,
            textDecoration: "none",
          }}
        >
          Not ready? <span style={{ color: T.fg, fontWeight: 500 }}>Browse the site</span>{" "}
          to see how we work →
        </a>
      </div>
    </div>
  );
}

function Field({
  label,
  note,
  error,
  children,
}: {
  label: string;
  note?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="flex items-center gap-2"
        style={{
          fontFamily: T.sans,
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: T.fg,
        }}
      >
        {label}
        {note && (
          <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>
            ({note})
          </span>
        )}
      </label>
      {children}
      {error && (
        <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.danger }}>
          {error}
        </span>
      )}
    </div>
  );
}
