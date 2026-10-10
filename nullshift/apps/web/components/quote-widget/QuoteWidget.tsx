"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  estimate,
  gbp,
  questionsFor,
  type Estimate,
  type Service,
  type WidgetConfig,
} from "@/lib/quote-widget/engine";

type Step = "service" | "questions" | "contact" | "done";

/**
 * The customer-facing widget. Self-contained styling (inline, driven by the
 * trade's brand colour) because it renders inside an iframe on someone else's
 * website, where our global CSS is not a given. Also used inside the console
 * for the live preview (`preview` disables submission).
 */
export function QuoteWidget({
  config,
  publicKey,
  poweredBy,
  preview = false,
  embedded = false,
  sourceUrl,
}: {
  config: WidgetConfig;
  publicKey: string;
  poweredBy: boolean;
  preview?: boolean;
  embedded?: boolean;
  sourceUrl?: string | null;
}) {
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string>(config.services[0]?.id ?? "");
  const [quantity, setQuantity] = useState<number>(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    postcode: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    lowPence: number;
    highPence: number;
    includesVat: boolean;
  } | null>(null);
  const startedAt = useRef(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  const service: Service | undefined = config.services.find((s) => s.id === serviceId);
  const questions = useMemo(
    () => (service ? questionsFor(config, service) : []),
    [config, service]
  );
  const live: Estimate | null = useMemo(() => {
    if (!service) return null;
    const r = estimate(config, { serviceId: service.id, quantity, answers });
    return r.ok ? r : null;
  }, [config, service, quantity, answers]);

  // Tell the host page how tall we are (embed loader listens).
  useEffect(() => {
    if (!embedded || typeof window === "undefined" || window.parent === window) return;
    const el = rootRef.current;
    if (!el) return;
    const post = () =>
      window.parent.postMessage(
        { type: "ns-quote-size", key: publicKey, height: el.offsetHeight },
        "*"
      );
    post();
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded, publicKey, step]);

  useEffect(() => {
    if (service?.mode === "per_unit") setQuantity(service.minQty ?? 1);
  }, [service]);

  const dark = config.brand.dark;
  const c = {
    bg: dark ? "#0f1115" : "#ffffff",
    fg: dark ? "#f3f4f6" : "#111318",
    muted: dark ? "#9aa0ae" : "#5c6170",
    border: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
    surface: dark ? "#161920" : "#f6f7f9",
    accent: config.brand.colour,
  };
  const font = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const label: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: c.muted,
    fontWeight: 600,
  };
  const input: React.CSSProperties = {
    width: "100%",
    height: 44,
    padding: "0 12px",
    borderRadius: 6,
    border: `1px solid ${c.border}`,
    background: c.surface,
    color: c.fg,
    fontFamily: font,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  };
  const btn: React.CSSProperties = {
    height: 46,
    padding: "0 20px",
    borderRadius: 6,
    border: "none",
    background: c.accent,
    color: "#fff",
    fontFamily: font,
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
  const ghost: React.CSSProperties = {
    ...btn,
    background: "transparent",
    color: c.muted,
    border: `1px solid ${c.border}`,
  };
  const option = (active: boolean): React.CSSProperties => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    borderRadius: 6,
    cursor: "pointer",
    border: `1px solid ${active ? c.accent : c.border}`,
    background: active ? `${c.accent}1f` : c.surface,
    color: c.fg,
    fontFamily: font,
    fontSize: 15,
    lineHeight: 1.4,
  });

  const canContinueQuestions = questions.every((q) => answers[q.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) {
      setResult(
        live
          ? {
              lowPence: live.lowPence,
              highPence: live.highPence,
              includesVat: live.includesVat,
            }
          : null
      );
      setStep("done");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/widget/${encodeURIComponent(publicKey)}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          quantity,
          answers,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          postcode: contact.postcode,
          message: contact.message,
          sourceUrl:
            sourceUrl ?? (typeof window !== "undefined" ? document.referrer : null),
          startedAt: startedAt.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = { service: 1, questions: 2, contact: 3, done: 4 }[step];
  const totalSteps = questions.length ? 3 : 2;

  return (
    <div
      ref={rootRef}
      style={{
        fontFamily: font,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: 24,
        maxWidth: 520,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {config.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.brand.logoUrl}
              alt=""
              style={{ height: 28, width: "auto" }}
            />
          ) : (
            <span
              style={{
                width: 10,
                height: 24,
                background: c.accent,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
          )}
          <strong style={{ fontSize: 15 }}>{config.businessName}</strong>
        </div>
        {step !== "done" && (
          <span style={label}>
            Step {Math.min(stepIndex, totalSteps)} of {totalSteps}
          </span>
        )}
      </div>

      {step === "service" && (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ margin: 0, color: c.muted, fontSize: 15, lineHeight: 1.5 }}>
            {config.intro}
          </p>
          <span style={label}>What do you need?</span>
          {config.services.length === 0 && (
            <p style={{ color: c.muted }}>No services set up yet.</p>
          )}
          <div style={{ display: "grid", gap: 8 }}>
            {config.services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                style={option(s.id === serviceId)}
              >
                <span
                  style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                >
                  <span>
                    {s.name}
                    {s.description && (
                      <span style={{ display: "block", fontSize: 13, color: c.muted }}>
                        {s.description}
                      </span>
                    )}
                  </span>
                  <span style={{ color: c.muted, fontSize: 13, whiteSpace: "nowrap" }}>
                    {s.mode === "fixed"
                      ? `from ${gbp(s.pricePence)}`
                      : s.mode === "per_unit"
                        ? `${gbp(s.pricePence)} / ${s.unitLabel?.replace(/s$/, "") ?? "unit"}`
                        : `${gbp(s.pricePence)} / hr`}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {service?.mode === "per_unit" && (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={label}>How many {service.unitLabel ?? "units"}?</span>
              <input
                type="number"
                min={service.minQty ?? 1}
                max={service.maxQty ?? 1000}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={input}
              />
            </label>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button
              type="button"
              style={btn}
              disabled={!service}
              onClick={() => setStep(questions.length ? "questions" : "contact")}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === "questions" && (
        <div style={{ display: "grid", gap: 18 }}>
          {questions.map((q) => (
            <div key={q.id} style={{ display: "grid", gap: 8 }}>
              <span style={label}>{q.label}</span>
              {q.help && <span style={{ fontSize: 13, color: c.muted }}>{q.help}</span>}
              <div style={{ display: "grid", gap: 6 }}>
                {q.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    style={option(answers[q.id] === o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <button type="button" style={ghost} onClick={() => setStep("service")}>
              ← Back
            </button>
            <button
              type="button"
              style={{ ...btn, opacity: canContinueQuestions ? 1 : 0.5 }}
              disabled={!canContinueQuestions}
              onClick={() => setStep("contact")}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === "contact" && (
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {live && (
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: c.surface,
                border: `1px solid ${c.border}`,
              }}
            >
              <span style={label}>Your guide price</span>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                {gbp(live.lowPence)} – {gbp(live.highPence)}
                {live.includesVat && (
                  <span
                    style={{
                      fontSize: 13,
                      color: c.muted,
                      fontWeight: 400,
                      marginLeft: 8,
                    }}
                  >
                    inc VAT
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: c.muted,
                  lineHeight: 1.5,
                }}
              >
                Leave your details and {config.businessName} will confirm the exact price.
              </p>
            </div>
          )}
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>Your name</span>
            <input
              required
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              style={input}
              autoComplete="name"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={label}>Email</span>
            <input
              required
              type="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              style={input}
              autoComplete="email"
            />
          </label>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns:
                config.contact.askPhone && config.contact.askPostcode ? "1fr 1fr" : "1fr",
            }}
          >
            {config.contact.askPhone && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={label}>Phone</span>
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  style={input}
                  autoComplete="tel"
                />
              </label>
            )}
            {config.contact.askPostcode && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={label}>Postcode</span>
                <input
                  value={contact.postcode}
                  onChange={(e) => setContact({ ...contact, postcode: e.target.value })}
                  style={input}
                  autoComplete="postal-code"
                />
              </label>
            )}
          </div>
          {config.contact.askMessage && (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={label}>Anything else?</span>
              <textarea
                value={contact.message}
                onChange={(e) => setContact({ ...contact, message: e.target.value })}
                style={{ ...input, height: 88, padding: 12, resize: "vertical" }}
              />
            </label>
          )}
          {/* honeypot */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: "absolute", left: -9999, opacity: 0 }}
            aria-hidden
            onChange={() => undefined}
          />
          {error && <p style={{ margin: 0, color: "#e5484d", fontSize: 14 }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <button
              type="button"
              style={ghost}
              onClick={() => setStep(questions.length ? "questions" : "service")}
            >
              ← Back
            </button>
            <button
              type="submit"
              style={{ ...btn, opacity: busy ? 0.6 : 1 }}
              disabled={busy}
            >
              {busy ? "Sending…" : config.ctaLabel} →
            </button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div style={{ display: "grid", gap: 12 }}>
          <span style={label}>Your guide price</span>
          <div style={{ fontSize: 34, fontWeight: 700 }}>
            {result ? `${gbp(result.lowPence)} – ${gbp(result.highPence)}` : "—"}
            {result?.includesVat && (
              <span
                style={{ fontSize: 13, color: c.muted, fontWeight: 400, marginLeft: 8 }}
              >
                inc VAT
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: c.muted, fontSize: 14, lineHeight: 1.6 }}>
            {config.disclaimer}
          </p>
          <p style={{ margin: 0, fontSize: 15 }}>
            Thanks {contact.name || ""} — we have your details and will be in touch
            shortly.
          </p>
          <button
            type="button"
            style={{ ...ghost, justifySelf: "start" }}
            onClick={() => {
              setStep("service");
              setAnswers({});
              setResult(null);
            }}
          >
            Price another job
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: `1px solid ${c.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12, color: c.muted }}>
          {step === "done"
            ? ""
            : config.disclaimer.slice(0, 80) + (config.disclaimer.length > 80 ? "…" : "")}
        </span>
        {poweredBy && (
          <a
            href="https://nullshift.co.uk/products/quote"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 11,
              color: c.muted,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Powered by Nullshift
          </a>
        )}
      </div>
    </div>
  );
}
