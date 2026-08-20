import React from "react";
import { T } from "@nullshift/ui/tokens";

/**
 * Shared form/table primitives for the SOC 2 area — the same shapes every
 * admin page hand-rolls (inp/Field/actionBtn), lifted once because this area
 * has fourteen sibling pages. Server-safe: styles + stateless components.
 */

export const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  height: 36,
  padding: "0 11px",
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  width: "100%",
};

export const textarea: React.CSSProperties = {
  ...inp,
  height: "auto",
  minHeight: 76,
  padding: "9px 11px",
  resize: "vertical" as const,
};

export const actionBtn: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  height: 30,
  paddingInline: 12,
  background: "var(--k-surface)",
  color: "var(--k-fg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  cursor: "pointer",
};

export const primaryBtn: React.CSSProperties = {
  ...actionBtn,
  color: "var(--k-accent)",
  border: "1px solid var(--k-accent)",
};

export const dangerBtn: React.CSSProperties = {
  ...actionBtn,
  color: T.danger,
  border: `1px solid ${T.danger}40`,
};

export const monoLabel: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

export const faintMono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "10px",
  letterSpacing: "0.06em",
  color: "var(--k-faint)",
};

export const bodyText: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.85rem",
  lineHeight: 1.5,
  color: "var(--k-muted)",
};

export function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <label
      className={`flex flex-col gap-1 min-w-0 max-md:w-full ${grow ? "flex-1" : ""}`}
      style={{ minWidth: grow ? 180 : undefined }}
    >
      <span style={monoLabel}>{label}</span>
      {children}
    </label>
  );
}

export const shortDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-center py-7"
      style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)" }}
    >
      {children}
    </p>
  );
}

export function HeaderRow({ grid, cols }: { grid: string; cols: string[] }) {
  return (
    <div
      className="max-md:hidden md:grid gap-3 items-center px-4 py-2.5"
      style={{
        gridTemplateColumns: grid,
        background: "var(--k-surface)",
        borderBottom: "1px solid var(--k-border)",
      }}
    >
      {cols.map((c) => (
        <span key={c} style={{ ...faintMono, textTransform: "uppercase" }}>
          {c}
        </span>
      ))}
    </div>
  );
}
