"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronRight, AlertCircle } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@/lib/tokens";
import {
  PAGE_OPTIONS, DESIGN_STYLES, PURPOSES, TIMELINES, LOGO_STATES,
  BUDGET_MIN, BUDGET_MAX, BUDGET_STEP, formatBudget, labelFor,
  emptyBrief, type BriefData,
} from "@/lib/brief";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "You" }, { id: 2, label: "Pages" }, { id: 3, label: "Style" },
  { id: 4, label: "Goals" }, { id: 5, label: "Budget" },
];

type Errs = Partial<Record<keyof BriefData | "pages", string>>;

export default function BriefPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: T.bg }} />}>
      <BriefInner />
    </Suspense>
  );
}

function BriefInner() {
  const params = useSearchParams();
  const clientId = params.get("client"); // present when admin invites an existing client
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<BriefData>(emptyBrief);
  const [errors, setErrors] = useState<Errs>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const set = <K extends keyof BriefData>(key: K, value: BriefData[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };
  const togglePage = (id: string) => {
    setForm(f => ({ ...f, pages: f.pages.includes(id) ? f.pages.filter(p => p !== id) : [...f.pages, id] }));
    setErrors(e => ({ ...e, pages: undefined }));
  };

  const validate = (): boolean => {
    const e: Errs = {};
    if (step === 1) {
      if (!form.clientName.trim()) e.clientName = "Required";
      if (!form.clientEmail.trim() || !/\S+@\S+\.\S+/.test(form.clientEmail)) e.clientEmail = "Valid email required";
    }
    if (step === 2 && form.pages.length === 0) e.pages = "Select at least one page";
    if (step === 3) {
      if (!form.designStyle) e.designStyle = "Please choose a style";
      if (!form.hasLogo) e.hasLogo = "Required";
    }
    if (step === 4 && !form.websitePurpose) e.websitePurpose = "Required";
    if (step === 5) {
      if (!form.budget || form.budget < BUDGET_MIN) e.budget = "Please set a budget";
      if (!form.timeline) e.timeline = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: form, clientId }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setSubmitError("Could not submit. Please try again or email us directly.");
    } finally {
      setSubmitting(false);
    }
  }

  const next = () => {
    if (!validate()) return;
    if (step < 5) setStep(s => (s + 1) as Step);
    else submit();
  };
  const back = () => step > 1 && setStep(s => (s - 1) as Step);

  if (submitted) {
    return (
      <>
        <Nav />
        <main className="min-h-screen flex items-center justify-center p-6" style={{ background: T.bg }}>
          <div className="max-w-lg w-full">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${T.primary}26`, border: `1px solid ${T.primary}55` }}>
                <Check className="w-5 h-5" style={{ color: T.primary }} />
              </div>
              <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: T.muted }}>// Brief received</span>
            </div>
            <h1 className="mb-4" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "3rem", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
              WE&apos;VE GOT<br />WHAT WE NEED.
            </h1>
            <p style={{ fontFamily: T.sans, color: T.muted, marginBottom: "32px" }}>
              Thanks, <span style={{ color: T.fg }}>{form.clientName}</span>. We&apos;ll review your brief and be in touch within 1–2 business days.
            </p>
            <div className="p-6 rounded-lg space-y-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: T.muted, marginBottom: "14px" }}>// Submission summary</p>
              <Row label="Name" value={form.clientName} />
              <Row label="Email" value={form.clientEmail} />
              {form.companyName && <Row label="Company" value={form.companyName} />}
              <Row label="Pages" value={form.pages.map(p => labelFor(PAGE_OPTIONS, p)).join(", ")} />
              <Row label="Style" value={labelFor(DESIGN_STYLES, form.designStyle)} />
              <Row label="Has logo" value={labelFor(LOGO_STATES, form.hasLogo)} />
              <Row label="Purpose" value={labelFor(PURPOSES, form.websitePurpose)} />
              <Row label="Budget" value={form.budget >= BUDGET_MIN ? formatBudget(form.budget) : "—"} />
              <Row label="Timeline" value={labelFor(TIMELINES, form.timeline)} />
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen flex flex-col" style={{ background: T.bg, fontFamily: T.sans }}>
        <header className="px-6 pt-24 pb-6 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: T.primary }}>// CLIENT BRIEF</span>
          <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.18em", color: T.muted }}>{step} / 5</span>
        </header>

        <div className="flex-1 flex flex-col items-center justify-start py-12 px-4">
          <div className="w-full max-w-xl">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-10">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    onClick={() => s.id < step && setStep(s.id)}
                    className="flex items-center justify-center w-7 h-7 rounded-full transition-all"
                    style={{
                      border: `1px solid ${s.id === step ? T.primary : s.id < step ? `${T.primary}66` : T.border}`,
                      background: s.id === step ? `${T.primary}1a` : s.id < step ? `${T.primary}0d` : "transparent",
                      color: s.id <= step ? T.primary : T.muted,
                      fontFamily: T.mono, fontSize: "11px",
                      cursor: s.id < step ? "pointer" : "default",
                    }}
                  >
                    {s.id < step ? <Check className="w-3 h-3" /> : s.id}
                  </button>
                  <span className="hidden sm:block" style={{ fontFamily: T.mono, fontSize: "11px", color: s.id === step ? T.fg : T.muted }}>{s.label}</span>
                  {i < STEPS.length - 1 && <div className="h-px w-6 sm:w-8 ml-1" style={{ background: s.id < step ? `${T.primary}55` : T.border }} />}
                </div>
              ))}
            </div>

            {/* Step body */}
            <div className="rounded-xl p-8 space-y-6" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              {step === 1 && <StepOne form={form} errors={errors} set={set} />}
              {step === 2 && <StepTwo form={form} errors={errors} togglePage={togglePage} set={set} />}
              {step === 3 && <StepThree form={form} errors={errors} set={set} />}
              {step === 4 && <StepFour form={form} errors={errors} set={set} />}
              {step === 5 && <StepFive form={form} errors={errors} set={set} />}
            </div>

            {submitError && <p className="mt-4 flex items-center gap-2" style={{ fontFamily: T.mono, fontSize: 11, color: T.danger }}><AlertCircle className="w-3 h-3" /> {submitError}</p>}

            <div className="flex items-center justify-between mt-6">
              <button onClick={back} className="transition-colors hover:text-[#fafafa]" style={{ fontFamily: T.mono, fontSize: "12px", color: T.muted, visibility: step === 1 ? "hidden" : "visible" }}>← BACK</button>
              <button onClick={next} disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 rounded-md transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ fontFamily: T.mono, fontSize: "12px", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", background: T.primary, color: T.primaryFg }}>
                {step === 5 ? (submitting ? "Sending…" : "Submit brief") : "Continue"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ── Step components ──────────────────────────────── */
function StepOne({ form, errors, set }: { form: BriefData; errors: Errs; set: <K extends keyof BriefData>(k: K, v: BriefData[K]) => void }) {
  return (
    <div className="space-y-5">
      <StepHeading marker="// 01 — Contact" title={"Let's start\nwith you."} sub="Basic contact details so we can follow up." />
      <Field label="Your name" error={errors.clientName}>
        <input type="text" value={form.clientName} onChange={e => set("clientName", e.target.value)} placeholder="Alex Johnson" className={inputCls(!!errors.clientName)} />
      </Field>
      <Field label="Email address" error={errors.clientEmail}>
        <input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} placeholder="alex@company.com" className={inputCls(!!errors.clientEmail)} />
      </Field>
      <Field label="Company / brand name" note="optional">
        <input type="text" value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Acme Ltd" className={inputCls(false)} />
      </Field>
    </div>
  );
}

function StepTwo({ form, errors, togglePage, set }: { form: BriefData; errors: Errs; togglePage: (id: string) => void; set: <K extends keyof BriefData>(k: K, v: BriefData[K]) => void }) {
  return (
    <div className="space-y-5">
      <StepHeading marker="// 02 — Pages" title="What pages do you need?" sub="Select all that apply. You can add custom pages below." />
      <div className="grid grid-cols-2 gap-2">
        {PAGE_OPTIONS.map(page => {
          const checked = form.pages.includes(page.id);
          return (
            <button key={page.id} onClick={() => togglePage(page.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-md text-sm text-left transition-all"
              style={{
                border: `1px solid ${checked ? `${T.primary}80` : T.border}`,
                background: checked ? `${T.primary}0d` : `${T.surface2}66`,
                color: checked ? T.fg : T.muted,
                fontFamily: T.sans,
              }}>
              <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ border: `1px solid ${checked ? T.primary : `${T.muted}55`}`, background: checked ? T.primary : "transparent" }}>
                {checked && <Check className="w-2.5 h-2.5" style={{ color: T.primaryFg }} />}
              </div>
              {page.label}
            </button>
          );
        })}
      </div>
      {errors.pages && <FieldError msg={errors.pages} />}
      <Field label="Any other pages?" note="optional">
        <input type="text" value={form.customPage} onChange={e => set("customPage", e.target.value)} placeholder="e.g. Case studies, Press, Login" className={inputCls(false)} />
      </Field>
    </div>
  );
}

function StepThree({ form, errors, set }: { form: BriefData; errors: Errs; set: <K extends keyof BriefData>(k: K, v: BriefData[K]) => void }) {
  return (
    <div className="space-y-6">
      <StepHeading marker="// 03 — Style" title="Style & branding." sub="What direction do you want the design to take?" />
      <div className="space-y-2">
        <FieldLabel>Design style</FieldLabel>
        <div className="grid gap-2">
          {DESIGN_STYLES.map(style => {
            const sel = form.designStyle === style.id;
            return (
              <button key={style.id} onClick={() => set("designStyle", style.id)}
                className="flex items-center justify-between px-4 py-3 rounded-md text-left transition-all"
                style={{ border: `1px solid ${sel ? `${T.primary}80` : T.border}`, background: sel ? `${T.primary}0d` : `${T.surface2}66` }}>
                <div>
                  <span className="text-sm block" style={{ color: sel ? T.fg : T.muted }}>{style.label}</span>
                  <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>{style.desc}</span>
                </div>
                <div className="w-4 h-4 rounded-full shrink-0 ml-4 flex items-center justify-center" style={{ border: `1px solid ${sel ? T.primary : T.border}` }}>
                  {sel && <div className="w-2 h-2 rounded-full" style={{ background: T.primary }} />}
                </div>
              </button>
            );
          })}
        </div>
        {errors.designStyle && <FieldError msg={errors.designStyle} />}
      </div>

      <div className="space-y-2">
        <FieldLabel>Do you have a logo?</FieldLabel>
        <div className="flex gap-2">
          {LOGO_STATES.map(opt => {
            const sel = form.hasLogo === opt.id;
            return (
              <button key={opt.id} onClick={() => set("hasLogo", opt.id)} className="flex-1 py-2.5 rounded-md transition-all"
                style={{ border: `1px solid ${sel ? `${T.primary}80` : T.border}`, background: sel ? `${T.primary}0d` : `${T.surface2}66`, color: sel ? T.fg : T.muted, fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {opt.label}
              </button>
            );
          })}
        </div>
        {errors.hasLogo && <FieldError msg={errors.hasLogo} />}
      </div>

      {(form.hasLogo === "yes" || form.hasLogo === "wip") && (
        <Field label="Logo / branding notes" note="optional">
          <textarea value={form.logoNotes} onChange={e => set("logoNotes", e.target.value)} rows={3}
            placeholder="Existing brand colours, fonts, files…" className={`${inputCls(false)} resize-none`} />
        </Field>
      )}
    </div>
  );
}

function StepFour({ form, errors, set }: { form: BriefData; errors: Errs; set: <K extends keyof BriefData>(k: K, v: BriefData[K]) => void }) {
  return (
    <div className="space-y-6">
      <StepHeading marker="// 04 — Purpose" title="What's the main goal?" sub="What do you want the website to achieve?" />
      <div className="grid gap-2">
        {PURPOSES.map(p => {
          const sel = form.websitePurpose === p.id;
          return (
            <button key={p.id} onClick={() => set("websitePurpose", p.id)}
              className="flex items-center justify-between px-4 py-3.5 rounded-md text-left transition-all"
              style={{ border: `1px solid ${sel ? `${T.primary}80` : T.border}`, background: sel ? `${T.primary}0d` : `${T.surface2}66` }}>
              <div>
                <span className="text-sm block" style={{ color: sel ? T.fg : T.muted }}>{p.label}</span>
                <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>{p.desc}</span>
              </div>
              <div className="w-4 h-4 rounded-full shrink-0 ml-4 flex items-center justify-center" style={{ border: `1px solid ${sel ? T.primary : T.border}` }}>
                {sel && <div className="w-2 h-2 rounded-full" style={{ background: T.primary }} />}
              </div>
            </button>
          );
        })}
      </div>
      {errors.websitePurpose && <FieldError msg={errors.websitePurpose} />}
      <Field label="Tell us more" note="optional">
        <textarea value={form.purposeDetail} onChange={e => set("purposeDetail", e.target.value)} rows={4}
          placeholder="Describe your business, your audience, and what success looks like…" className={`${inputCls(false)} resize-none`} />
      </Field>
    </div>
  );
}

function StepFive({ form, errors, set }: { form: BriefData; errors: Errs; set: <K extends keyof BriefData>(k: K, v: BriefData[K]) => void }) {
  const pct = form.budget < BUDGET_MIN ? 0 : ((form.budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;
  return (
    <div className="space-y-6">
      <StepHeading marker="// 05 — Budget" title="Budget & timeline." sub="Helps us scope the right solution for you." />
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <FieldLabel>Approximate budget</FieldLabel>
          <span style={{ fontFamily: T.mono, fontWeight: 600, fontSize: "22px", lineHeight: 1, color: form.budget >= BUDGET_MIN ? T.primary : T.muted }}>
            {form.budget >= BUDGET_MIN ? formatBudget(form.budget) : "—"}
          </span>
        </div>
        <div className="relative py-3">
          <div className="relative h-1 rounded-full" style={{ background: T.surface2 }}>
            <div className="absolute left-0 top-0 h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: T.primary }} />
          </div>
          <input type="range" min={BUDGET_MIN} max={BUDGET_MAX} step={BUDGET_STEP}
            value={form.budget < BUDGET_MIN ? BUDGET_MIN : form.budget}
            onChange={e => set("budget", Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-7 top-1/2 -translate-y-1/2"
            style={{ WebkitAppearance: "none" }} />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none transition-all"
            style={{ left: `${pct}%`, background: T.primary, border: `2px solid ${T.bg}` }} />
        </div>
        <div className="flex justify-between" style={{ fontFamily: T.mono, fontSize: "11px", color: T.muted }}>
          <span>£500</span><span>£2.5k</span><span>£5k</span><span>£7.5k</span><span>£10k+</span>
        </div>
        {errors.budget && <FieldError msg={errors.budget} />}
      </div>

      <div className="space-y-2">
        <FieldLabel>Preferred timeline</FieldLabel>
        <div className="grid gap-2">
          {TIMELINES.map(t => {
            const sel = form.timeline === t.id;
            return (
              <button key={t.id} onClick={() => set("timeline", t.id)} className="py-2.5 px-4 rounded-md text-sm text-left transition-all"
                style={{ border: `1px solid ${sel ? `${T.primary}80` : T.border}`, background: sel ? `${T.primary}0d` : `${T.surface2}66`, color: sel ? T.fg : T.muted, fontFamily: T.mono, fontSize: "12px", textTransform: "uppercase" }}>
                {t.label}
              </button>
            );
          })}
        </div>
        {errors.timeline && <FieldError msg={errors.timeline} />}
      </div>

      <Field label="Anything else we should know?" note="optional">
        <textarea value={form.additionalNotes} onChange={e => set("additionalNotes", e.target.value)} rows={4}
          placeholder="Competitor sites you like, things to avoid, technical requirements…" className={`${inputCls(false)} resize-none`} />
      </Field>
    </div>
  );
}

/* ── Atoms ─────────────────────────────────────── */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm pb-3" style={{ borderBottom: `1px solid ${T.border}55` }}>
      <span style={{ fontFamily: T.mono, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", color: T.muted, width: "80px", flexShrink: 0, paddingTop: "2px" }}>{label}</span>
      <span style={{ color: T.fg }}>{value}</span>
    </div>
  );
}
function StepHeading({ marker, title, sub }: { marker: string; title: string; sub: string }) {
  return (
    <div className="mb-2">
      <p style={{ fontFamily: T.mono, fontSize: "10px", color: T.primary, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "8px" }}>{marker}</p>
      <h2 className="mb-2" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "2.25rem", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg, whiteSpace: "pre-line" }}>{title}</h2>
      <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.muted }}>{sub}</p>
    </div>
  );
}
function FieldLabel({ children }: { children: React.ReactNode }) { return <label className="block text-sm" style={{ fontFamily: T.sans, fontWeight: 500, color: T.fg }}>{children}</label>; }
function FieldError({ msg }: { msg?: string }) { if (!msg) return null; return <p className="flex items-center gap-1.5 mt-1.5" style={{ fontFamily: T.mono, fontSize: "11px", color: T.danger }}><AlertCircle className="w-3 h-3" /> {msg}</p>; }
function Field({ label, note, error, children }: { label: string; note?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm" style={{ fontFamily: T.sans, fontWeight: 500, color: T.fg }}>
        {label}
        {note && <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.muted }}>({note})</span>}
      </label>
      {children}
      {error && <FieldError msg={error} />}
    </div>
  );
}
function inputCls(err: boolean) { return `brief-input${err ? " brief-input-err" : ""}`; }
