"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { ACCEPTANCE_CONFIRMATIONS } from "@nullshift/content/legal/acceptance";

/**
 * Binding contract acceptance (spec §5).
 *
 * Three rules, and the component exists to enforce them rather than describe
 * them:
 *
 *  · The three confirmations start UNCHECKED. There is no defaultChecked
 *    anywhere in this file, and the submit button stays disabled until all
 *    three are ticked — pre-ticked boxes are not consent, and a client who
 *    clicks straight through has not confirmed they can bind their company.
 *  · Marketing is never bundled in. There is no marketing checkbox here at
 *    all; agreeing to a contract is not agreeing to be emailed.
 *  · The exact terms are downloadable BEFORE signing, not only after. Every
 *    incorporated document is linked above the boxes.
 */

type Result = { ok: boolean; error?: string };

export function AcceptOrderForm({
  action,
  orderFormId,
  clientLegalName,
  documents,
  disabled,
}: {
  action: (prev: Result | null, fd: FormData) => Promise<Result>;
  orderFormId: string;
  clientLegalName: string;
  documents: { label: string; href: string }[];
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState<Result | null, FormData>(
    action,
    null
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allConfirmed = ACCEPTANCE_CONFIRMATIONS.every((c) => checked[c.id]);

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
        style={{
          border: "1px solid color-mix(in oklab, var(--k-accent) 45%, transparent)",
          background: "color-mix(in oklab, var(--k-accent) 8%, transparent)",
          padding: "20px 22px",
        }}
      >
        <span style={{ ...mono, color: "var(--k-accent)" }}>Agreement accepted</span>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.95rem",
            lineHeight: 1.7,
            color: "var(--k-fg)",
            marginTop: 8,
          }}
        >
          Thank you. We&apos;ve recorded exactly what you accepted, including the version
          and content hash of every document, and your copy stays available on this page.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="order_form_id" value={orderFormId} />

      <div>
        <span style={mono}>Read before you sign</span>
        <ul
          className="mt-3 flex flex-col gap-2"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {documents.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.9rem",
                  color: "var(--k-accent)",
                }}
              >
                {d.label} →
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Your name *</span>
          <input name="accepted_by_name" required style={field} />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Your role *</span>
          <input
            name="accepted_by_title"
            required
            placeholder="e.g. Director"
            style={field}
          />
        </label>
        <label>
          <span style={{ ...mono, display: "block", marginBottom: 6 }}>Email *</span>
          <input name="accepted_by_email" type="email" required style={field} />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {ACCEPTANCE_CONFIRMATIONS.map((c) => (
          <label
            key={c.id}
            className="flex items-start gap-3"
            style={{ cursor: "pointer" }}
          >
            <input
              type="checkbox"
              name={
                c.id === "authority"
                  ? "authority"
                  : c.id === "business_purpose"
                    ? "business_purpose"
                    : "terms_read"
              }
              checked={!!checked[c.id]}
              onChange={(e) =>
                setChecked((s) => ({ ...s, [c.id]: e.currentTarget.checked }))
              }
              style={{ marginTop: 3 }}
            />
            <span
              style={{
                fontFamily: T.sans,
                fontSize: "0.92rem",
                lineHeight: 1.6,
                color: "var(--k-fg)",
              }}
            >
              {c.label.replace("{client}", clientLegalName)}
            </span>
          </label>
        ))}
      </div>

      {state && !state.ok && state.error && (
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

      <div>
        <button
          type="submit"
          className="kb kb-primary kb-sm"
          disabled={!allConfirmed || pending || disabled}
        >
          {pending ? "Recording…" : "Accept agreement"}
        </button>
        {!allConfirmed && (
          <span
            style={{
              fontFamily: T.sans,
              fontSize: "0.82rem",
              color: "var(--k-faint)",
              marginLeft: 12,
            }}
          >
            All three confirmations are required.
          </span>
        )}
      </div>
    </form>
  );
}
