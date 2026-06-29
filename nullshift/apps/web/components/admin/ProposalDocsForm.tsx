"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";
import { SubmitButton } from "./SubmitButton";

/**
 * Admin authoring of the proposal document (overview + payment terms) plus the
 * single "Save documents & DPA details and send" action. The DPA details
 * themselves are provided by the CLIENT in their portal — here the admin sees
 * the status of that and a read-only summary (single source of truth, so a stale
 * admin page can't clobber it). The send button stays greyed until everything is
 * complete: build modules, a care plan, the overview, payment terms, AND the
 * client has submitted their DPA details. Once sent it switches to "Save
 * changes" (edits without re-sending).
 */
type Defaults = {
  overview: string;
  paymentTerms: string;
};

const inp = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  padding: "8px 10px",
  background: T.bg,
  color: T.fg,
  border: `1px solid ${T.border}`,
  borderRadius: 0,
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
  companyName,
  companyNumber,
  registeredAddress,
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
  companyName: string | null;
  companyNumber: string | null;
  registeredAddress: string | null;
  personalData: string | null;
  specialCategory: boolean | null;
  specialCategoryDetail: string | null;
  defaults: Defaults;
}) {
  const [overview, setOverview] = useState(defaults.overview);
  const [paymentTerms, setPaymentTerms] = useState(defaults.paymentTerms);

  const draft = proposalStatus === "draft";
  const limited = entityType === "limited";

  // The care plan is optional — it is intentionally NOT in `missing` so a
  // proposal can be sent without one (shown as an optional note below).
  const missing: string[] = [];
  if (!modulesComplete) missing.push("at least one build module");
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
      </div>

      {draft && !planSelected && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.8rem",
            color: T.faint,
            lineHeight: 1.5,
          }}
        >
          No care plan selected — that&apos;s optional, you can send without one.
        </p>
      )}

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

      <SubmitButton
        disabled={!canSubmit}
        pendingLabel={draft ? "Sending…" : "Saving…"}
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
          borderRadius: 0,
          cursor: canSubmit ? "pointer" : "not-allowed",
          opacity: canSubmit ? 1 : 0.7,
        }}
      >
        {draft ? "Save documents & DPA details and send →" : "Save changes"}
      </SubmitButton>
    </form>
  );
}
