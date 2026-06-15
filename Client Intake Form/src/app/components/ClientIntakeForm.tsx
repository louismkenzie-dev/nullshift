import { useState } from "react";
import { Check, ChevronRight, AlertCircle } from "lucide-react";

type FormData = {
  clientName: string;
  clientEmail: string;
  companyName: string;
  pages: string[];
  customPage: string;
  designStyle: string;
  hasLogo: string;
  logoNotes: string;
  websitePurpose: string;
  purposeDetail: string;
  budget: number;
  timeline: string;
  additionalNotes: string;
};

const PAGE_OPTIONS = [
  { id: "home", label: "Homepage" },
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "portfolio", label: "Portfolio / Work" },
  { id: "blog", label: "Blog" },
  { id: "contact", label: "Contact" },
  { id: "faq", label: "FAQ" },
  { id: "pricing", label: "Pricing" },
  { id: "team", label: "Team" },
  { id: "testimonials", label: "Testimonials" },
];

const DESIGN_STYLES = [
  { id: "minimal", label: "Minimal", desc: "Clean, lots of whitespace, understated" },
  { id: "bold", label: "Bold & Modern", desc: "Strong typography, high contrast, impactful" },
  { id: "editorial", label: "Editorial", desc: "Magazine-feel, content-forward, refined" },
  { id: "corporate", label: "Corporate", desc: "Professional, trustworthy, traditional" },
  { id: "creative", label: "Creative / Expressive", desc: "Experimental, unique, artistic" },
  { id: "dark", label: "Dark & Tech", desc: "Dark ground, neon accents, futuristic" },
];

const PURPOSES = [
  { id: "brand", label: "Brand Presence", desc: "Establish credibility and awareness" },
  { id: "leads", label: "Lead Generation", desc: "Capture enquiries and convert visitors" },
  { id: "ecommerce", label: "Sell Products / Services", desc: "Direct sales or bookings" },
  { id: "portfolio", label: "Showcase Work", desc: "Display projects, case studies, or creative work" },
  { id: "community", label: "Community / Content", desc: "Blog, forum, or membership platform" },
  { id: "app", label: "Web Application", desc: "Interactive tool or SaaS product" },
];

const BUDGET_MIN = 500;
const BUDGET_MAX = 50000;
const BUDGET_STEP = 500;

