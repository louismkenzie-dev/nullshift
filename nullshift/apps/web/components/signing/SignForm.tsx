"use client";

import { useActionState, useState } from "react";
import { T } from "@nullshift/ui/tokens";
import { SIGNING_CONSENTS, type ConsentId } from "@/lib/signing/model";
import { SIGNATURE_FONT } from "@/lib/signing/format";

/**
 * The signature block (migration 0068). Three rules it exists to enforce:
 *
 *  · All four confirmations start UNCHECKED and the button stays disabled
 *    until every one is ticked. Pre-ticked boxes are not consent.
 *  · The signature is the signer's typed full name, shown back to them in a
 *    script face as they type so "adopting" it is a deliberate act — the
 *    same mechanism DocuSign defaults to. We do not ask for a drawn
 *    squiggle: it adds nothing evidentially and a lot of friction on a phone.
 *  · Declining is a first-class action with a reason, never a dead end.
 */

export type SignResult = { ok: boolean; error?: string; certificateUrl?: string };

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.64rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const field: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.95rem",
  color: "var(--k-fg)",
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "11px 12px",
  width: "100%",
};

export function SignForm({
  signAction,
  declineAction,
  credential,
  signerName,
  signerRole,
  clientName,
  disabled,
}: {
  signAction: (prev: SignResult | null, fd: FormData) => Promise<SignResult>;
  declineAction: (prev: SignResult | null, fd: FormData) => Promise<SignResult>;
  /** Hidden fields identifying the request: a link token or a request id. */
  credential: { token: string } | { requestId: string };
  signerName: string;
  signerRole: string | null;
  clientName: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<SignResult | null, FormData>(signAction, null);
  const [declineState, declineFormAction, declinePending] = useActionState<SignResult | null, FormData>(
    declineAction,
    null
  );
  const [name, setName] = useState(signerName);
  const [checked, setChecked] = useState<Partial<Record<ConsentId, boolean>>>({});
  const [declining, setDeclining] = useState(false);
  const allConfirmed = SIGNING_CONSENTS.every((c) => checked[c.id]);

  const hidden =
    "token" in credential ? (
      <input type="hidden" name="token" value={credential.token} />
    ) : (
      <input type="hidden" name="request_id" value={credential.requestId} />
    );

  if (state?.ok) {
    return (
      <div
        style={{
          border: "1px solid color-mix(in oklab, var(--k-accent) 45%, transparent)",
          background: "color-mix(in oklab, var(--k-accent) 8%, transparent)",
          padding: "22px 24px",
        }}
      >
        <span style={{ ...mono, color: "var(--k-accent)" }}>Signed — thank you</span>
        <p style={{ fontFamily: T.sans, fontSize: "0.98rem", lineHeight: 1.7, color: "var(--k-fg)", marginTop: 8 }}>
          Your signature has been recorded with the time, the document fingerprint and the
          confirmations you gave. Nullshift will countersign and you will receive the completed
          copy by email.
        </p>
        {state.certificateUrl && (
          <a href={state.certificateUrl} className="kb kb-outline kb-sm" style={{ display: "inline-flex", marginTop: 14 }}>
            Download your signed copy (PDF) ↓
          </a>
        )}
      </div>
    );
  }

  if (declineState?.ok) {
    return (
      <div style={{ border: "1px solid var(--k-border)", padding: "22px 24px" }}>
        <span style={mono}>Declined</span>
        <p style={{ fontFamily: T.sans, fontSize: "0.98rem", lineHeight: 1.7, color: "var(--k-fg)", marginTop: 8 }}>
          We have let Nullshift know. Nothing has been agreed. If you would like a revised version,
          just reply to the email you were sent.
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--k-border)", background: "var(--k-surface)", padding: "clamp(18px, 3vw, 30px)" }}>
      <form action={formAction} className="flex flex-col gap-5">
        {hidden}
        <div>
          <span style={{ ...mono, color: "var(--k-fg)" }}>Sign for {clientName}</span>
          <p style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.65, color: "var(--k-muted)", marginTop: 6 }}>
            Type your full legal name — that is your signature. Tick each confirmation, then sign.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label>
            <span style={{ ...mono, display: "block", marginBottom: 6 }}>Your full name *</span>
            <input
              name="signer_name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              style={field}
            />
          </label>
          <label>
            <span style={{ ...mono, display: "block", marginBottom: 6 }}>Your role *</span>
            <input
              name="signer_role"
              required
              defaultValue={signerRole ?? ""}
              placeholder="e.g. Director, Head of Performance"
              autoComplete="organization-title"
              style={field}
            />
          </label>
        </div>

        {/* The adopted signature, drawn as they type */}
        <div>
          <span style={{ ...mono, display: "block", marginBottom: 8 }}>Your signature</span>
          <div
            aria-live="polite"
            style={{
              minHeight: 64,
              borderBottom: "1px solid var(--k-border-strong)",
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: 8,
            }}
          >
            <span style={{ fontFamily: SIGNATURE_FONT, fontSize: "2.1rem", lineHeight: 1, color: name.trim() ? "var(--k-fg)" : "var(--k-faint)" }}>
              {name.trim() || "Your name appears here"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {SIGNING_CONSENTS.map((c) => (
            <label key={c.id} className="flex items-start gap-3" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                name={`consent_${c.id}`}
                checked={!!checked[c.id]}
                onChange={(e) => setChecked((s) => ({ ...s, [c.id]: e.currentTarget.checked }))}
                style={{ marginTop: 4 }}
              />
              <span style={{ fontFamily: T.sans, fontSize: "0.92rem", lineHeight: 1.6, color: "var(--k-fg)" }}>
                {c.label.replace("{client}", clientName)}
              </span>
            </label>
          ))}
        </div>

        {state && !state.ok && state.error && (
          <p style={{ fontFamily: T.mono, fontSize: "0.72rem", letterSpacing: "0.04em", color: T.danger }}>{state.error}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="kb kb-primary" disabled={!allConfirmed || !name.trim() || pending || disabled}>
            {pending ? "Recording your signature…" : "Sign this document"}
          </button>
          {!allConfirmed && (
            <span style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)" }}>
              All four confirmations are required.
            </span>
          )}
          <button
            type="button"
            onClick={() => setDeclining((v) => !v)}
            disabled={disabled}
            style={{ fontFamily: T.mono, fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--k-muted)", background: "none", border: "none", cursor: "pointer", marginLeft: "auto" }}
          >
            {declining ? "Cancel" : "Decline instead"}
          </button>
        </div>
      </form>

      {declining && (
        <form action={declineFormAction} className="flex flex-col gap-3" style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--k-border)" }}>
          {hidden}
          <label>
            <span style={{ ...mono, display: "block", marginBottom: 6 }}>Why are you declining? (optional, goes to Nullshift)</span>
            <textarea name="reason" rows={3} style={{ ...field, resize: "vertical" }} />
          </label>
          {declineState && !declineState.ok && declineState.error && (
            <p style={{ fontFamily: T.mono, fontSize: "0.72rem", color: T.danger }}>{declineState.error}</p>
          )}
          <div>
            <button type="submit" className="kb kb-outline kb-sm" disabled={declinePending || disabled}>
              {declinePending ? "Sending…" : "Decline this document"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
