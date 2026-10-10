"use client";

import { useState, useTransition } from "react";
import { T } from "@nullshift/ui/tokens";
import { Panel } from "@/components/app/AppKit";
import { LineItemsEditor } from "@/components/studio/LineItemsEditor";
import type { InvoiceRow } from "@/lib/studio/data";
import type { LineItem } from "@/lib/studio/money";
import { saveInvoiceAction } from "../../actions";

export function InvoiceEditor({ inv }: { inv: InvoiceRow }) {
  const locked = inv.status === "paid" || inv.status === "void";
  const [items, setItems] = useState<LineItem[]>(inv.items ?? []);
  const [notes, setNotes] = useState(inv.notes ?? "");
  const [issued, setIssued] = useState(inv.issued_on);
  const [due, setDue] = useState(inv.due_on ?? "");
  const [vat, setVat] = useState(Number(inv.vat_pct));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveInvoiceAction({
        id: inv.id,
        items,
        notes,
        issued_on: issued,
        due_on: due || null,
        vat_pct: vat,
      });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  }
  return (
    <div className="flex flex-col gap-5">
      <Panel label="Invoice" title={inv.number}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="k-label">Issued</span>
            <input
              className="k-input"
              type="date"
              value={issued}
              disabled={locked}
              onChange={(e) => setIssued(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="k-label">Due</span>
            <input
              className="k-input"
              type="date"
              value={due}
              disabled={locked}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="k-label">VAT %</span>
            <input
              className="k-input"
              type="number"
              min={0}
              max={30}
              value={vat}
              disabled={locked}
              onChange={(e) => setVat(Number(e.target.value))}
            />
          </label>
        </div>
      </Panel>
      <Panel label="Lines">
        <LineItemsEditor
          items={items}
          onChange={setItems}
          vatPct={vat}
          disabled={locked}
        />
      </Panel>
      <Panel label="Note to client (optional)">
        <textarea
          className="k-textarea"
          rows={3}
          value={notes}
          disabled={locked}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Panel>
      {!locked && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="kb kb-primary"
            onClick={save}
            disabled={pending}
            style={{ opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Saving…" : "Save"}
            <span className="k-arrow" aria-hidden>
              →
            </span>
          </button>
          {msg && (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                color: msg.ok ? T.success : T.danger,
              }}
            >
              {msg.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