function formatBudget(val: number): string {
  if (val >= BUDGET_MAX) return "£50,000+";
  if (val < 1000) return `£${val}`;
  return `£${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
}

const TIMELINES = [
  { id: "asap", label: "As soon as possible" },
  { id: "1mo", label: "Within 1 month" },
  { id: "3mo", label: "1 – 3 months" },
  { id: "6mo", label: "3 – 6 months" },
  { id: "flexible", label: "Flexible" },
];

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "You" },
  { id: 2, label: "Pages" },
  { id: 3, label: "Style" },
  { id: 4, label: "Goals" },
  { id: 5, label: "Budget" },
];

export function ClientIntakeForm() {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | "pages", string>>>({});
  const [form, setForm] = useState<FormData>({
    clientName: "",
    clientEmail: "",
    companyName: "",
    pages: [],
    customPage: "",
    designStyle: "",
    hasLogo: "",
    logoNotes: "",
    websitePurpose: "",
    purposeDetail: "",
    budget: 0,
    timeline: "",
    additionalNotes: "",
  });

  const set = (key: keyof FormData, value: string | number) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const togglePage = (id: string) => {
    setForm((f) => ({
      ...f,
      pages: f.pages.includes(id) ? f.pages.filter((p) => p !== id) : [...f.pages, id],
    }));
    setErrors((e) => ({ ...e, pages: undefined }));
  };

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (step === 1) {
      if (!form.clientName.trim()) errs.clientName = "Required";
      if (!form.clientEmail.trim() || !/\S+@\S+\.\S+/.test(form.clientEmail))
        errs.clientEmail = "Valid email required";
    }
    if (step === 2 && form.pages.length === 0) errs.pages = "Select at least one page";
    if (step === 3) {
      if (!form.designStyle) errs.designStyle = "Please choose a style";
      if (!form.hasLogo) errs.hasLogo = "Required";
    }
    if (step === 4 && !form.websitePurpose) errs.websitePurpose = "Required";
    if (step === 5) {
      if (!form.budget || form.budget < BUDGET_MIN) errs.budget = "Please set a budget";
      if (!form.timeline) errs.timeline = "Required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    if (step < 5) setStep((s) => (s + 1) as Step);
    else setSubmitted(true);
  };

  const back = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Check className="w-5 h-5 text-primary" />
            </div>
            <span style={{ fontFamily: "var(--font-mono)" }} className="text-xs text-muted-foreground tracking-widest uppercase">// Brief received</span>
          </div>

          <h1
            style={{ fontFamily: "var(--font-display)", fontWeight: 900, lineHeight: 0.93, letterSpacing: "-0.01em", textTransform: "uppercase" }}
            className="text-5xl text-foreground mb-4"
          >
            WE'VE GOT<br />WHAT WE NEED.
          </h1>

          <p className="text-muted-foreground mb-10">
            Thanks, <span className="text-foreground">{form.clientName}</span>. We'll review your brief and be in touch within 1–2 business days with next steps.
          </p>

          <div className="bg-card border border-border rounded-lg p-6 space-y-3">
            <p style={{ fontFamily: "var(--font-mono)" }} className="text-xs text-muted-foreground tracking-widest uppercase mb-5">// Submission summary</p>
            <Row label="Name" value={form.clientName} />
            <Row label="Email" value={form.clientEmail} />
            {form.companyName && <Row label="Company" value={form.companyName} />}
            <Row label="Pages" value={form.pages.map((p) => PAGE_OPTIONS.find((o) => o.id === p)?.label ?? p).join(", ")} />
            <Row label="Style" value={DESIGN_STYLES.find((s) => s.id === form.designStyle)?.label ?? form.designStyle} />
            <Row label="Has logo" value={form.hasLogo === "yes" ? "Yes" : form.hasLogo === "no" ? "No" : "In progress"} />
            <Row label="Purpose" value={PURPOSES.find((p) => p.id === form.websitePurpose)?.label ?? form.websitePurpose} />
            <Row label="Budget" value={form.budget >= BUDGET_MIN ? formatBudget(form.budget) : "—"} />
            <Row label="Timeline" value={TIMELINES.find((t) => t.id === form.timeline)?.label ?? form.timeline} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, letterSpacing: "-0.01em", textTransform: "uppercase" }} className="text-xl text-foreground">
            NULLSHIFT
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
        </div>
        <span style={{ fontFamily: "var(--font-mono)" }} className="text-xs text-muted-foreground tracking-wider">
          // CLIENT BRIEF — {step}/5
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4">
        <div className="w-full max-w-xl">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => s.id < step && setStep(s.id)}
                  className={`flex items-center justify-center w-7 h-7 rounded-full border transition-all ${
                    s.id === step
                      ? "border-primary bg-primary/10 text-primary"
                      : s.id < step
                      ? "border-primary/40 bg-primary/5 text-primary/70 cursor-pointer hover:bg-primary/10"
                      : "border-border text-muted-foreground cursor-default"
                  }`}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
                >
                  {s.id < step ? <Check className="w-3 h-3" /> : s.id}
                </button>
                <span
                  className={`text-xs hidden sm:block ${s.id === step ? "text-foreground" : "text-muted-foreground"}`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-6 sm:w-8 ml-1 ${s.id < step ? "bg-primary/30" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="bg-card border border-border rounded-xl p-8 space-y-6">
            {step === 1 && <StepOne form={form} errors={errors} set={set} />}
            {step === 2 && <StepTwo form={form} errors={errors} togglePage={togglePage} set={set} />}
            {step === 3 && <StepThree form={form} errors={errors} set={set} />}
            {step === 4 && <StepFour form={form} errors={errors} set={set} />}
            {step === 5 && <StepFive form={form} errors={errors} set={set} />}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={back}
              className={`text-sm text-muted-foreground hover:text-foreground transition-colors ${step === 1 ? "invisible" : ""}`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ← BACK
            </button>
            <button
              onClick={next}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm hover:bg-primary/90 transition-all active:scale-95"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              {step === 5 ? "Submit Brief" : "Continue"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <span style={{ fontFamily: "var(--font-mono)" }} className="text-muted-foreground w-20 shrink-0 text-xs uppercase tracking-wider pt-0.5">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-destructive mt-1.5" style={{ fontFamily: "var(--font-mono)" }}>
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  );
}

function StepHeading({ marker, title, sub }: { marker: string; title: string; sub: string }) {
  return (
    <div className="mb-2">
      <p style={{ fontFamily: "var(--font-mono)" }} className="text-xs text-primary tracking-widest uppercase mb-2">{marker}</p>
      <h2
        style={{ fontFamily: "var(--font-display)", fontWeight: 900, lineHeight: 0.93, letterSpacing: "-0.01em", textTransform: "uppercase" }}
        className="text-4xl text-foreground mb-2"
      >
        {title}
      </h2>
      <p className="text-muted-foreground text-sm">{sub}</p>
    </div>
  );
}

function StepOne({ form, errors, set }: { form: FormData; errors: typeof errors; set: (k: keyof FormData, v: string | number) => void }) {
  return (
    <div className="space-y-5">
      <StepHeading marker="// 01 — Contact" title={"Let's start\nwith you."} sub="Basic contact details so we can follow up." />
      <Field label="Your name" error={errors.clientName}>
        <input type="text" value={form.clientName} onChange={(e) => set("clientName", e.target.value)}
          placeholder="Alex Johnson" className={inputCls(!!errors.clientName)} />
      </Field>
      <Field label="Email address" error={errors.clientEmail}>
        <input type="email" value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)}
          placeholder="alex@company.com" className={inputCls(!!errors.clientEmail)} />
      </Field>
      <Field label="Company / brand name" note="optional">
        <input type="text" value={form.companyName} onChange={(e) => set("companyName", e.target.value)}
          placeholder="Acme Ltd" className={inputCls(false)} />
      </Field>
    </div>
  );
}

function StepTwo({ form, errors, togglePage, set }: {
  form: FormData; errors: typeof errors;
  togglePage: (id: string) => void; set: (k: keyof FormData, v: string | number) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeading marker="// 02 — Pages" title="What pages do you need?" sub="Select all that apply. You can add custom pages below." />
      <div className="grid grid-cols-2 gap-2">
        {PAGE_OPTIONS.map((page) => {
          const checked = form.pages.includes(page.id);
          return (
            <button key={page.id} onClick={() => togglePage(page.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all ${
                checked ? "border-primary/50 bg-primary/5 text-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:border-[#505055] hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-all ${checked ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </div>
              {page.label}
            </button>
          );
        })}
      </div>
      {errors.pages && <FieldError msg={errors.pages} />}
      <Field label="Any other pages?" note="optional">
        <input type="text" value={form.customPage} onChange={(e) => set("customPage", e.target.value)}
          placeholder="e.g. Case studies, Press, Login" className={inputCls(false)} />
      </Field>
    </div>
  );
}

function StepThree({ form, errors, set }: { form: FormData; errors: typeof errors; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <StepHeading marker="// 03 — Style" title="Style &amp; branding." sub="What direction do you want the design to take?" />

      <div className="space-y-2">
        <FieldLabel>Design style</FieldLabel>
        <div className="grid gap-2">
          {DESIGN_STYLES.map((style) => (
            <button key={style.id} onClick={() => set("designStyle", style.id)}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all group ${
                form.designStyle === style.id ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/40 hover:border-[#505055]"
              }`}
            >
              <div>
                <span className={`text-sm block ${form.designStyle === style.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground transition-colors"}`}>
                  {style.label}
                </span>
                <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{style.desc}</span>
              </div>
              <div className={`w-4 h-4 rounded-full border shrink-0 ml-4 flex items-center justify-center transition-all ${form.designStyle === style.id ? "border-primary" : "border-border"}`}>
                {form.designStyle === style.id && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
            </button>
          ))}
        </div>
        {errors.designStyle && <FieldError msg={errors.designStyle} />}
      </div>

      <div className="space-y-2">
        <FieldLabel>Do you have a logo?</FieldLabel>
        <div className="flex gap-2">
          {[{ id: "yes", label: "Yes, ready" }, { id: "wip", label: "In progress" }, { id: "no", label: "Not yet" }].map((opt) => (
            <button key={opt.id} onClick={() => set("hasLogo", opt.id)}
              className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                form.hasLogo === opt.id ? "border-primary/50 bg-primary/5 text-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-[#505055]"
              }`}
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.02em" }}
            >
              {opt.label.toUpperCase()}
            </button>
          ))}
        </div>
        {errors.hasLogo && <FieldError msg={errors.hasLogo} />}
      </div>

      {(form.hasLogo === "yes" || form.hasLogo === "wip") && (
        <Field label="Logo / branding notes" note="optional">
          <textarea value={form.logoNotes} onChange={(e) => set("logoNotes", e.target.value)}
            placeholder="Existing brand colours, fonts, any files you already have…"
            rows={3} className={`${inputCls(false)} resize-none`} />
        </Field>
      )}
    </div>
  );
}

function StepFour({ form, errors, set }: { form: FormData; errors: typeof errors; set: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <StepHeading marker="// 04 — Purpose" title="What's the main goal?" sub="What do you want the website to achieve?" />
      <div className="grid gap-2">
        {PURPOSES.map((purpose) => (
          <button key={purpose.id} onClick={() => set("websitePurpose", purpose.id)}
            className={`flex items-center justify-between px-4 py-3.5 rounded-lg border text-left transition-all group ${
              form.websitePurpose === purpose.id ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/40 hover:border-[#505055]"
            }`}
          >
            <div>
              <span className={`text-sm block ${form.websitePurpose === purpose.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground transition-colors"}`}>
                {purpose.label}
              </span>
              <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{purpose.desc}</span>
            </div>
            <div className={`w-4 h-4 rounded-full border shrink-0 ml-4 flex items-center justify-center transition-all ${form.websitePurpose === purpose.id ? "border-primary" : "border-border"}`}>
              {form.websitePurpose === purpose.id && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
          </button>
        ))}
      </div>
      {errors.websitePurpose && <FieldError msg={errors.websitePurpose} />}
      <Field label="Tell us more" note="optional">
        <textarea value={form.purposeDetail} onChange={(e) => set("purposeDetail", e.target.value)}
          placeholder="Describe your business, your audience, and what success looks like…"
          rows={4} className={`${inputCls(false)} resize-none`} />
      </Field>
    </div>
  );
}

