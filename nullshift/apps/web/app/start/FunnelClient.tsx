"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@/components/Logo";
import { visibleSteps, scoreLead, type Answers, type Segment, type Recommendation } from "@/lib/funnel";
import { funnelSound } from "@/lib/funnelAudio";
import { ProgressBar } from "@/components/funnel/ProgressBar";
import { QuestionCard } from "@/components/funnel/QuestionCard";
import { Atmosphere } from "@/components/funnel/Atmosphere";
import { SoundToggle } from "@/components/funnel/SoundToggle";
import { HoldScreen } from "@/components/funnel/HoldScreen";
import { CaptureForm, type CaptureContact } from "@/components/funnel/CaptureForm";
import { ResultQualified } from "@/components/funnel/ResultQualified";
import { ResultNurture } from "@/components/funnel/ResultNurture";

/* ── State machine ──────────────────────────────────────────────── */

type Status = "question" | "holding" | "capturing" | "result";
type Contact = { name: string; email: string; phone: string };
type State = {
  index: number;
  answers: Answers;
  status: Status;
  segment?: Segment;
  recommendation?: Recommendation;
  contact?: Contact;
};

type Action =
  | { type: "ANSWER"; stepId: string; value: string; otherText?: string }
  | { type: "SKIP" }
  | { type: "GOTO"; index: number }
  | { type: "HOLD_DONE"; segment: Segment; recommendation: Recommendation }
  | { type: "CAPTURED"; contact: Contact }
  | { type: "RESET" }
  | { type: "HYDRATE"; state: Partial<State> };

const STORAGE_KEY = "ns_funnel_v1";

/** The number of questions shown for a given answer set (conditional). */
const stepCount = (a: Answers) => visibleSteps(a).length;
const statusFor = (i: number, a: Answers): Status => (i >= stepCount(a) ? "holding" : "question");

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ANSWER": {
      const answers = { ...state.answers, [action.stepId]: action.value };
      if (action.otherText !== undefined) answers[`${action.stepId}_other`] = action.otherText;
      const index = Math.min(state.index + 1, stepCount(answers));
      return { ...state, index, answers, status: statusFor(index, answers) };
    }
    case "SKIP": {
      const index = Math.min(state.index + 1, stepCount(state.answers));
      return { ...state, index, status: statusFor(index, state.answers) };
    }
    case "GOTO": {
      const index = Math.max(0, Math.min(action.index, stepCount(state.answers)));
      return { ...state, index, status: statusFor(index, state.answers) };
    }
    case "HOLD_DONE":
      return { ...state, status: "capturing", segment: action.segment, recommendation: action.recommendation };
    case "CAPTURED":
      return { ...state, status: "result", contact: action.contact };
    case "RESET":
      return { index: 0, answers: {}, status: "question" };
    case "HYDRATE":
      return { ...state, ...action.state };
    default:
      return state;
  }
}

/* ── URL ⇄ step helpers (answer-aware, since steps are conditional) ── */

function stepIdForIndex(a: Answers, i: number): string {
  const steps = visibleSteps(a);
  return i >= steps.length ? "summary" : steps[i].id;
}
function indexForStepId(a: Answers, id: string | null): number {
  const steps = visibleSteps(a);
  if (id === "summary") return steps.length;
  if (!id) return 0;
  const i = steps.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}
/** Furthest a visitor may legitimately be — clamps shared deep-links. */
function firstIncompleteIndex(a: Answers): number {
  const steps = visibleSteps(a);
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i].optional && !a[steps[i].id]) return i;
  }
  return steps.length;
}

/* ── Component ──────────────────────────────────────────────────── */

