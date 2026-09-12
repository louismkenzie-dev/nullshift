"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ClientStory } from "@nullshift/content/clientStories";
import { T } from "@nullshift/ui/tokens";
import { DemoShowcase } from "./DemoShowcase";
import {
  CursorLayer,
  ScaledStage,
  gbp,
  useElapsed,
  useTweenNumber,
  type DemoStep,
} from "./engine";
import { tdeBody, tdeDisplay } from "./fonts";
import {
  MONTHLY_PAYMENT_INFO,
  MONTHLY_WEEKS_MULTIPLIER,
  UNLIMITED_MONTHLY_CAP,
  additionalMonthlyPrice,
  childAdditionalWeeklyRate,
  computeSiblingDiscount,
  durationMinutes,
  monthlyPrice,
  priceMonthlyItems,
  round2,
  sessionPrice,
  type ExistingEnrolment,
  type PricedClass,
} from "./tde/pricing";
import {
  chargesFirstMonthAtSignup,
  firstBillingAnchor,
  freeMonthFor,
} from "./tde/billing";

/* ────────────────────────────────────────────────────────────────
   The Dance Exclusive — the parent checkout, reproduced from the client's
   `pages/portal/Checkout.tsx` + `components/booking/CheckoutSummary.tsx`
   (their `.theme-children` light palette, Inter body, Oswald chrome). Every
   number on screen is computed at render time by the client's own pricing
   engine, ported verbatim into `./tde/pricing.ts` — the same file that runs
   in their Stripe edge function.
   ──────────────────────────────────────────────────────────────── */

/* .theme-children — the parent booking journey, from their index.css */
const TDE = {
  bg: "hsl(36 22% 97.5%)",
  fg: "hsl(222 16% 11%)",
  card: "#ffffff",
  primary: "hsl(193 100% 30%)",
  primaryFg: "#ffffff",
  muted: "hsl(36 14% 94%)",
  mutedFg: "hsl(222 8% 44%)",
  accent: "hsl(193 80% 94%)",
  accentFg: "hsl(193 100% 24%)",
  border: "hsl(36 12% 89%)",
  success: "hsl(152 58% 31%)",
  brand: "hsl(193 100% 44%)",
} as const;

const body = "var(--demo-tde-body), Inter, system-ui, sans-serif";
const display = "var(--demo-tde-display), Oswald, sans-serif";

/* From their checkoutItemText.ts */
const CHECKOUT_PLAN_LABEL = { monthly: "Monthly membership" } as const;

type DemoClass = {
  classId: string;
  name: string;
  day: string;
  start: string;
  end: string;
  venue: string;
};

/* Derived pricing: every price_per_* is null, so the engine's published
   rates apply (£9 / 60 min, £8 / 45 min; additional £7.75 / £6.75). */
const priced = (c: DemoClass): PricedClass => ({
  class_type: "children",
  start_time: c.start,
  end_time: c.end,
  price_per_session: null,
  price_per_term: null,
  price_per_month: null,
  price_per_year: null,
});

const COMMERCIAL: DemoClass = {
  classId: "cls-commercial-60",
  name: "Commercial",
  day: "Mondays",
  start: "17:00",
  end: "18:00",
  venue: "Kelvedon Institute",
};
const STREET: DemoClass = {
  classId: "cls-street-45",
  name: "Street Dance",
  day: "Wednesdays",
  start: "17:00",
  end: "17:45",
  venue: "Kelvedon Institute",
};
const ACRO: DemoClass = {
  classId: "cls-acro-60",
  name: "Acro",
  day: "Fridays",
  start: "18:00",
  end: "19:00",
  venue: "Kelvedon Institute",
};

type Row = { id: string; student: "Poppy" | "Theo"; cls: DemoClass };

const STUDENT_ID = { Poppy: "child-poppy", Theo: "child-theo" } as const;