function StepFive({ form, errors, set }: { form: FormData; errors: typeof errors; set: (k: keyof FormData, v: string | number) => void }) {
  const pct = form.budget < BUDGET_MIN
    ? 0
    : ((form.budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;

  return (
    <div className="space-y-6">
      <StepHeading marker="// 05 — Budget" title="Budget &amp; timeline." sub="Helps us scope the right solution for you." />

      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <FieldLabel>Approximate budget</FieldLabel>
          <span
            className={`transition-colors ${form.budget >= BUDGET_MIN ? "text-primary" : "text-muted-foreground"}`}
            style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "22px", lineHeight: 1 }}
          >
            {form.budget >= BUDGET_MIN ? formatBudget(form.budget) : "—"}
          </span>
        </div>

        <div className="relative py-3">
          {/* Track background */}
          <div className="relative h-1 rounded-full bg-secondary">
            {/* Filled portion */}
            <div
              className="absolute left-0 top-0 h-1 rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <input
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            value={form.budget < BUDGET_MIN ? BUDGET_MIN : form.budget}
            onChange={(e) => set("budget", Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-7 top-1/2 -translate-y-1/2"
            style={{ WebkitAppearance: "none" }}
          />
          {/* Thumb overlay */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-md shadow-primary/20 transition-all pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="flex justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          <span className="text-muted-foreground">£500</span>
          <span className="text-muted-foreground">£10k</span>
          <span className="text-muted-foreground">£25k</span>
          <span className="text-muted-foreground">£50k+</span>
        </div>

        {errors.budget && <FieldError msg={errors.budget} />}
      </div>

      <div className="space-y-2">
        <FieldLabel>Preferred timeline</FieldLabel>
        <div className="grid gap-2">
          {TIMELINES.map((t) => (
            <button key={t.id} onClick={() => set("timeline", t.id)}
              className={`py-2.5 px-4 rounded-lg border text-sm text-left transition-all ${
                form.timeline === t.id ? "border-primary/50 bg-primary/5 text-foreground" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-[#505055]"
              }`}
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>
        {errors.timeline && <FieldError msg={errors.timeline} />}
      </div>

      <Field label="Anything else we should know?" note="optional">
        <textarea value={form.additionalNotes} onChange={(e) => set("additionalNotes", e.target.value)}
          placeholder="Competitor sites you like, things to avoid, technical requirements…"
          rows={4} className={`${inputCls(false)} resize-none`} />
      </Field>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm text-foreground" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
      {children}
    </label>
  );
}

function Field({ label, note, error, children }: {
  label: string; note?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm text-foreground" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
        {label}
        {note && <span className="text-xs text-muted-foreground font-normal" style={{ fontFamily: "var(--font-mono)" }}>({note})</span>}
      </label>
      {children}
      {error && <FieldError msg={error} />}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full bg-input-background border ${hasError ? "border-destructive/50" : "border-border"} rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all text-sm`;
}