export function FunnelClient() {
  const [state, dispatch] = useReducer(reducer, { index: 0, answers: {}, status: "question" });
  const reduce = useReducedMotion();
  const answersRef = useRef(state.answers);
  answersRef.current = state.answers;
  const utmRef = useRef<Record<string, string>>({});

  const syncUrl = useCallback((index: number, mode: "push" | "replace", answers: Answers) => {
    const url = `/start?step=${stepIdForIndex(answers, index)}`;
    const data = { nsFunnelIndex: index };
    if (mode === "push") window.history.pushState(data, "", url);
    else window.history.replaceState(data, "", url);
  }, []);

  // Hydrate once: answers from sessionStorage, step from URL (clamped), and
  // capture UTM attribution from the landing URL before we rewrite it.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const v = params.get(k);
      if (v) utm[k.replace("utm_", "")] = v;
    }
    if (document.referrer) utm.referrer = document.referrer;
    utmRef.current = utm;

    let answers: Answers = {};
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) answers = (JSON.parse(raw)?.answers as Answers) ?? {};
    } catch {
      /* storage unavailable */
    }

    const index = Math.min(indexForStepId(answers, params.get("step")), firstIncompleteIndex(answers));
    dispatch({ type: "HYDRATE", state: { index, answers, status: statusFor(index, answers) } });
    syncUrl(index, "replace", answers);
  }, [syncUrl]);

  // Browser / UI Back → popstate → restore that step.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const fromState = e.state?.nsFunnelIndex;
      const a = answersRef.current;
      const idx =
        typeof fromState === "number"
          ? fromState
          : indexForStepId(a, new URLSearchParams(window.location.search).get("step"));
      dispatch({ type: "GOTO", index: Math.min(idx, firstIncompleteIndex(a)) });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Persist answers so a refresh resumes (sessionStorage, not localStorage).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: state.answers }));
    } catch {
      /* ignore */
    }
  }, [state.answers]);

  const steps = visibleSteps(state.answers);
  const total = steps.length;
  const current = Math.min(state.index + 1, total);
  const step = state.index < steps.length ? steps[state.index] : null;

  /* ── Handlers ── */
  const handleSelect = (value: string, otherText?: string) => {
    funnelSound.unlock();
    funnelSound.answer(state.index, total);
    const s = steps[state.index];
    const newAnswers: Answers = { ...state.answers, [s.id]: value };
    if (otherText !== undefined) newAnswers[`${s.id}_other`] = otherText;
    dispatch({ type: "ANSWER", stepId: s.id, value, otherText });
    syncUrl(state.index + 1, "push", newAnswers);
  };
  const handleSkip = () => {
    funnelSound.unlock();
    funnelSound.back();
    dispatch({ type: "SKIP" });
    syncUrl(state.index + 1, "push", state.answers);
  };
  const handleBack = () => {
    funnelSound.back();
    window.history.back();
  };
  const handleReset = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    funnelSound.back();
    dispatch({ type: "RESET" });
    syncUrl(0, "push", {});
  };
  const handleHoldDone = (r: ReturnType<typeof scoreLead>) => {
    dispatch({ type: "HOLD_DONE", segment: r.segment, recommendation: r.recommendation });
  };
  const handleCapture = async (c: CaptureContact) => {
    // Remember the email so the signup wizard can auto-populate it downstream.
    try {
      localStorage.setItem("ns_email", c.email);
      if (c.name) localStorage.setItem("ns_name", c.name);
    } catch {
      /* ignore */
    }
    // Persist the lead in the background — fire-and-forget so the visitor's
    // result reveals instantly and is never gated on the network.
    void fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: answersRef.current,
        contact: { name: c.name, email: c.email, phone: c.phone },
        utm: utmRef.current,
        website: c.website,
        elapsedMs: c.elapsedMs,
      }),
    }).catch(() => {
      /* ignore — the result is the value to the visitor */
    });
    dispatch({ type: "CAPTURED", contact: { name: c.name, email: c.email, phone: c.phone } });
  };

  const panel: Variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: { opacity: 0, x: 28, filter: "blur(8px)" },
        center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, x: -24, filter: "blur(8px)", transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
      };
  const fade: Variants = reduce
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: { opacity: 0, scale: 0.98, filter: "blur(8px)" },
        center: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
        exit: { opacity: 0, scale: 1.01, filter: "blur(8px)", transition: { duration: 0.25 } },
      };

  const viewKey =
    state.status === "question" ? `q-${step?.id}` : state.status === "holding" ? "hold" : state.status === "capturing" ? "capture" : "result";

  return (
    <main className="relative min-h-[100dvh] flex flex-col" style={{ background: T.bg }}>
      <Atmosphere />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8" style={{ height: 64 }}>
        <Link href="/" aria-label="Nullshift home">
          <Logo markSize={18} />
        </Link>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <Link
            href="/"
            style={{ fontFamily: T.mono, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: T.faint }}
          >
            Exit
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 sm:px-8 py-10">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" initial={false}>
            {state.status === "question" && step && (
              <motion.div key={viewKey} variants={panel} initial="enter" animate="center" exit="exit">
                <ProgressBar current={current} total={total} />
                <div className="mt-10">
                  <QuestionCard
                    step={step}
                    index={current}
                    total={total}
                    selected={state.answers[step.id]}
                    otherValue={state.answers[`${step.id}_other`]}
                    onSelect={handleSelect}
                    onSkip={step.optional ? handleSkip : undefined}
                  />
                </div>
                {state.index === 0 && (
                  <div
                    className="mt-7 inline-flex items-center gap-2.5"
                    style={{
                      padding: "9px 14px",
                      borderRadius: 999,
                      border: `1px solid ${T.border}`,
                      background: T.surface,
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 14 }}>🎁</span>
                    <span style={{ fontFamily: T.sans, fontSize: "0.8125rem", color: T.muted }}>
                      Takes under a minute — and you&apos;ll get a <span style={{ color: T.fg, fontWeight: 500 }}>free resource</span> tailored to your business.
                    </span>
                  </div>
                )}
                <div className="mt-10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="transition-colors"
                    style={{
                      fontFamily: T.mono,
                      fontSize: "12px",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: T.muted,
                      visibility: state.index === 0 ? "hidden" : "visible",
                    }}
                  >
                    ← Back
                  </button>
                  <span style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", color: T.faint }}>Tap to continue</span>
                </div>
              </motion.div>
            )}

            {state.status === "holding" && (
              <motion.div key={viewKey} variants={fade} initial="enter" animate="center" exit="exit">
                <HoldScreen answers={state.answers} onResult={handleHoldDone} />
              </motion.div>
            )}

            {state.status === "capturing" && (
              <motion.div key={viewKey} variants={fade} initial="enter" animate="center" exit="exit">
                <CaptureForm onCapture={handleCapture} />
              </motion.div>
            )}

            {state.status === "result" && state.recommendation && (
              <motion.div key={viewKey} variants={fade} initial="enter" animate="center" exit="exit">
                {state.segment === "qualified" ? (
                  <ResultQualified
                    recommendation={state.recommendation}
                    answers={state.answers}
                    contact={state.contact}
                    onRestart={handleReset}
                  />
                ) : (
                  <ResultNurture
                    recommendation={state.recommendation}
                    answers={state.answers}
                    contact={state.contact}
                    onRestart={handleReset}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
