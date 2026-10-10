"use client";

import { useMemo, useState, useTransition } from "react";
import { T } from "@nullshift/ui/tokens";
import { Panel } from "@/components/app/AppKit";
import { QuoteWidget } from "@/components/quote-widget/QuoteWidget";
import {
  LIMITS,
  validateConfig,
  type Question,
  type Service,
  type WidgetConfig,
} from "@/lib/quote-widget/engine";
import type { WidgetRow } from "@/lib/quote-widget/data";
import { deleteWidgetAction, saveWidgetAction } from "../actions";

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
const pounds = (pence: number) => (pence / 100).toString();
const toPence = (v: string) => Math.round(Number(v || 0) * 100);

export function WidgetEditor({
  widget,
  siteUrl,
  poweredBy,
}: {
  widget: WidgetRow;
  siteUrl: string;
  poweredBy: boolean;
}) {
  const [name, setName] = useState(widget.name);
  const [notifyEmail, setNotifyEmail] = useState(widget.notify_email ?? "");
  const [active, setActive] = useState(widget.active);
  const [cfg, setCfg] = useState<WidgetConfig>(widget.config);
  const [tab, setTab] = useState<"services" | "questions" | "look" | "embed">("services");
  const [saved, setSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const preview = useMemo(() => {
    const v = validateConfig(cfg);
    return v.ok ? v.config : null;
  }, [cfg]);

  const set = <K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));
  const setService = (i: number, patch: Partial<Service>) =>
    setCfg((c) => ({
      ...c,
      services: c.services.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }));
  const setQuestion = (i: number, patch: Partial<Question>) =>
    setCfg((c) => ({
      ...c,
      questions: c.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)),
    }));

  function save() {
    setSaved(null);
    setErrors([]);
    start(async () => {
      const r = await saveWidgetAction({
        id: widget.id,
        name,
        notifyEmail,
        active,
        config: cfg,
      });
      if (r.ok) setSaved("Saved. Your live widget updates within a minute.");
      else setErrors(r.errors);
    });
  }

  const embed = `<script src="${siteUrl}/widget.js" data-nullshift-quote="${widget.public_key}" async></script>`;

  const tabBtn = (k: typeof tab, label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => setTab(k)}
      className="k-label"
      style={{
        padding: "10px 14px",
        background: "none",
        border: "none",
        borderBottom: `2px solid ${tab === k ? "var(--k-accent)" : "transparent"}`,
        color: tab === k ? "var(--k-fg)" : "var(--k-muted)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      <div className="flex flex-col gap-5">
        <Panel pad={false}>
          <div
            className="flex flex-wrap items-center gap-1 px-2"
            style={{ borderBottom: "1px solid var(--k-border)" }}
          >
            {tabBtn("services", `Services (${cfg.services.length})`)}
            {tabBtn("questions", `Questions (${cfg.questions.length})`)}
            {tabBtn("look", "Look & words")}
            {tabBtn("embed", "Embed & settings")}
          </div>
          <div className="flex flex-col gap-5 p-5">
            {tab === "services" && (
              <>
                {cfg.services.map((s, i) => (
                  <div
                    key={s.id}
                    className="k-kard flex flex-col gap-3 p-4"
                    style={{ background: "var(--k-bg)" }}
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
                      <label className="flex flex-col gap-1.5">
                        <span className="k-label">Job</span>
                        <input
                          className="k-input"
                          value={s.name}
                          onChange={(e) => setService(i, { name: e.target.value })}
                          maxLength={80}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="k-label">Priced</span>
                        <select
                          className="k-select"
                          value={s.mode}
                          onChange={(e) =>
                            setService(i, { mode: e.target.value as Service["mode"] })
                          }
                        >
                          <option value="fixed">Fixed price</option>
                          <option value="per_unit">Per unit</option>
                          <option value="hourly">Per hour</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="k-label">
                          {s.mode === "hourly"
                            ? "£ per hour"
                            : s.mode === "per_unit"
                              ? "£ per unit"
                              : "£ price"}
                        </span>
                        <input
                          className="k-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={pounds(s.pricePence)}
                          onChange={(e) =>
                            setService(i, { pricePence: toPence(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    {s.mode === "per_unit" && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="k-label">Unit name (plural)</span>
                          <input
                            className="k-input"
                            value={s.unitLabel ?? ""}
                            placeholder="radiators"
                            onChange={(e) => setService(i, { unitLabel: e.target.value })}
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="k-label">Min</span>
                          <input
                            className="k-input"
                            type="number"
                            min={1}
                            value={s.minQty ?? 1}
                            onChange={(e) =>
                              setService(i, { minQty: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="k-label">Max</span>
                          <input
                            className="k-input"
                            type="number"
                            min={1}
                            value={s.maxQty ?? 100}
                            onChange={(e) =>
                              setService(i, { maxQty: Number(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                    )}
                    {s.mode === "hourly" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="k-label">Typical job: min hours</span>
                          <input
                            className="k-input"
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={s.minHours ?? 1}
                            onChange={(e) =>
                              setService(i, { minHours: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="k-label">Max hours</span>
                          <input
                            className="k-input"
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={s.maxHours ?? 2}
                            onChange={(e) =>
                              setService(i, { maxHours: Number(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                    )}
                    <div className="flex items-end gap-3">
                      <label className="flex flex-1 flex-col gap-1.5">
                        <span className="k-label">Short note (optional)</span>
                        <input
                          className="k-input"
                          value={s.description ?? ""}
                          placeholder="Labour only; materials extra"
                          maxLength={240}
                          onChange={(e) => setService(i, { description: e.target.value })}
                        />
                      </label>
                      <button
                        type="button"
                        className="kb kb-outline kb-sm"
                        onClick={() =>
                          setCfg((c) => ({
                            ...c,
                            services: c.services.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {cfg.services.length < LIMITS.services && (
                  <button
                    type="button"
                    className="kb kb-outline self-start"
                    onClick={() =>
                      setCfg((c) => ({
                        ...c,
                        services: [
                          ...c.services,
                          { id: newId("svc"), name: "", mode: "fixed", pricePence: 0 },
                        ],
                      }))
                    }
                  >
                    + Add a job
                  </button>
                )}
              </>
            )}

            {tab === "questions" && (
              <>
                <p
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.875rem",
                    color: "var(--k-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Each answer can multiply the price (1.2 = +20%) or add a flat amount.
                  Leave both at 1 and £0 for a question you just want to know the answer
                  to.
                </p>
                {cfg.questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="k-kard flex flex-col gap-3 p-4"
                    style={{ background: "var(--k-bg)" }}
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                      <label className="flex flex-col gap-1.5">
                        <span className="k-label">Question</span>
                        <input
                          className="k-input"
                          value={q.label}
                          maxLength={140}
                          onChange={(e) => setQuestion(i, { label: e.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="k-label">Applies to</span>
                        <select
                          className="k-select"
                          value={q.appliesTo === "all" ? "all" : "some"}
                          onChange={(e) =>
                            setQuestion(i, {
                              appliesTo:
                                e.target.value === "all"
                                  ? "all"
                                  : cfg.services.map((s) => s.id),
                            })
                          }
                        >
                          <option value="all">Every job</option>
                          <option value="some">Only some jobs</option>
                        </select>
                      </label>
                    </div>
                    {q.appliesTo !== "all" && (
                      <div className="flex flex-wrap gap-3">
                        {cfg.services.map((s) => {
                          const on = (q.appliesTo as string[]).includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className="flex items-center gap-2"
                              style={{
                                fontFamily: T.sans,
                                fontSize: "0.85rem",
                                color: "var(--k-fg)",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() =>
                                  setQuestion(i, {
                                    appliesTo: on
                                      ? (q.appliesTo as string[]).filter(
                                          (x) => x !== s.id
                                        )
                                      : [...(q.appliesTo as string[]), s.id],
                                  })
                                }
                              />
                              {s.name || "(unnamed)"}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <div className="grid gap-2 sm:grid-cols-[1fr_110px_120px_80px]">
                        <span className="k-label">Answer</span>
                        <span className="k-label">× price</span>
                        <span className="k-label">+ £</span>
                        <span />
                      </div>
                      {q.options.map((o, oi) => (
                        <div
                          key={o.id}
                          className="grid gap-2 sm:grid-cols-[1fr_110px_120px_80px]"
                        >
                          <input
                            className="k-input"
                            value={o.label}
                            maxLength={80}
                            onChange={(e) =>
                              setQuestion(i, {
                                options: q.options.map((x, k) =>
                                  k === oi ? { ...x, label: e.target.value } : x
                                ),
                              })
                            }
                          />
                          <input
                            className="k-input"
                            type="number"
                            step={0.05}
                            min={0.1}
                            max={10}
                            value={o.multiplier ?? 1}
                            onChange={(e) =>
                              setQuestion(i, {
                                options: q.options.map((x, k) =>
                                  k === oi
                                    ? { ...x, multiplier: Number(e.target.value) }
                                    : x
                                ),
                              })
                            }
                          />
                          <input
                            className="k-input"
                            type="number"
                            step="1"
                            value={pounds(o.addPence ?? 0)}
                            onChange={(e) =>
                              setQuestion(i, {
                                options: q.options.map((x, k) =>
                                  k === oi
                                    ? { ...x, addPence: toPence(e.target.value) }
                                    : x
                                ),
                              })
                            }
                          />
                          <button
                            type="button"
                            className="kb kb-outline kb-sm"
                            onClick={() =>
                              setQuestion(i, {
                                options: q.options.filter((_, k) => k !== oi),
                              })
                            }
                            disabled={q.options.length <= 2}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-3">
                        {q.options.length < LIMITS.optionsPerQuestion && (
                          <button
                            type="button"
                            className="kb kb-outline kb-sm"
                            onClick={() =>
                              setQuestion(i, {
                                options: [
                                  ...q.options,
                                  {
                                    id: newId("o"),
                                    label: "",
                                    multiplier: 1,
                                    addPence: 0,
                                  },
                                ],
                              })
                            }
                          >
                            + Answer
                          </button>
                        )}
                        <button
                          type="button"
                          className="kb kb-outline kb-sm"
                          onClick={() =>
                            setCfg((c) => ({
                              ...c,
                              questions: c.questions.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          Remove question
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {cfg.questions.length < LIMITS.questions && (
                  <button
                    type="button"
                    className="kb kb-outline self-start"
                    onClick={() =>
                      setCfg((c) => ({
                        ...c,
                        questions: [
                          ...c.questions,
                          {
                            id: newId("q"),
                            label: "",
                            type: "choice",
                            appliesTo: "all",
                            options: [
                              { id: newId("o"), label: "", multiplier: 1, addPence: 0 },
                              { id: newId("o"), label: "", multiplier: 1, addPence: 0 },
                            ],
                          },
                        ],
                      }))
                    }
                  >
                    + Add a question
                  </button>
                )}
              </>
            )}

            {tab === "look" && (
              <div className="grid gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Business name on the widget</span>
                  <input
                    className="k-input"
                    value={cfg.businessName}
                    maxLength={80}
                    onChange={(e) => set("businessName", e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Opening line</span>
                  <input
                    className="k-input"
                    value={cfg.intro}
                    maxLength={240}
                    onChange={(e) => set("intro", e.target.value)}
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="k-label">Button text</span>
                    <input
                      className="k-input"
                      value={cfg.ctaLabel}
                      maxLength={40}
                      onChange={(e) => set("ctaLabel", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="k-label">Brand colour</span>
                    <input
                      className="k-input"
                      type="color"
                      value={cfg.brand.colour}
                      onChange={(e) =>
                        set("brand", { ...cfg.brand, colour: e.target.value })
                      }
                      style={{ padding: 4 }}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="k-label">Theme</span>
                    <select
                      className="k-select"
                      value={cfg.brand.dark ? "dark" : "light"}
                      onChange={(e) =>
                        set("brand", { ...cfg.brand, dark: e.target.value === "dark" })
                      }
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Logo URL (https, optional)</span>
                  <input
                    className="k-input"
                    value={cfg.brand.logoUrl ?? ""}
                    placeholder="https://…/logo.png"
                    onChange={(e) =>
                      set("brand", { ...cfg.brand, logoUrl: e.target.value || null })
                    }
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="k-label">Range below (%)</span>
                    <input
                      className="k-input"
                      type="number"
                      min={0}
                      max={60}
                      value={Math.round(cfg.margins.lowPct * 100)}
                      onChange={(e) =>
                        set("margins", {
                          ...cfg.margins,
                          lowPct: Number(e.target.value) / 100,
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="k-label">Range above (%)</span>
                    <input
                      className="k-input"
                      type="number"
                      min={0}
                      max={150}
                      value={Math.round(cfg.margins.highPct * 100)}
                      onChange={(e) =>
                        set("margins", {
                          ...cfg.margins,
                          highPct: Number(e.target.value) / 100,
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="k-label">Call-out fee £</span>
                    <input
                      className="k-input"
                      type="number"
                      min={0}
                      value={pounds(cfg.calloutPence)}
                      onChange={(e) => set("calloutPence", toPence(e.target.value))}
                    />
                  </label>
                </div>
                <div
                  className="flex flex-wrap gap-6"
                  style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-fg)" }}
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cfg.vat.registered}
                      onChange={(e) =>
                        set("vat", { ...cfg.vat, registered: e.target.checked })
                      }
                    />{" "}
                    VAT registered (show prices inc {cfg.vat.ratePct}% VAT)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cfg.contact.askPhone}
                      onChange={(e) =>
                        set("contact", { ...cfg.contact, askPhone: e.target.checked })
                      }
                    />{" "}
                    Ask for phone
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cfg.contact.askPostcode}
                      onChange={(e) =>
                        set("contact", { ...cfg.contact, askPostcode: e.target.checked })
                      }
                    />{" "}
                    Ask for postcode
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={cfg.contact.askMessage}
                      onChange={(e) =>
                        set("contact", { ...cfg.contact, askMessage: e.target.checked })
                      }
                    />{" "}
                    Free-text message box
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Small print under the price</span>
                  <textarea
                    className="k-textarea"
                    rows={3}
                    maxLength={300}
                    value={cfg.disclaimer}
                    onChange={(e) => set("disclaimer", e.target.value)}
                  />
                </label>
              </div>
            )}

            {tab === "embed" && (
              <div className="grid gap-5">
                <div className="grid gap-1.5">
                  <span className="k-label">Paste this where you want the widget</span>
                  <pre
                    className="k-kard"
                    style={{
                      background: "var(--k-bg)",
                      padding: 14,
                      fontFamily: T.mono,
                      fontSize: "0.78rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      color: "var(--k-fg)",
                    }}
                  >
                    {embed}
                  </pre>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="kb kb-primary kb-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(embed);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? "Copied" : "Copy embed code"}
                    </button>
                    <a
                      className="kb kb-outline kb-sm"
                      href={`${siteUrl}/w/${widget.public_key}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Or share the hosted link
                    </a>
                  </div>
                  <p
                    style={{
                      fontFamily: T.sans,
                      fontSize: "0.85rem",
                      color: "var(--k-muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    Works in WordPress (Custom HTML block), Wix (Embed → Custom code),
                    Squarespace (Code block) and any plain HTML page. The widget resizes
                    itself.
                  </p>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Widget name (only you see this)</span>
                  <input
                    className="k-input"
                    value={name}
                    maxLength={120}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="k-label">Email new leads to</span>
                  <input
                    className="k-input"
                    type="email"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                  />
                </label>
                <label
                  className="flex items-center gap-2"
                  style={{ fontFamily: T.sans, color: "var(--k-fg)" }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />{" "}
                  Widget is live (untick to pause it everywhere)
                </label>
                <form
                  action={deleteWidgetAction}
                  onSubmit={(e) => {
                    if (!confirm("Delete this widget? Leads are kept."))
                      e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={widget.id} />
                  <button
                    type="submit"
                    className="kb kb-outline kb-sm"
                    style={{ color: T.danger, borderColor: T.danger }}
                  >
                    Delete widget
                  </button>
                </form>
              </div>
            )}
          </div>
        </Panel>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="kb kb-primary"
            onClick={save}
            disabled={pending}
            style={{ opacity: pending ? 0.6 : 1 }}
          >
            {pending ? "Saving…" : "Save changes"}
            <span className="k-arrow" aria-hidden>
              →
            </span>
          </button>
          {saved && (
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                color: T.success,
              }}
            >
              {saved}
            </span>
          )}
          {errors.length > 0 && (
            <ul
              style={{
                fontFamily: T.mono,
                fontSize: "0.7rem",
                letterSpacing: "0.04em",
                color: T.danger,
                margin: 0,
                paddingLeft: 16,
              }}
            >
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <span className="k-label">Live preview</span>
        <div className="mt-2">
          {preview ? (
            <QuoteWidget
              key={JSON.stringify(preview)}
              config={preview}
              publicKey={widget.public_key}
              poweredBy={poweredBy}
              preview
            />
          ) : (
            <Panel>
              <p style={{ fontFamily: T.sans, color: T.warning }}>
                Fix the highlighted problems to see the preview.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
