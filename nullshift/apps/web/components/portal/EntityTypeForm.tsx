"use client";

import { useState } from "react";
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
    background: T.bg,
    color: T.fg,
    border: `1px solid ${T.border}`,
    borderRadius: T.r.sm,
    outline: "none",
  } as const;
  const label = {
    fontFamily: T.mono,
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: T.muted,
  };

  const opt = (value: string, text: string) => {
    const active = type === value;
    return (
      <button
        type="button"
        onClick={() => setType(value)}
        style={{
          flex: "1 1 160px",
          fontFamily: T.sans,
          fontSize: "0.9rem",
          fontWeight: 600,
          padding: "12px 14px",
          textAlign: "left",
          background: active ? `${T.primary}1a` : T.bg,
          color: active ? T.primary : T.fg,
          border: `1px solid ${active ? T.primary : T.border}`,
          borderRadius: T.r.md,
          cursor: "pointer",
        }}
      >
        {text}
      </button>
    );
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="entity_type" value={type} />

      <p
        style={{ fontFamily: T.sans, fontSize: "0.95rem", color: T.fg, fontWeight: 600 }}
      >
        {heading}
      </p>
      <div className="flex gap-2 flex-wrap">
        {opt("limited", "Limited company")}
        {opt("sole_trader", "Sole trader / other")}
      </div>

      {limited && (
        <div className="flex flex-col gap-2" style={{ marginTop: 4 }}>
          <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
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
              placeholder="Registered office address"
              style={{ ...input, resize: "vertical" }}
            />
          </label>
        </div>
      )}

      {type === "sole_trader" && (
        <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
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
              placeholder="e.g. patient names, emails, phone numbers, appointment details, payment references"
              style={{ ...input, resize: "vertical" }}
            />
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.fg }}>
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
                placeholder="e.g. health information needed to deliver clinical care"
                style={{ ...input, resize: "vertical" }}
              />
            </label>
          )}
        </>
      )}

      <button
        type="submit"
        disabled={!complete}
        className="self-start"
        style={{
          fontFamily: T.sans,
          fontWeight: 600,
          fontSize: "0.9rem",
          height: 44,
          paddingInline: 22,
          background: complete ? T.primary : T.surface2,
          color: complete ? T.primaryFg : T.faint,
          border: complete ? "none" : `1px solid ${T.border}`,
          borderRadius: T.r.md,
          cursor: complete ? "pointer" : "not-allowed",
        }}
      >
        {submitLabel}
      </button>
    </form>
  );
}
