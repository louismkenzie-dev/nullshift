"use client";

import { useState, useEffect, useCallback } from "react";
import { T } from "@/lib/tokens";

type Option = { id: string; label: string; description?: string; image_url?: string };
type ProjectUpdate = {
  id: string;
  created_at: string;
  type: "update" | "decision" | "branding";
  title: string;
  body: string | null;
  image_urls: string[];
  requires_action: boolean;
  action_resolved: boolean;
  options: Option[];
  client_choice: string | null;
};

const TYPE_COLOUR: Record<string, string> = {
  update:   T.primary,
  decision: T.warning,
  branding: "#818cf8",
};
const TYPE_LABEL: Record<string, string> = {
  update:   "Update",
  decision: "Decision needed",
  branding: "Branding choice",
};

interface Props {
  clientId: string;
  clientName: string;
}

export function ProjectUpdatesSection({ clientId, clientName }: Props) {
  const [updates,    setUpdates]    = useState<ProjectUpdate[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [composing,  setComposing]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────
  const [type,          setType]          = useState<"update" | "decision" | "branding">("update");
  const [title,         setTitle]         = useState("");
  const [body,          setBody]          = useState("");
  const [imageFiles,    setImageFiles]    = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [options,       setOptions]       = useState<Option[]>([
    { id: "a", label: "" },
    { id: "b", label: "" },
  ]);
  const [requiresAction, setRequiresAction] = useState(false);

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/project-updates?client_id=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setUpdates(data.updates ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { loadUpdates(); }, [loadUpdates]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeImage(i: number) {
    setImageFiles(prev => prev.filter((_, j) => j !== i));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, j) => j !== i);
    });
  }

  function resetForm() {
    setType("update");
    setTitle("");
    setBody("");
    setImageFiles([]);
    setImagePreviews(prev => { prev.forEach(URL.revokeObjectURL); return []; });
    setOptions([{ id: "a", label: "" }, { id: "b", label: "" }]);
    setRequiresAction(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append("client_id",       clientId);
    fd.append("type",            type);
    fd.append("title",           title.trim());
    if (body.trim()) fd.append("body", body.trim());
    fd.append("requires_action", String(requiresAction || type !== "update"));
    if (type !== "update") {
      const validOptions = options.filter(o => o.label.trim());
      fd.append("options", JSON.stringify(validOptions));
    }
    for (const file of imageFiles) fd.append("images", file);

    const res = await fetch("/api/admin/project-updates", { method: "POST", body: fd });
    if (res.ok) {
      await loadUpdates();
      setComposing(false);
      resetForm();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to post update.");
    }
    setSubmitting(false);
  }

  async function deleteUpdate(id: string) {
    if (!confirm("Delete this update?")) return;
    await fetch(`/api/admin/project-updates/${id}`, { method: "DELETE" });
    setUpdates(prev => prev.filter(u => u.id !== id));
  }

  async function markResolved(id: string) {
    await fetch(`/api/admin/project-updates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_resolved: true }),
    });
    setUpdates(prev => prev.map(u => u.id === id ? { ...u, action_resolved: true } : u));
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    background: T.bg, border: `1px solid ${T.border}`, padding: "9px 12px",
    color: T.fg, fontFamily: T.sans, fontSize: "0.875rem", outline: "none",
    borderRadius: T.r.sm, width: "100%",
  };
  const lbl: React.CSSProperties = {
    fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.12em",
    textTransform: "uppercase", color: T.muted, marginBottom: "5px", display: "block",
  };
  const chipBtn = (active: boolean, colour: string): React.CSSProperties => ({
    fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
    padding: "5px 12px", borderRadius: T.r.full, cursor: "pointer",
    border: `1px solid ${active ? colour : T.border}`,
    background: active ? `${colour}20` : "transparent",
    color: active ? colour : T.muted,
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: T.primary }}>
          // PROJECT UPDATES
        </span>
        <button
          onClick={() => { setComposing(v => !v); if (!composing) resetForm(); }}
          style={{
            fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
            background: composing ? "transparent" : T.primary,
            color: composing ? T.muted : T.primaryFg,
            border: `1px solid ${composing ? T.border : T.primary}`,
            borderRadius: T.r.sm, padding: "5px 14px", cursor: "pointer",
          }}
        >
          {composing ? "Cancel" : "+ Post update"}
        </button>
      </div>

      {/* ── Compose form ─────────────────────────────────────────── */}
      {composing && (
        <form
          onSubmit={handleSubmit}
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.lg, padding: 24, marginBottom: 16 }}
        >
          {/* Type selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            {(["update", "decision", "branding"] as const).map(t => (
              <button
                key={t} type="button"
                onClick={() => setType(t)}
                style={chipBtn(type === t, TYPE_COLOUR[t])}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Title */}
            <div>
              <label style={lbl}>Title</label>
              <input
                style={inp}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={
                  type === "update"   ? "e.g. Wireframes complete" :
                  type === "decision" ? "e.g. Choose your homepage layout" :
                  "e.g. Pick your primary colour palette"
                }
                required
              />
            </div>

            {/* Body */}
            <div>
              <label style={lbl}>Details (optional)</label>
              <textarea
                rows={3}
                style={{ ...inp, resize: "vertical" }}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Additional context, notes, or next steps…"
              />
            </div>

            {/* Images */}
            <div>
              <label style={lbl}>Screenshots / images</label>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
                fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.muted, border: `1px solid ${T.border}`, borderRadius: T.r.sm, padding: "6px 12px",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Add image
                <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              </label>
              {imagePreviews.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {imagePreviews.map((src, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: T.r.sm, border: `1px solid ${T.border}`, display: "block" }} />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: T.danger, color: "#fff", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Options — for decision / branding types */}
            {type !== "update" && (
              <div>
                <label style={lbl}>Options — client picks one</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {options.map((opt, i) => (
                    <div key={opt.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ ...inp, flex: 1 }}
                        value={opt.label}
                        onChange={e => { const o = [...options]; o[i] = { ...o[i], label: e.target.value }; setOptions(o); }}
                        placeholder={`Option ${String.fromCharCode(65 + i)} — e.g. Modern & minimal`}
                      />
                      <input
                        style={{ ...inp, flex: 1 }}
                        value={opt.image_url ?? ""}
                        onChange={e => { const o = [...options]; o[i] = { ...o[i], image_url: e.target.value }; setOptions(o); }}
                        placeholder="Image URL (optional)"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOptions(options.filter((_, j) => j !== i))}
                          style={{ color: T.danger, fontFamily: T.mono, fontSize: 16, padding: "0 6px", background: "transparent", border: "none", cursor: "pointer" }}
                        >×</button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setOptions([...options, { id: String(Date.now()), label: "" }])}
                    style={{ alignSelf: "flex-start", fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.primary, background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    + Add option
                  </button>
                </div>
              </div>
            )}

            {/* Requires action toggle for plain updates */}
            {type === "update" && (
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={requiresAction}
                  onChange={e => setRequiresAction(e.target.checked)}
                  style={{ accentColor: T.primary, width: 14, height: 14 }}
                />
                <span style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>
                  Mark as requiring client action
                </span>
              </label>
            )}

            {error && (
              <p style={{ fontFamily: T.sans, fontSize: "0.8rem", color: T.danger }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !title.trim()}
              style={{
                height: 44, fontFamily: T.sans, fontSize: "0.875rem", fontWeight: 500,
                background: T.primary, color: T.primaryFg, borderRadius: T.r.md,
                border: "none", cursor: submitting || !title.trim() ? "not-allowed" : "pointer",
                opacity: submitting || !title.trim() ? 0.5 : 1,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
              }}
            >
              {submitting ? "Posting…" : `Post ${TYPE_LABEL[type]}`}
            </button>
          </div>
        </form>
      )}

      {/* ── Updates list ─────────────────────────────────────────── */}
      {loading ? (
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>Loading updates…</p>
      ) : updates.length === 0 ? (
        <div style={{ background: T.surface, border: `1px dashed ${T.border}`, borderRadius: T.r.md, padding: "24px", textAlign: "center" }}>
          <p style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted }}>
            No updates yet. Post your first update to keep {clientName} informed on their project progress.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {updates.map(update => {
            const colour = TYPE_COLOUR[update.type] ?? T.primary;
            const actionPending = update.requires_action && !update.action_resolved;

            return (
              <div
                key={update.id}
                style={{
                  background: T.surface,
                  border: `1px solid ${actionPending ? colour + "70" : T.border}`,
                  borderRadius: T.r.md,
                  padding: 18,
                  boxShadow: actionPending ? `0 0 0 1px ${colour}30` : "none",
                }}
              >
                {/* Row: type badge + title + actions */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
                      color: colour, background: `${colour}18`, padding: "2px 8px",
                      borderRadius: T.r.full, flexShrink: 0,
                    }}>
                      {TYPE_LABEL[update.type]}
                    </span>
                    <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: "0.875rem", color: T.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {update.title}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {actionPending && (
                      <button
                        onClick={() => markResolved(update.id)}
                        style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary, border: `1px solid ${T.primary}`, borderRadius: T.r.sm, padding: "3px 8px", background: "transparent", cursor: "pointer" }}
                      >
                        Mark resolved
                      </button>
                    )}
                    <button
                      onClick={() => deleteUpdate(update.id)}
                      style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.danger, border: `1px solid ${T.danger}40`, borderRadius: T.r.sm, padding: "3px 8px", background: "transparent", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Body */}
                {update.body && (
                  <p style={{ fontFamily: T.sans, fontSize: "0.825rem", lineHeight: 1.6, color: T.muted, marginTop: 8 }}>
                    {update.body}
                  </p>
                )}

                {/* Images */}
                {update.image_urls?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {update.image_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url} alt=""
                          style={{ width: 96, height: 72, objectFit: "cover", borderRadius: T.r.sm, border: `1px solid ${T.border}`, display: "block" }}
                        />
                      </a>
                    ))}
                  </div>
                )}

                {/* Options — with client choice status */}
                {update.options?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: T.mono, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>
                      Client&apos;s choice:{" "}
                      {update.client_choice ? (
                        <span style={{ color: T.primary }}>
                          {update.options.find(o => o.id === update.client_choice)?.label ?? update.client_choice} ✓
                        </span>
                      ) : (
                        <span style={{ color: T.warning }}>Awaiting response</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {update.options.map(opt => (
                        <div
                          key={opt.id}
                          style={{
                            padding: "5px 12px",
                            borderRadius: T.r.sm,
                            border: `1px solid ${update.client_choice === opt.id ? colour : T.border}`,
                            background: update.client_choice === opt.id ? `${colour}18` : "transparent",
                            fontFamily: T.sans, fontSize: "0.8rem",
                            color: update.client_choice === opt.id ? T.fg : T.muted,
                          }}
                        >
                          {opt.label}
                          {opt.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={opt.image_url} alt="" style={{ display: "block", width: 72, height: 52, objectFit: "cover", marginTop: 6, borderRadius: T.r.sm }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp + action status */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                  <span style={{ fontFamily: T.mono, fontSize: "9px", color: T.faint }}>
                    {new Date(update.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {update.requires_action && (
                    <span style={{ fontFamily: T.mono, fontSize: "9px", color: update.action_resolved ? T.primary : T.warning }}>
                      {update.action_resolved ? "● Resolved" : "● Action required"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
