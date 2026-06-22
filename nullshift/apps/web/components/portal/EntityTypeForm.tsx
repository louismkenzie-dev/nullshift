"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { T } from "@nullshift/ui/tokens";

/**
 * The client's Data Processing Agreement declaration — collected from the client
 * (not the admin), since the DPA document ports these details onto it. They
 * declare their business type, the types of personal data they'll collect, and
 * whether any of it is special-category. Limited companies additionally provide
 * their legal company name, number and registered office. Posts to a server
 * action passed in as `action`, which also stamps when they submitted.
 */
export function EntityTypeForm({
  action,
  projectId,
  defaults,
  heading = "Your data processing details",
  submitLabel = "Save details",
}: {
  action: (fd: FormData) => void | Promise<void>;
  projectId: string;
  defaults?: {
    entityType?: string | null;
    companyName?: string | null;
    companyNumber?: string | null;
    registeredAddress?: string | null;
    country?: string | null;
    personalData?: string | null;
    specialCategory?: boolean | null;
    specialCategoryDetail?: string | null;
  };
  heading?: string;
  submitLabel?: string;
}) {
  const [type, setType] = useState(defaults?.entityType ?? "");
  const [companyName, setCompanyName] = useState(defaults?.companyName ?? "");
  const [companyNumber, setCompanyNumber] = useState(defaults?.companyNumber ?? "");
  const [registeredAddress, setRegisteredAddress] = useState(
    defaults?.registeredAddress ?? ""
  );
  const [country, setCountry] = useState(defaults?.country ?? "United Kingdom");
  const [personalData, setPersonalData] = useState(defaults?.personalData ?? "");
  const [special, setSpecial] = useState(defaults?.specialCategory ? "yes" : "no");
  const [specialDetail, setSpecialDetail] = useState(
    defaults?.specialCategoryDetail ?? ""
  );

  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    // If we're inside the proposal's "Edit business details" <details> box,
    // capture it now (before the success card replaces the form) so we can
    // collapse it on save.
    const detailsEl = formEl.closest("details");
    startTransition(async () => {
      try {
        await action(formData);
        setSaved(true);
        setTimeout(() => {
          if (detailsEl) {
            // Edit box: close it + return the (now-hidden) form; the summary
            // above updates from the refresh.
            detailsEl.open = false;
            setSaved(false);
          }
          // Landing gate: keep the confirmation until the refresh lifts the gate
          // (which unmounts this form), so there's no flash of the empty form.
          router.refresh();
        }, 1300);
      } catch {
        setError("We couldn't save your details — please try again.");
      }
    });
  }

  const limited = type === "limited";

  // Required before submit: a type, the data types, special detail if special,
  // and (for limited companies) the company name + number + registered office.
  const complete =
    !!type &&
    !!personalData.trim() &&
    (special === "yes" ? !!specialDetail.trim() : true) &&
    (limited
      ? !!companyName.trim() && !!companyNumber.trim() && !!registeredAddress.trim()
      : true);

  const input = {
    width: "100%",
    fontFamily: T.sans,
    fontSize: "0.9rem",
    padding: "10px 12px",
    background: "var(--k-surface)",
    color: "var(--k-fg)",
    border: "1px solid var(--k-border)",
    borderRadius: 0,
    outline: "none",
  } as const;
  const label = {
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--k-muted)",
  };
  // Emerald focus ring on square inputs (client component → handlers allowed).
  const focusOn = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--k-accent)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.25)";
  };
  const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "var(--k-border)";
    e.currentTarget.style.boxShadow = "none";
  };

  const opt = (value: string, text: string) => {
    const active = type === value;
    return (
      <button
        type="button"
        onClick={() => setType(value)}
        style={{
          flex: "1 1 160px",
          fontFamily: T.mono,
          fontSize: "0.78rem",
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "13px 14px",
          textAlign: "left",
          background: active ? "rgba(16,185,129,0.12)" : "var(--k-surface)",
          color: active ? "var(--k-accent)" : "var(--k-fg)",
          border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
          borderRadius: 0,
          cursor: "pointer",
        }}
      >
        {text}
      </button>
    );
  };

  if (saved) {
    return (
      <div
        className="flex items-center gap-3"
        style={{
          padding: "16px 18px",
          background: "rgba(16,185,129,0.10)",
          border: "1px solid rgba(16,185,129,0.4)",
          borderRadius: 0,
        }}
      >
        <span
          aria-hidden
          style={{ fontFamily: T.mono, color: "var(--k-accent)", fontSize: "1.15rem" }}
        >
          ✓
        </span>
        <div>
          <p
            style={{
              fontFamily: T.sans,
              fontWeight: 700,
              fontSize: "0.95rem",
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              color: "var(--k-fg)",
              margin: 0,
            }}
          >
            Business details saved
          </p>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.82rem",
              color: "var(--k-muted)",
              margin: "2px 0 0",
            }}
          >
            Thanks — that&apos;s everything we need for now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="entity_type" value={type} />

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.95rem",
          color: "var(--k-fg)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "-0.01em",
        }}
      >
        {heading}
      </p>
      <div className="flex gap-2 flex-wrap">
        {opt("limited", "Limited company")}
        {opt("sole_trader", "Sole trader / other")}
      </div>

      {limited && (
        <div className="flex flex-col gap-2" style={{ marginTop: 4 }}>
          <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-muted)" }}>
            As a limited company you&apos;ll sign a Data Processing Agreement — please
            confirm your registered details so we can complete it.
          </p>
          <label className="flex flex-col gap-1.5">
            <span style={label}>Registered company name</span>
            <input
              name="company_name"
              required={limited}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              placeholder="e.g. Acme Health Ltd"
              style={input}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span style={label}>Company number</span>
              <input
                name="company_number"
                required={limited}
                value={companyNumber}
                onChange={(e) => setCompanyNumber(e.target.value)}
                onFocus={focusOn}
                onBlur={focusOff}
                placeholder="e.g. 12345678"
                style={input}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span style={label}>Country of registration</span>
              <input
                name="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onFocus={focusOn}
                onBlur={focusOff}
                placeholder="United Kingdom"
                style={input}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span style={label}>Registered office address</span>
            <textarea
              name="registered_address"
              required={limited}
              rows={2}
              value={registeredAddress}
              onChange={(e) => setRegisteredAddress(e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              placeholder="Registered office address"
              style={{ ...input, resize: "vertical" }}
            />
          </label>
        </div>
      )}

      {type === "sole_trader" && (
        <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-muted)" }}>
          No separate DPA is needed — our standard data-processing terms apply (you accept
          them when you sign the proposal). We just need the data you&apos;ll collect.
        </p>
      )}

      {type && (
        <>
          <label className="flex flex-col gap-1.5" style={{ marginTop: 4 }}>
            <span style={label}>Types of personal data you&apos;ll collect</span>
            <textarea
              name="personal_data"
              required
              rows={2}
              value={personalData}
              onChange={(e) => setPersonalData(e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              placeholder="e.g. patient names, emails, phone numbers, appointment details, payment references"
              style={{ ...input, resize: "vertical" }}
            />
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{ fontFamily: T.sans, fontSize: "0.88rem", color: "var(--k-fg)" }}
            >
              Will you process special-category data? (e.g. health)
            </span>
            <select
              name="special_category"
              value={special}
              onChange={(e) => setSpecial(e.target.value)}
              style={{ ...input, width: 90 }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {special === "yes" && (
            <label className="flex flex-col gap-1.5">
              <span style={label}>Which special-category data + why</span>
              <textarea
                name="special_category_detail"
                required
                rows={2}
                value={specialDetail}
                onChange={(e) => setSpecialDetail(e.target.value)}
                onFocus={focusOn}
                onBlur={focusOff}
                placeholder="e.g. health information needed to deliver clinical care"
                style={{ ...input, resize: "vertical" }}
              />
            </label>
          )}
        </>
      )}

      {error && (
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.danger }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={!complete || pending}
        className="kb kb-primary self-start"
        style={{
          background: complete ? "var(--k-accent)" : "var(--k-surface)",
          color: complete ? "var(--k-on-accent)" : "var(--k-faint)",
          border: complete ? "1px solid transparent" : "1px solid var(--k-border)",
          cursor: complete ? (pending ? "wait" : "pointer") : "not-allowed",
          opacity: pending ? 0.75 : 1,
        }}
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
