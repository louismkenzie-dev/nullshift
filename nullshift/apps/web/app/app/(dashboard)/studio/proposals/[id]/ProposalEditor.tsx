"use client";

import { useState, useTransition } from "react";
import { T } from "@nullshift/ui/tokens";
import { Panel } from "@/components/app/AppKit";
import { LineItemsEditor } from "@/components/studio/LineItemsEditor";
import type { ProposalRow } from "@/lib/studio/data";
import type { LineItem } from "@/lib/studio/money";
import { saveProposalAction } from "../../actions";

export function ProposalEditor({ p, vatPct }: { p: ProposalRow; vatPct: number }) {
  const locked = p.status === "accepted";
  const [title, setTitle] = useState(p.title);
  const [intro, setIntro] = useState(p.intro ?? "");
  const [scope, setScope] = useState(p.scope ?? "");
  const [terms, setTerms] = useState(p.terms ?? "");
  const [validUntil, setValidUntil] = useState(p.valid_until ?? "");
  const [items, setItems] = useState<LineItem[]>(p.items ?? []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveProposalAction({
        id: p.id,
        title,
        intro,
        scope,
        items,
        terms,
        valid_until: validUntil || null,
      });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel label="Proposal" title={p.number}>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <label className="flex flex-col gap-1.5">
            <span className="k-label">Title</span>
            <input
              className="k-input"
              value={title}
              disabled={locked}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="k-label">Valid until</span>
            <input
              className="k-input"
              type="date"
              value={validUntil}
              disabled={locked}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="k-label">Opening (why this, why now)</span>
            <textarea
              className="k-textarea"
              rows={3}
              value={intro}
              disabled={locked}
              maxLength={2000}
              onChange={(e) => setIntro(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="k-label">Scope — what is and is not included</span>
            <textarea
              className="k-textarea"
              rows={7}
              value={scope}
              disabled={locked}
              maxLength={8000}
              onChange={(e) => setScope(e.target.value)}
            />
          </label>
        </div>
      </Panel>
      <Panel label="Investment">
        <LineItemsEditor
          items={items}
          onChange={setItems}
          vatPct={vatPct}
          disabled={locked}
        />
      </Panel>
      <Panel label="Terms">
        <textarea
          className="k-textarea"
          rows={7}
          value={terms}
          disabled={locked}
          maxLength={8000}
          onChange={(e) => setTerms(e.target.value)}
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
          {p.status === "sent" && (
            <span
              style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-muted)" }}
            >
              Already sent — saved changes are live at the client&apos;s link immediately.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
