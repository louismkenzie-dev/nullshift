"use client";

import type { LineItem } from "@/lib/studio/money";
import { gbp, totals } from "@/lib/studio/money";

/** Shared editable line-item table for proposals and invoices. */
export function LineItemsEditor({
  items,
  onChange,
  vatPct,
  disabled = false,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  vatPct: number;
  disabled?: boolean;
}) {
  const set = (i: number, patch: Partial<LineItem>) =>
    onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const t = totals(items, vatPct);
  return (
    <div className="flex flex-col gap-2">
      <div className="hidden gap-2 sm:grid sm:grid-cols-[1fr_90px_130px_120px_40px]">
        <span className="k-label">Item</span>
        <span className="k-label">Qty</span>
        <span className="k-label">Unit £</span>
        <span className="k-label" style={{ textAlign: "right" }}>
          Amount
        </span>
        <span />
      </div>
      {items.map((it, i) => (
        <div
          key={i}
          className="grid gap-2 sm:grid-cols-[1fr_90px_130px_120px_40px] sm:items-center"
        >
          <input
            className="k-input"
            value={it.description}
            disabled={disabled}
            placeholder="Describe the work"
            maxLength={300}
            onChange={(e) => set(i, { description: e.target.value })}
          />
          <input
            className="k-input"
            type="number"
            min={0}
            step={0.5}
            value={it.qty}
            disabled={disabled}
            onChange={(e) => set(i, { qty: Number(e.target.value) })}
          />
          <input
            className="k-input"
            type="number"
            step="0.01"
            value={(it.unitPence / 100).toString()}
            disabled={disabled}
            onChange={(e) =>
              set(i, { unitPence: Math.round(Number(e.target.value || 0) * 100) })
            }
          />
          <span
            style={{
              textAlign: "right",
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem",
              color: "var(--k-fg)",
            }}
          >
            {gbp(Math.round(it.qty * it.unitPence))}
          </span>
          <button
            type="button"
            className="kb kb-outline kb-sm"
            disabled={disabled}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          className="kb kb-outline kb-sm self-start"
          onClick={() => onChange([...items, { description: "", qty: 1, unitPence: 0 }])}
        >
          + Add line
        </button>
      )}
      <div
        className="mt-2 flex flex-col items-end gap-1"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.9rem",
          color: "var(--k-muted)",
        }}
      >
        {vatPct > 0 && (
          <>
            <span>Subtotal {gbp(t.subtotal)}</span>
            <span>
              VAT {vatPct}% {gbp(t.vat)}
            </span>
          </>
        )}
        <strong style={{ color: "var(--k-fg)", fontSize: "1.1rem" }}>
          Total {gbp(t.total)}
        </strong>
      </div>
    </div>
  );
}
