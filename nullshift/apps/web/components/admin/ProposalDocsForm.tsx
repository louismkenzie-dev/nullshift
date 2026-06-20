"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";

/**
 * Admin authoring of the proposal document (overview + payment terms) plus the
 * single "Save documents & DPA details and send" action. The DPA details
 * themselves are provided by the CLIENT in their portal — here the admin sees
 * the status of that, a read-only summary, and can correct the company details
 * for discrepancies. The send button stays greyed until everything required is
 * complete: build modules, a care plan, the overview, payment terms, AND the
 * client has submitted their DPA details. Once sent it switches to "Save
 * changes" (edits without re-sending).
 */
type Defaults = {
  overview: string;
  paymentTerms: string;
  companyName: string;
  companyNumber: string;
  registeredAddress: string;
  country: string;
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
const lbl = {
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
  clientDpaReady,
  clientSubmittedAt,
  entityType,
  personalData,
  specialCategory,
  specialCategoryDetail,
  defaults,
}: {
  action: (formData: FormData) => void | Promise<void>;
  tenantId: string;
  projectId: string;
  proposalStatus: string;
  modulesComplete: boolean;
  planSelected: boolean;
  clientDpaReady: boolean;
  clientSubmittedAt: string | null;
  entityType: string | null;
  personalData: string | null;
  specialCategory: boolean | null;
  specialCategoryDetail: string | null;
  defaults: Defaults;
}) {
  const [overview, setOverview] = useState(defaults.overview);
  const [paymentTerms, setPaymentTerms] = useState(defaults.paymentTerms);
  const [companyName, setCompanyName] = useState(defaults.companyName);
  const [companyNumber, setCompanyNumber] = useState(defaults.companyNumber);
  const [registeredAddress, setRegisteredAddress] = useState(defaults.registeredAddress);
  const [country, setCountry] = useState(defaults.country || "United Kingdom");

  const draft = proposalStatus === "draft";
  const limited = entityType === "limited";

  const missing: string[] = [];
  if (!modulesComplete) missing.push("at least one build module");
  if (!planSelected) missing.push("a care plan");
  if (!overview.trim()) missing.push("an overview");
  if (!paymentTerms.trim()) missing.push("payment terms");
  if (!clientDpaReady) missing.push("the client's DPA details (they fill these in)");
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
        <span style={lbl}>Overview</span>
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
        <span style={lbl}>Payment terms</span>
        <textarea
          name="payment_terms"
          rows={2}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          placeholder="e.g. 50% deposit on acceptance, 50% on completion, due within 14 days."
          style={ta(2)}
        />
      </label>

      {/* Client DPA status — they provide these in their portal */}
      <div
        style={{
          marginTop: 6,
          paddingTop: 12,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span style={lbl}>DPA details — provided by the client</span>
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: clientDpaReady ? T.success : T.warning,
              border: `1px solid ${clientDpaReady ? T.success : T.warning}40`,
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            {clientDpaReady
              ? `✓ Provided${
                  clientSubmittedAt
                    ? ` ${new Date(clientSubmittedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : ""
                }`
              : clientSubmittedAt
                ? "Started — incomplete"
                : "Awaiting client"}
          </span>
        </div>
        {clientDpaReady ? (
          <div
            style={{
              fontFamily: T.sans,
              fontSize: "0.82rem",
              color: T.muted,
              lineHeight: 1.6,
              marginTop: 8,
            }}
          >
            <div>
              <b style={{ color: T.fg }}>Business type:</b>{" "}
              {limited ? "Limited company" : "Sole trader / other"}
            </div>
            {limited && (
              <div>
                <b style={{ color: T.fg }}>Company:</b> {companyName || "—"}
                {companyNumber ? ` · no. ${companyNumber}` : ""}
              </div>
            )}
            {limited && registeredAddress && (
              <div>
                <b style={{ color: T.fg }}>Registered office:</b> {registeredAddress}
              </div>
            )}
            <div>
              <b style={{ color: T.fg }}>Data collected:</b> {personalData || "—"}
            </div>
            <div>
              <b style={{ color: T.fg }}>Special category:</b>{" "}
              {specialCategory ? `Yes — ${specialCategoryDetail || "(detail)"}` : "No"}
            </div>
          </div>
        ) : (
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.82rem",
              color: T.faint,
              lineHeight: 1.6,
              marginTop: 8,
            }}
          >
            The client is prompted to fill these in the moment they land in their portal.
            You can&apos;t send the documents until they have.
          </p>
        )}

        {/* Correct the company details for discrepancies (limited companies). */}
        <details style={{ marginTop: 10 }}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: T.mono,
              fontSize: 11,
              color: T.primary,
            }}
          >
            Edit company details (for discrepancies)
          </summary>
          <div className="flex flex-col gap-2" style={{ marginTop: 12 }}>
            <label className="flex flex-col gap-1.5">
              <span style={lbl}>Registered company name</span>
              <input
                name="dpa_client_company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="From the client"
                style={inp}
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5">
                <span style={lbl}>Company number</span>
                <input
                  name="dpa_client_company_number"
                  value={companyNumber}
                  onChange={(e) => setCompanyNumber(e.target.value)}
                  placeholder="From the client"
                  style={inp}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span style={lbl}>Country</span>
                <input
                  name="dpa_client_country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={inp}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span style={lbl}>Registered office address</span>
              <textarea
                name="dpa_client_registered_address"
                rows={2}
                value={registeredAddress}
                onChange={(e) => setRegisteredAddress(e.target.value)}
                placeholder="From the client"
                style={ta(2)}
              />
            </label>
          </div>
        </details>
      </div>

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
