"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";

/**
 * Admin authoring of the proposal document + DPA detail fields, with the single
 * "Save documents & DPA details and send" action. The button stays greyed out
 * until everything required is complete — build modules, a care plan, the
 * overview, payment terms, and the DPA processing details. Once the proposal has
 * been sent it switches to "Save changes" (edits without re-sending), so the
 * admin can still correct details for discrepancies. The client provides their
 * own company number / registered address in the portal; those fields here are
 * editable but not required to send.
 */
type Defaults = {
  overview: string;
  paymentTerms: string;
  dpaCountry: string;
  dpaCompanyNumber: string;
  dpaRegisteredAddress: string;
  dpaPersonalData: string;
  dpaSpecialCategory: boolean;
  dpaSpecialCategoryDetail: string;
};

const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  padding: "8px 10px",
  background: T.bg,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  width: "100%",
} as const;

const label = {
  fontFamily: T.mono,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: T.muted,
};

export function ProposalDocsForm({
  action,
  tenantId,
  projectId,
  proposalStatus,
  modulesComplete,
  planSelected,
  defaults,
}: {
  action: (formData: FormData) => void | Promise<void>;
  tenantId: string;
  projectId: string;
  proposalStatus: string;
  modulesComplete: boolean;
  planSelected: boolean;
  defaults: Defaults;
}) {
  const [overview, setOverview] = useState(defaults.overview);
  const [paymentTerms, setPaymentTerms] = useState(defaults.paymentTerms);
  const [country, setCountry] = useState(defaults.dpaCountry || "United Kingdom");
  const [companyNumber, setCompanyNumber] = useState(defaults.dpaCompanyNumber);
  const [registeredAddress, setRegisteredAddress] = useState(
    defaults.dpaRegisteredAddress
  );
  const [personalData, setPersonalData] = useState(defaults.dpaPersonalData);
  const [special, setSpecial] = useState(defaults.dpaSpecialCategory ? "yes" : "no");
  const [specialDetail, setSpecialDetail] = useState(defaults.dpaSpecialCategoryDetail);

  const draft = proposalStatus === "draft";

  // What's still missing (only matters while it's a draft awaiting send).
  const missing: string[] = [];
  if (!modulesComplete) missing.push("at least one build module");
  if (!planSelected) missing.push("a care plan");
  if (!overview.trim()) missing.push("an overview");
  if (!paymentTerms.trim()) missing.push("payment terms");
  if (!personalData.trim()) missing.push("the personal-data types");
  if (special === "yes" && !specialDetail.trim())
    missing.push("the special-category detail");
  const complete = missing.length === 0;
  const canSubmit = draft ? complete : true;

  const ta = (rows: number) =>
    ({
      ...inp,
      height: "auto",
      resize: "vertical" as const,
      minHeight: rows * 18,
    }) as const;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="project_id" value={projectId} />

      <label className="flex flex-col gap-1.5">
        <span style={label}>Overview</span>
        <textarea
          name="overview"
          rows={3}
          value={overview}
          onChange={(e) => setOverview(e.target.value)}
          placeholder="A short summary of the project and approach."
          style={ta(3)}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span style={label}>Payment terms</span>
        <textarea
          name="payment_terms"
          rows={2}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          placeholder="e.g. 50% deposit on acceptance, 50% on completion, due within 14 days."
          style={ta(2)}
        />
      </label>

      <div
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.muted,
          paddingTop: 8,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        DPA — processing details (required)
      </div>
      <label className="flex flex-col gap-1.5">
        <span style={label}>Types of personal data processed</span>
        <textarea
          name="dpa_personal_data"
          rows={2}
          value={personalData}
          onChange={(e) => setPersonalData(e.target.value)}
          placeholder="e.g. names, emails, phone numbers, booking details, payment references."
          style={ta(2)}
        />
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.fg }}>
          Special category data? (e.g. health)
        </span>
        <select
          name="dpa_special_category"
          value={special}
          onChange={(e) => setSpecial(e.target.value)}
          style={{ ...inp, width: 90 }}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>
      {special === "yes" && (
        <label className="flex flex-col gap-1.5">
          <span style={label}>Special category detail</span>
          <textarea
            name="dpa_special_category_detail"
            rows={2}
            value={specialDetail}
            onChange={(e) => setSpecialDetail(e.target.value)}
            placeholder="Which data + category (e.g. health information for a clinic)."
            style={ta(2)}
          />
        </label>
      )}

      <div
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.muted,
          paddingTop: 8,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        DPA — client company details (client fills these; edit if needed)
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span style={label}>Country of registration</span>
          <input
            name="dpa_client_country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={inp}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span style={label}>Company number</span>
          <input
            name="dpa_client_company_number"
            value={companyNumber}
            onChange={(e) => setCompanyNumber(e.target.value)}
            placeholder="From the client"
            style={inp}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span style={label}>Registered address</span>
        <textarea
          name="dpa_client_registered_address"
          rows={2}
          value={registeredAddress}
          onChange={(e) => setRegisteredAddress(e.target.value)}
          placeholder="From the client"
          style={ta(2)}
        />
      </label>

      {draft && !complete && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.8rem",
            color: T.faint,
            lineHeight: 1.5,
          }}
        >
          To send, still needed: {missing.join(", ")}.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          fontFamily: T.mono,
          fontSize: "11px",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          height: 36,
          paddingInline: 16,
          alignSelf: "flex-start",
          background: canSubmit ? T.primary : T.surface2,
          color: canSubmit ? T.primaryFg : T.faint,
          border: canSubmit ? "none" : `1px solid ${T.border}`,
          borderRadius: 6,
          cursor: canSubmit ? "pointer" : "not-allowed",
          opacity: canSubmit ? 1 : 0.7,
        }}
      >
        {draft ? "Save documents & DPA details and send →" : "Save changes"}
      </button>
    </form>
  );
}
