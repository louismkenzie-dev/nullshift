"use client";

import { useRef, useState, useEffect } from "react";
import { T } from "@/lib/tokens";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_STARTS = [
  "Plan my marketing week",
  "Write the Never-Miss-a-Job hero + offer section",
  "10 trade outreach Looms for Leeds",
  "Google Ads for electricians in my town",
  "Audit my pricing page for MRR",
  "5 short-form video scripts from the Systems Lab",
];

/** Minimal, safe markdown → HTML (escape first, then bold/headings/lists). */
function renderMd(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+?)`/g, '<code style="font-family:var(--font-mono),monospace;font-size:0.85em;background:#1E2029;padding:1px 5px;border-radius:4px">$1</code>');
  const lines = src.split("\n");
  let html = "", inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) { closeList(); html += `<h4 class="md-h">${inline(line.slice(4))}</h4>`; }
    else if (/^## /.test(line)) { closeList(); html += `<h3 class="md-h">${inline(line.slice(3))}</h3>`; }
    else if (/^# /.test(line)) { closeList(); html += `<h3 class="md-h">${inline(line.slice(2))}</h3>`; }
    else if (/^\s*[-*] /.test(line)) { if (!inList) { html += '<ul class="md-ul">'; inList = true; } html += `<li>${inline(line.replace(/^\s*[-*] /, ""))}</li>`; }
    else if (/^\s*\d+\.\s/.test(line)) { if (!inList) { html += '<ul class="md-ul">'; inList = true; } html += `<li>${inline(line.replace(/^\s*\d+\.\s/, ""))}</li>`; }
    else if (line.trim() === "") { closeList(); html += "<div style='height:8px'></div>"; }
    else { closeList(); html += `<p class="md-p">${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

export function MarketingAdvisorChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/admin/marketing-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: acc }; return c; });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: `_Couldn't reach the advisor: ${msg}_` }; return c; });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "min(72vh, 760px)", background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.xl, overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center gap-3" style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.primary, boxShadow: `0 0 0 4px ${T.primary}22` }} />
        <div>
          <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1rem", color: T.fg }}>Marketing Advisor</div>
          <div style={{ fontFamily: T.mono, fontSize: "0.66rem", letterSpacing: "0.06em", color: T.faint }}>Recurring-revenue strategist · trades-first</div>
        </div>
        <span style={{ marginLeft: "auto", fontFamily: T.mono, fontSize: "0.62rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.primary, border: `1px solid ${T.primary}33`, background: `${T.primary}12`, borderRadius: 999, padding: "4px 10px" }}>Opus 4.8</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.length === 0 ? (
          <div style={{ maxWidth: 620 }}>
            <p style={{ fontFamily: T.sans, fontSize: "0.95rem", lineHeight: 1.6, color: T.muted }}>
              Your in-house growth marketer — it knows the full strategy, the offers, the pricing ladder, and the £24k / £1.6bn hooks. Ask for campaigns, ad copy, landing-page copy, outreach scripts, SEO pages, a weekly plan, or a funnel/pricing audit. Everything tied to MRR and pounds.
            </p>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
              {QUICK_STARTS.map((q) => (
                <button key={q} onClick={() => send(q)}
                  style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.fg, background: T.elevated, border: `1px solid ${T.border}`, borderRadius: 999, padding: "8px 14px", cursor: "pointer" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: m.role === "user" ? "82%" : "100%" }}>
                {m.role === "user" ? (
                  <div style={{ background: T.elevated, border: `1px solid ${T.border}`, borderRadius: "14px 14px 4px 14px", padding: "11px 15px", fontFamily: T.sans, fontSize: "0.92rem", lineHeight: 1.5, color: T.fg, whiteSpace: "pre-wrap" }}>{m.content}</div>
                ) : (
                  <div className="advisor-md" style={{ fontFamily: T.sans, fontSize: "0.92rem", lineHeight: 1.6, color: T.fg }}
                    dangerouslySetInnerHTML={{ __html: m.content ? renderMd(m.content) : `<span style="color:${T.faint}">Thinking…</span>` }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 16px" }}>
        <div className="flex items-end gap-2" style={{ background: T.bg, border: `1px solid ${T.borderStr}`, borderRadius: 14, padding: "8px 8px 8px 14px" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask the advisor… (Shift+Enter for a new line)"
            rows={1}
            style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", color: T.fg, fontFamily: T.sans, fontSize: "0.92rem", lineHeight: 1.5, maxHeight: 160, paddingTop: 6, paddingBottom: 6 }}
          />
          <button onClick={() => send(input)} disabled={streaming || !input.trim()}
            style={{ flexShrink: 0, height: 38, paddingInline: 16, borderRadius: 10, border: "none", cursor: streaming || !input.trim() ? "default" : "pointer", opacity: streaming || !input.trim() ? 0.5 : 1, background: T.primary, color: T.primaryFg, fontFamily: T.sans, fontWeight: 600, fontSize: "0.85rem", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)` }}>
            {streaming ? "…" : "Send"}
          </button>
        </div>
        <div style={{ fontFamily: T.mono, fontSize: "0.6rem", letterSpacing: "0.04em", color: T.faint, marginTop: 8 }}>
          Advice is generated from your strategy doc. Validate figures against your live numbers.
        </div>
      </div>

      <style>{`
        .advisor-md .md-h { font-family: var(--font-sans), Inter, sans-serif; font-weight: 600; color: ${T.fg}; margin: 14px 0 6px; font-size: 1rem; letter-spacing: -0.01em; }
        .advisor-md .md-p { margin: 0 0 2px; }
        .advisor-md .md-ul { margin: 4px 0 4px; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
        .advisor-md .md-ul li { list-style: disc; color: ${T.muted}; }
        .advisor-md strong { color: ${T.fg}; font-weight: 600; }
      `}</style>
    </div>
  );
}