const fmtTime = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}` : `${hh}`;
};
/** Their scheduleLine(): "Mondays · 5:00–5:45pm · Kelvedon Institute" */
const scheduleLine = (c: DemoClass) =>
  `${c.day} · ${fmtTime(c.start)}–${fmtTime(c.end)}${c.end >= "12:00" ? "pm" : "am"} · ${c.venue}`;

/** A fixed "today" so the billing trace is deterministic. */
const NOW = new Date("2026-09-11T10:00:00Z");
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STEPS: DemoStep[] = [
  {
    id: "one",
    label: "One class, one price",
    hold: 4200,
    caption:
      "A 60-minute children's class derives its £9 weekly rate from its start and end time, then × 3.4 gives the £30.60 monthly membership — the studio never types a price it doesn't want to.",
  },
  {
    id: "second",
    label: "A second class, cheaper",
    hold: 5200,
    caption:
      "priceMonthlyItems() ranks a child's classes most-expensive first: the first is full price, every further class drops to the additional-class rate (£6.75 × 3.4 = £22.95). The summary shows the saving as its own line.",
  },
  {
    id: "sibling",
    label: "A sibling, automatically",
    hold: 5200,
    caption:
      "computeSiblingDiscount() ranks the family's children by eligible spend; the highest is treated as the first child and everyone else gets 10% off — no code to type, and never on adult bookings.",
  },
  {
    id: "cap",
    label: "The £110 Unlimited cap",
    hold: 5600,
    caption:
      "Later in the term Poppy adds a fifth class. The engine remembers her live memberships from earlier checkouts (four classes, £109.65 a month), so this one costs the 35p to the cap and everything after it is free.",
  },
  {
    id: "server",
    label: "Checked twice",
    hold: 5600,
    caption:
      "At payment the Stripe edge function re-prices the basket with the same engine and refuses any line that differs by more than a penny. Billing lands on the 5th, and the 12th month is free — for a September starter, that's August.",
  },
];

export function TdePricingDemo({
  story,
}: {
  story: ClientStory;
  theme: "dark" | "cream";
}) {
  return (
    <DemoShowcase
      steps={STEPS}
      url={story.liveUrl}
      caption={`${story.displayUrl}/portal/checkout`}
      tint={story.brand.primary}
      eyebrow="Reproduced from their codebase · Checkout.tsx · CheckoutSummary.tsx · lib/pricing.ts"
      title="Amie's pricing engine — the parent checkout, priced by the real code"
    >
      {(step, clock) => (
        <ScaledStage
          width={1200}
          height={640}
          compactWidth={600}
          compactHeight={1120}
          background={TDE.bg}
        >
          {(compact) => (
            <CursorLayer color={TDE.fg}>
              {(cursorTo) => (
                <Scene step={step} clock={clock} compact={compact} cursorTo={cursorTo} />
              )}
            </CursorLayer>
          )}
        </ScaledStage>
      )}
    </DemoShowcase>
  );
}

/* ── Pricing the scene with the client's engine ─────────────────── */

type TraceRow = { code: string; value: string; tone?: "accent" | "muted" | "warn" };

function priceScene(step: number) {
  const rows: Row[] =
    step === 3
      ? [{ id: "acro", student: "Poppy", cls: ACRO }]
      : [
          { id: "commercial", student: "Poppy", cls: COMMERCIAL },
          ...(step >= 1
            ? [{ id: "street", student: "Poppy" as const, cls: STREET }]
            : []),
          ...(step >= 2
            ? [{ id: "theo", student: "Theo" as const, cls: COMMERCIAL }]
            : []),
        ];

  // Step 3: Poppy's memberships from earlier checkouts (the engine's memory).
  const existing =
    step === 3
      ? new Map<string, ExistingEnrolment>([
          [STUDENT_ID.Poppy, { count: 4, monthlyTotal: 109.65 }],
        ])
      : undefined;

  const monthly = priceMonthlyItems(
    rows.map((r) => ({
      id: r.id,
      classId: r.cls.classId,
      studentId: STUDENT_ID[r.student],
      fullMonthly: monthlyPrice(priced(r.cls)),
      additionalMonthly: additionalMonthlyPrice(priced(r.cls)),
    })),
    existing
  );

  const sibling = computeSiblingDiscount(
    rows.map((r) => ({
      id: r.id,
      studentId: STUDENT_ID[r.student],
      isSelfStudent: false,
      classType: "children" as const,
      siblingDiscountEnabled: true,
      totalPrice: monthly.get(r.id) ?? 0,
    }))
  );

  const lines = rows.map((r) => {
    const full = monthlyPrice(priced(r.cls));
    const charged = monthly.get(r.id) ?? full;
    return { ...r, full, charged, siblingOff: sibling.perItem.get(r.id) ?? 0 };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.full, 0));
  const multiClassDiscount = round2(lines.reduce((s, l) => s + (l.full - l.charged), 0));
  const siblingDiscount = sibling.total;
  const total = round2(subtotal - multiClassDiscount - siblingDiscount);
  const capReached =
    step === 3 &&
    (existing?.get(STUDENT_ID.Poppy)?.monthlyTotal ?? 0) + (monthly.get("acro") ?? 0) >=
      UNLIMITED_MONTHLY_CAP;

  /* The trace — what the engine did, in its own terms. */
  const trace: TraceRow[] = [];
  const first = lines[0];
  if (first) {
    const mins = durationMinutes(first.cls.start, first.cls.end);
    trace.push({
      code: `durationMinutes("${first.cls.start}", "${first.cls.end}")`,
      value: `${mins} min`,
    });
    trace.push({
      code: "sessionPrice(cls)",
      value: `${gbp(sessionPrice(priced(first.cls)))} · children's ${mins}-min rate`,
    });
    trace.push({
      code: "monthlyPrice(cls)",
      value: `${sessionPrice(priced(first.cls)).toFixed(2)} × ${MONTHLY_WEEKS_MULTIPLIER} = ${gbp(monthlyPrice(priced(first.cls)))}`,
      tone: "accent",
    });
  }
  if (step >= 1) {
    trace.push({
      code: existing
        ? "priceMonthlyItems(items, existingByStudent)"
        : "priceMonthlyItems(items)",
      value: "per child, most expensive first",
    });
    const byChild = new Map<string, typeof lines>();
    for (const l of lines) byChild.set(l.student, [...(byChild.get(l.student) ?? []), l]);
    for (const [student, ls] of byChild) {
      const ex = existing?.get(STUDENT_ID[student as "Poppy" | "Theo"]);
      if (ex)
        trace.push({
          code: `  ${student.toLowerCase()} · existing`,
          value: `${ex.count} live memberships · ${gbp(ex.monthlyTotal)}/mo`,
          tone: "muted",
        });
      const sorted = [...ls].sort(
        (a, b) => b.full - a.full || a.cls.classId.localeCompare(b.cls.classId)
      );
      sorted.forEach((l, i) => {
        const rank = i + (ex?.count ?? 0) + 1;
        const additional = rank > 1;
        const capped = additional && l.charged < additionalMonthlyPrice(priced(l.cls));
        trace.push({
          code: `  ${student.toLowerCase()} · rank ${rank} · ${l.cls.name}`,
          value: capped
            ? `min(${gbp(additionalMonthlyPrice(priced(l.cls)))}, ${UNLIMITED_MONTHLY_CAP} − ${ex?.monthlyTotal.toFixed(2)}) = ${gbp(l.charged)}`
            : additional
              ? `additional · ${childAdditionalWeeklyRate(priced(l.cls)).toFixed(2)} × ${MONTHLY_WEEKS_MULTIPLIER} = ${gbp(l.charged)}`
              : `full · ${gbp(l.charged)}`,
          tone: capped ? "warn" : additional ? "accent" : undefined,
        });
      });
    }
  }
  if (step >= 2 && step !== 3) {
    trace.push({
      code: "computeSiblingDiscount(items)",
      value: "ranked by eligible spend",
    });
    const spend = new Map<string, number>();
    for (const l of lines)
      spend.set(l.student, round2((spend.get(l.student) ?? 0) + l.charged));
    trace.push({
      code: "  spend",
      value: [...spend.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([s, v]) => `${s.toLowerCase()} ${gbp(v)}`)
        .join(" · "),
      tone: "muted",
    });
    for (const l of lines) {
      if (l.siblingOff > 0)
        trace.push({
          code: `  ${l.student.toLowerCase()} · 10% off`,
          value: `−${gbp(l.siblingOff)}`,
          tone: "accent",
        });
    }
  }
  if (step === 3) {
    trace.push({
      code: `UNLIMITED_MONTHLY_CAP`,
      value: `${gbp(UNLIMITED_MONTHLY_CAP)} · every extra class included`,
      tone: "warn",
    });
  }
  if (step === 4) {
    trace.push({
      code: "create-payment-intent · re-price",
      value: `${lines.length} line${lines.length === 1 ? "" : "s"} · |expected − sent| ≤ £0.01 ✓`,
      tone: "accent",
    });
    trace.push({
      code: "chargesFirstMonthAtSignup(now)",
      value: chargesFirstMonthAtSignup(NOW)
        ? "true · first month paid today"
        : "false · card saved, first charge 5 Sep",
    });
    const anchor = firstBillingAnchor(NOW);
    trace.push({
      code: "firstBillingAnchor(now)",
      value: `${anchor.getUTCDate()} ${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()} · trial_end on the subscription`,
    });
    trace.push({
      code: "freeMonthFor(now)",
      value: `${MONTHS[freeMonthFor(NOW) - 1]} · 11 paid months, the 12th free`,
      tone: "accent",
    });
  }

  return {
    lines,
    existing,
    subtotal,
    multiClassDiscount,
    siblingDiscount,
    total,
    capReached,
    trace,
  };
}

