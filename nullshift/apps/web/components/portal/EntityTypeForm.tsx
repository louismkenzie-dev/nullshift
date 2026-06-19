"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";

/**
 * Pre-signature gate: the client declares whether they're a limited company.
 * Limited companies must provide their company number + registered office (which
 * prepopulate the DPA they then sign); sole traders / others skip the DPA and just
 * sign the proposal. Posts to a server action passed in as `action`.
 */
export function EntityTypeForm({
  action,
  projectId,
  defaults,
}: {
  action: (fd: FormData) => void | Promise<void>;
  projectId: string;
  defaults?: {
    entityType?: string | null;
    companyNumber?: string | null;
    registeredAddress?: string | null;
    country?: string | null;
  };
}) {
  const [type, setType] = useState(defaults?.entityType ?? "");
  const limited = type === "limited";

  const opt = (value: string, label: string) => {
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
        {label}
      </button>
    );
  };

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

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="entity_type" value={type} />
      <p
        style={{ fontFamily: T.sans, fontSize: "0.95rem", color: T.fg, fontWeight: 600 }}
      >
        Before you sign — are you a limited company?
      </p>
      <div className="flex gap-2 flex-wrap">
        {opt("limited", "Yes — limited company")}
        {opt("sole_trader", "No — sole trader / other")}
      </div>

      {limited && (
        <div className="flex flex-col gap-2" style={{ marginTop: 4 }}>
          <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
            As a limited company you'll also sign a Data Processing Agreement. Please
            confirm your registered details so we can complete it.
          </p>
          <input
            name="company_number"
            required={limited}
            defaultValue={defaults?.companyNumber ?? ""}
            placeholder="Company number"
            style={input}
          />
          <input
            name="country"
            defaultValue={defaults?.country ?? "United Kingdom"}
            placeholder="Country of registration"
            style={input}
          />
          <textarea
            name="registered_address"
            required={limited}
            rows={2}
            defaultValue={defaults?.registeredAddress ?? ""}
            placeholder="Registered office address"
            style={{ ...input, resize: "vertical" }}
          />
        </div>
      )}
      {type === "sole_trader" && (
        <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.muted }}>
          No separate DPA is needed — you'll just sign the proposal (it includes our
          standard data-processing terms).
        </p>
      )}

      <button
        type="submit"
        disabled={!type}
        className="self-start"
        style={{
          fontFamily: T.sans,
          fontWeight: 600,
          fontSize: "0.9rem",
          height: 44,
          paddingInline: 22,
          background: type ? T.primary : T.surface2,
          color: type ? T.primaryFg : T.faint,
          border: "none",
          borderRadius: T.r.md,
          cursor: type ? "pointer" : "not-allowed",
        }}
      >
        Continue to sign →
      </button>
    </form>
  );
}