/* ── The scene ─────────────────────────────────────────────────── */

function Scene({
  step,
  clock,
  compact,
  cursorTo,
}: {
  step: number;
  clock: string;
  compact: boolean;
  cursorTo: (el: HTMLElement | null) => void;
}) {
  const t = useElapsed(clock);
  const scene = useMemo(() => priceScene(step), [step]);
  const lastRowRef = useRef<HTMLDivElement>(null);
  const payRef = useRef<HTMLButtonElement>(null);

  // Rows appear with a beat so the totals visibly re-run.
  const revealed =
    step === 0 || step === 3
      ? scene.lines.length
      : t > 700
        ? scene.lines.length
        : scene.lines.length - 1;
  const visible = scene.lines.slice(0, Math.max(1, revealed));
  const shown = useMemo(() => priceSubset(step, visible.length), [step, visible.length]);

  const beat =
    step === 4 ? "pay" : step >= 1 && step <= 3 ? `row-${step}-${revealed}` : "idle";
  useEffect(() => {
    if (beat === "pay") cursorTo(payRef.current);
    else if (beat.startsWith("row") && revealed === scene.lines.length && step !== 0)
      cursorTo(lastRowRef.current);
    else cursorTo(null);
  }, [beat, cursorTo, revealed, scene.lines.length, step]);

  const subtotal = useTweenNumber(shown.subtotal);
  const multi = useTweenNumber(shown.multiClassDiscount);
  const sib = useTweenNumber(shown.siblingDiscount);
  const total = useTweenNumber(shown.total);

  return (
    <div
      className={`${tdeBody.variable} ${tdeDisplay.variable}`}
      style={{
        display: "flex",
        flexDirection: compact ? "column" : "row",
        width: "100%",
        height: "100%",
        fontFamily: body,
        color: TDE.fg,
      }}
    >
      {/* ── Product ── */}
      <div
        style={{
          width: compact ? 600 : 760,
          height: compact ? 720 : 640,
          background: TDE.bg,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Portal chrome — the wordmark, not the splat */}
        <div
          style={{
            height: 46,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: TDE.card,
            borderBottom: `1px solid ${TDE.border}`,
          }}
        >
          <span
            style={{
              fontFamily: display,
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            The Dance <span style={{ color: TDE.brand }}>Exclusive</span>
          </span>
          <span style={{ fontSize: 12, color: TDE.mutedFg }}>
            Parent portal · Checkout
          </span>
        </div>

        <div
          style={{
            flex: 1,
            padding: compact ? "18px 20px" : "22px 24px",
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "1fr 300px",
            gap: 18,
            alignContent: "start",
          }}
        >
          {/* Basket */}
          <div>
            <h1
              style={{
                margin: "0 0 4px",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.025em",
              }}
            >
              Checkout
            </h1>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: TDE.mutedFg }}>
              {step === 3
                ? "New checkout · later in the term"
                : "Classes for your children"}
            </p>

            <AnimatePresence initial={false}>
              {step === 3 && scene.existing && (
                <motion.div
                  key="existing"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    ...surface,
                    padding: "10px 14px",
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: TDE.accent,
                    borderColor: "transparent",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: TDE.accentFg, fontWeight: 600 }}>
                    Poppy already has 4 monthly memberships
                  </span>
                  <span style={{ fontSize: 12.5, color: TDE.accentFg }}>
                    £109.65 / month
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ ...surface, overflow: "hidden" }}>
              <AnimatePresence initial={false}>
                {visible.map((l, i) => {
                  const isLast = i === visible.length - 1;
                  const chargedNow = shown.lines[i]?.charged ?? l.charged;
                  return (
                    <motion.div
                      key={`${step === 3 ? "later" : "now"}-${l.id}`}
                      ref={isLast ? lastRowRef : undefined}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 12,
                        padding: "12px 14px",
                        borderTop: i === 0 ? "none" : `1px solid ${TDE.border}`,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14.5,
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {l.cls.name}
                        </div>
                        <div style={{ fontSize: 12, color: TDE.mutedFg, marginTop: 2 }}>
                          for {l.student} · {CHECKOUT_PLAN_LABEL.monthly}
                        </div>
                        <div style={{ fontSize: 12, color: TDE.mutedFg }}>
                          {scheduleLine(l.cls)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 14.5,
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          <Money value={chargedNow} />
                          <span
                            style={{ fontSize: 11, color: TDE.mutedFg, fontWeight: 400 }}
                          >
                            {" "}
                            /month
                          </span>
                        </div>
                        {chargedNow < l.full - 0.005 && (
                          <div
                            style={{
                              fontSize: 11,
                              color: TDE.mutedFg,
                              textDecoration: "line-through",
                            }}
                          >
                            {gbp(l.full)}
                          </div>
                        )}
                        {l.siblingOff > 0 && (
                          <div style={{ fontSize: 11, color: TDE.success }}>
                            Sibling −{gbp(l.siblingOff)}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {shown.capReached && (
                <motion.p
                  key="cap"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    margin: "12px 2px 0",
                    fontSize: 12.5,
                    color: TDE.accentFg,
                    fontWeight: 600,
                  }}
                >
                  £110 cap reached — every extra class for this child is free.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* CheckoutSummaryCard */}
          <div style={{ ...surface, padding: 16, alignSelf: "start" }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                marginBottom: 10,
              }}
            >
              Your booking
            </div>
            <dl
              style={{
                margin: 0,
                borderTop: `1px solid ${TDE.border}`,
                paddingTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <SummaryRow label="Subtotal" value={subtotal} />
              <AnimatePresence initial={false}>
                {shown.multiClassDiscount > 0.005 && (
                  <SummaryRow
                    key="multi"
                    label="Additional-class rate"
                    value={multi}
                    negative
                    tone="saving"
                  />
                )}
                {shown.siblingDiscount > 0 && (
                  <SummaryRow
                    key="sib"
                    label="Sibling discount (10%)"
                    value={sib}
                    negative
                    tone="saving"
                  />
                )}
              </AnimatePresence>
              <SummaryRow label="Total" value={total} tone="total" />
            </dl>
            <button
              ref={payRef}
              type="button"
              style={{
                marginTop: 14,
                width: "100%",
                height: 42,
                borderRadius: 12,
                border: "none",
                background: TDE.primary,
                color: TDE.primaryFg,
                fontFamily: body,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: step === 4 ? "0 0 0 4px hsl(193 80% 94%)" : "none",
                transition: "box-shadow 300ms ease",
              }}
            >
              {step === 4 ? `Pay ${gbp(shown.total)} today` : "Continue to payment"}
            </button>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 11,
                lineHeight: 1.5,
                color: TDE.mutedFg,
              }}
            >
              {step === 4
                ? MONTHLY_PAYMENT_INFO
                : "Have a code or studio credit? Add it at payment."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Trace ── */}
      <Trace compact={compact} step={step} rows={shown.trace} />
    </div>
  );
}

/** The totals for the rows revealed so far — so adding a row visibly
 *  re-runs the engine rather than jumping straight to the answer. */
function priceSubset(step: number, count: number) {
  const full = priceScene(step);
  if (count >= full.lines.length || step === 3) return full;
  const prev = priceScene(step - 1);
  return { ...prev, trace: prev.trace, capReached: false };
}

const surface: React.CSSProperties = {
  background: TDE.card,
  border: `1px solid ${TDE.border}`,
  borderRadius: 16,
  boxShadow:
    "0 1px 2px hsl(222 30% 10% / 0.03), 0 12px 32px -18px hsl(222 30% 10% / 0.12)",
};

function Money({ value }: { value: number }) {
  const v = useTweenNumber(value, 500);
  return <>{gbp(v)}</>;
}

function SummaryRow({
  label,
  value,
  negative,
  tone,
}: {
  label: string;
  value: number;
  negative?: boolean;
  tone?: "saving" | "total";
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      style={{ overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: tone === "total" ? 16 : 13,
          fontWeight: tone === "total" ? 700 : 400,
          color: tone === "saving" ? TDE.success : TDE.fg,
          borderTop: tone === "total" ? `1px solid ${TDE.border}` : "none",
          paddingTop: tone === "total" ? 10 : 0,
          marginTop: tone === "total" ? 2 : 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <dt
          style={{
            color:
              tone === "saving" ? TDE.success : tone === "total" ? TDE.fg : TDE.mutedFg,
          }}
        >
          {label}
        </dt>
        <dd style={{ margin: 0 }}>
          {negative ? "−" : ""}
          {gbp(value)}
        </dd>
      </div>
    </motion.div>
  );
}

/* ── Trace: lib/pricing.ts, one basket at a time ────────────────── */

function Trace({
  compact,
  step,
  rows,
}: {
  compact: boolean;
  step: number;
  rows: TraceRow[];
}) {
  return (
    <div
      style={{
        width: compact ? 600 : 440,
        height: compact ? 400 : 640,
        background: "#0a0a0a",
        color: "#f4f4e8",
        padding: compact ? "20px 22px" : "26px 26px",
        fontFamily: T.mono,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        borderLeft: compact ? "none" : "1px solid rgba(244,244,232,0.14)",
        borderTop: compact ? "1px solid rgba(244,244,232,0.14)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.primary,
          }}
        >
          Nullshift <span style={{ color: T.faint }}>{"//"}</span>{" "}
          {step === 4 ? "create-payment-intent · server" : "lib/pricing.ts · client"}
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.faint,
          }}
        >
          {step === 4 ? "same engine, re-run" : "pure functions"}
        </span>
      </div>

      <div
        style={{
          border: "1px solid rgba(244,244,232,0.14)",
          padding: "8px 12px",
          fontSize: 10,
          lineHeight: 1.6,
          color: "#9a9a90",
        }}
      >
        38 dance weeks · monthly = weekly × 3.4 · additional class £7.75 / £6.75 · sibling
        10% · cap {gbp(UNLIMITED_MONTHLY_CAP)}
      </div>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.li
              key={`${step}-${i}-${r.code}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 1,
                padding: "5px 8px",
                borderLeft: `2px solid ${r.tone === "accent" ? T.primary : r.tone === "warn" ? T.warning : "transparent"}`,
                background:
                  r.tone === "accent"
                    ? "rgba(16,185,129,0.06)"
                    : r.tone === "warn"
                      ? "rgba(245,213,71,0.07)"
                      : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: r.tone === "muted" ? "#9a9a90" : "#f4f4e8",
                  whiteSpace: "pre",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.code}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  color:
                    r.tone === "accent"
                      ? T.primary
                      : r.tone === "warn"
                        ? T.warning
                        : "#9a9a90",
                  whiteSpace: "pre-wrap",
                }}
              >
                → {r.value}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <div
        style={{
          fontSize: 10,
          lineHeight: 1.6,
          color: "#9a9a90",
          borderTop: "1px solid rgba(244,244,232,0.14)",
          paddingTop: 10,
        }}
      >
        Client and server run the identical file; a line that disagrees by more than 1p is
        refused with a 409 before Stripe is touched.
      </div>
    </div>
  );
}
