"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ClientStory } from "@nullshift/content/clientStories";
import { T } from "@nullshift/ui/tokens";
import { DemoShowcase } from "./DemoShowcase";
import { CursorLayer, ScaledStage, useElapsed, type DemoStep } from "./engine";
import { suffolkBody, suffolkDisplay } from "./fonts";
import {
  LTA_AREAS,
  LTA_LEVELS,
  isComplete,
  levelLabel,
  trendSentence,
  type Ratings,
} from "./suffolk/lta";
import { isParentVisible, outward } from "./suffolk/reports";

/* ────────────────────────────────────────────────────────────────
   Suffolk Tennis LTA — a coach's session report, reproduced from the
   client's `components/coach/ReportSheet.tsx`, and what the parent sees in
   `components/children/ChildReportsView.tsx` (their `.app-shell` palette,
   Archivo headings, Hanken Grotesk body). The vocabulary, completeness rule,
   radial inversion and trend copy all come from `lib/lta.ts`, ported verbatim.
   ──────────────────────────────────────────────────────────────── */

/* .app-shell — the signed-in palette from their index.css */
const S = {
  bg: "hsl(210 20% 98%)",
  fg: "hsl(215 28% 12%)",
  card: "#ffffff",
  muted: "hsl(210 20% 95%)",
  mutedFg: "hsl(215 12% 45%)",
  border: "hsl(214 16% 90%)",
  primary: "hsl(207 90% 38%)",
  navy: "hsl(220 60% 14%)",
  pink: "hsl(327 75% 52%)",
} as const;

const body = "var(--demo-suffolk-body), 'Hanken Grotesk', system-ui, sans-serif";
const display = "var(--demo-suffolk-display), Archivo, sans-serif";

/* LTA_LEVELS.classes → the Tailwind colours they resolve to */
const LEVEL_COLOURS: Record<
  1 | 2 | 3 | 4,
  { bg: string; fg: string; border: string; dot: string }
> = {
  1: { bg: "#ecfdf5", fg: "#065f46", border: "#6ee7b7", dot: "#10b981" },
  2: { bg: "#f0f9ff", fg: "#075985", border: "#7dd3fc", dot: "#0ea5e9" },
  3: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d", dot: "#f59e0b" },
  4: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
};

/* Three sessions for one player, oldest → newest (the app sorts the same way). */
const PLAYER = "Arlo";
const COACH = "Ollie";
const REPORTS: { date: string; label: string; long: string; ratings: Ratings }[] = [
  {
    date: "2026-08-22",
    label: "Sat 22 Aug",
    long: "Saturday 22 August 2026",
    ratings: r(3, 3, 2, 3, 3, 4, 2, 2, 4),
  },
  {
    date: "2026-08-29",
    label: "Sat 29 Aug",
    long: "Saturday 29 August 2026",
    ratings: r(3, 2, 2, 3, 3, 3, 2, 1, 3),
  },
  {
    date: "2026-09-05",
    label: "Sat 5 Sep",
    long: "Saturday 5 September 2026",
    ratings: r(2, 2, 1, 2, 3, 3, 1, 1, 2),
  },
];
const LATEST = REPORTS[2];
const PREVIOUS = REPORTS[1];
const AREA_NOTES: Record<string, string> = {
  Serving: "Throwing action is settling — the toss is consistent now.",
  "Chases Every Ball": "Chased down everything today. Brilliant attitude.",
};
const COMMENT =
  "A really strong session — much more composed at the net and the serve is coming on. Next week: keep the toss high and commit to the second serve.";

function r(...v: number[]): Ratings {
  const out: Ratings = {};
  LTA_AREAS.forEach((a, i) => (out[a.name] = v[i]));
  return out;
}

const STEPS: DemoStep[] = [
  {
    id: "rate",
    label: "Rate nine areas",
    hold: 9200,
    caption:
      "The coach's register opens a session report: the nine LTA talent characteristics, each rated Excelling → Next Step Focus, with last time's level beside every area. isComplete() flips the badge the moment all nine are rated.",
  },
  {
    id: "send",
    label: "Save, end the session",
    hold: 5600,
    caption:
      "Saving keeps a partial report private. Ending the session sends every complete report to its parent — or a cron does it two hours after the session ends, whichever comes first. Edits after sending show as “Updated”, never a second email.",
  },
  {
    id: "radar",
    label: "The parent's radar",
    hold: 6000,
    caption:
      "In the parent hub the nine areas become a radar: latest in Suffolk blue, previous ghosted. outward() inverts the LTA scale so Excelling sits on the outer edge and improvement reads as growth.",
  },
  {
    id: "trend",
    label: "Progress over time",
    hold: 6200,
    caption:
      "One small line per area across every report, and a plain sentence for each change — trendSentence() writes “Serving up from Progressing to Consistent” so nobody has to decode a number.",
  },
];

export function SuffolkReportsDemo({
  story,
}: {
  story: ClientStory;
  theme: "dark" | "cream";
}) {
  return (
    <DemoShowcase
      steps={STEPS}
      url={story.liveUrl}
      caption={`${story.displayUrl}/coach/register`}
      tint={story.brand.primary}
      eyebrow="Reproduced from their codebase · ReportSheet.tsx · ChildReportsView.tsx · lib/lta.ts"
      title="Ollie's coach reports — nine areas, rated on court, read at home"
    >
      {(step, clock) => (
        <ScaledStage
          width={1200}
          height={640}
          compactWidth={600}
          compactHeight={1080}
          background={S.bg}
        >
          {(compact) => (
            <CursorLayer color={S.fg}>
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

/* ── Scene ─────────────────────────────────────────────────────── */

const RATE_START = 700;
const RATE_EVERY = 820;

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
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const saveRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);

  // Step 0: ratings land one at a time.
  const ratedCount =
    step === 0
      ? Math.min(9, Math.max(0, Math.floor((t - RATE_START) / RATE_EVERY) + 1))
      : 9;
  const ratings = useMemo<Ratings>(() => {
    const out: Ratings = {};
    LTA_AREAS.slice(0, ratedCount).forEach((a) => (out[a.name] = LATEST.ratings[a.name]));
    return out;
  }, [ratedCount]);
  const complete = isComplete(ratings);

  // Step 1 beats.
  const saved = step === 1 && t > 900;
  const endDialog = step === 1 && t > 2600 && t < 4200;
  const ended = (step === 1 && t >= 4200) || step >= 2;
  const sentAt = ended ? "2026-09-05T15:58:00Z" : null;

  // Cursor choreography.
  const nextArea = step === 0 && ratedCount < 9 ? LTA_AREAS[ratedCount]?.name : null;
  const beat =
    step === 0
      ? nextArea
        ? `chip:${nextArea}`
        : "idle"
      : step === 1
        ? endDialog
          ? "end"
          : t < 900
            ? "save"
            : "idle"
        : "idle";
  useEffect(() => {
    if (beat.startsWith("chip:")) {
      const area = beat.slice(5);
      cursorTo(chipRefs.current.get(`${area}:${LATEST.ratings[area]}`) ?? null);
    } else if (beat === "save") cursorTo(saveRef.current);
    else if (beat === "end") cursorTo(endRef.current);
    else cursorTo(null);
  }, [beat, cursorTo]);

  const parentView = step >= 2;

  return (
    <div
      className={`${suffolkBody.variable} ${suffolkDisplay.variable}`}
      style={{
        display: "flex",
        flexDirection: compact ? "column" : "row",
        width: "100%",
        height: "100%",
        fontFamily: body,
        color: S.fg,
      }}
    >
      {/* ── Product ── */}
      <div
        style={{
          width: compact ? 600 : 760,
          height: compact ? 700 : 640,
          background: S.bg,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar
          title={parentView ? "My Children" : "Register"}
          role={parentView ? "Parent hub" : "Coach hub"}
        />
        <div style={{ flex: 1, position: "relative" }}>
          <AnimatePresence mode="wait" initial={false}>
            {!parentView ? (
              <motion.div
                key="coach"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ position: "absolute", inset: 0 }}
              >
                <RegisterBackdrop complete={complete} sent={ended} />
                <ReportSheet
                  ratings={ratings}
                  ratedCount={ratedCount}
                  complete={complete}
                  sentAt={sentAt}
                  saved={saved}
                  chipRefs={chipRefs}
                  saveRef={saveRef}
                  compact={compact}
                  dimmed={endDialog}
                />
                <AnimatePresence>
                  {endDialog && <EndSessionDialog endRef={endRef} />}
                  {saved && !endDialog && !ended && (
                    <Toast
                      key="saved"
                      text="Report complete — it goes to the parent when you end the session"
                    />
                  )}
                  {ended && step === 1 && (
                    <Toast key="ended" text="Session ended · 3 reports sent to parents" />
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="parent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: compact ? "16px 18px" : "18px 24px",
                  overflow: "hidden",
                }}
              >
                {step === 2 ? (
                  <LatestReportView compact={compact} />
                ) : (
                  <TrendView compact={compact} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Trace ── */}
      <Trace
        compact={compact}
        step={step}
        ratedCount={ratedCount}
        complete={complete}
        sentAt={sentAt}
      />
    </div>
  );
}

/* ── Their shell pieces ────────────────────────────────────────── */

function TopBar({ title, role }: { title: string; role: string }) {
  return (
    <div
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 20px",
        background: "rgba(255,255,255,0.86)",
        backdropFilter: "saturate(180%) blur(14px)",
        borderBottom: `1px solid ${S.border}`,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: display,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.02em",
            color: S.navy,
          }}
        >
          SUFFOLK
        </span>
        <span
          style={{
            fontFamily: display,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.02em",
            color: S.pink,
          }}
        >
          TENNIS
        </span>
      </span>
      <span style={{ width: 1, height: 20, background: S.border }} />
      <span
        style={{
          fontFamily: display,
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 12, color: S.mutedFg }}>{role}</span>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "danger" | "info" | "neutral";
  children: React.ReactNode;
}) {
  const c =
    tone === "success"
      ? { bg: "#ecfdf5", fg: "#065f46", ring: "rgba(5,150,105,0.15)", dot: "#10b981" }
      : tone === "danger"
        ? { bg: "#fef2f2", fg: "#991b1b", ring: "rgba(220,38,38,0.15)", dot: "#ef4444" }
        : tone === "info"
          ? { bg: "#f0f9ff", fg: "#075985", ring: "rgba(2,132,199,0.15)", dot: "#0ea5e9" }
          : { bg: S.muted, fg: S.mutedFg, ring: S.border, dot: "rgba(100,116,139,0.6)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        borderRadius: 999,
        padding: "1px 10px",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: "20px",
        background: c.bg,
        color: c.fg,
        boxShadow: `inset 0 0 0 1px ${c.ring}`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.dot }} />
      {children}
    </span>
  );
}

function LevelPill({ value }: { value: number | undefined }) {
  const level = LTA_LEVELS.find((l) => l.value === value);
  if (!level) return <StatusBadge tone="neutral">Not rated</StatusBadge>;
  const c = LEVEL_COLOURS[level.value];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        borderRadius: 999,
        padding: "1px 10px",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: "20px",
        background: c.bg,
        color: c.fg,
        boxShadow: `inset 0 0 0 1px ${c.border}`,
      }}
    >
      {level.label}
    </span>
  );
}

/* ── Coach: the register behind the sheet ──────────────────────── */

function RegisterBackdrop({ complete, sent }: { complete: boolean; sent: boolean }) {
  const players = [
    { name: PLAYER, here: true, dot: complete ? "#10b981" : "#f59e0b" },
    { name: "Isla", here: true, dot: "#10b981" },
    { name: "Rafferty", here: true, dot: "#10b981" },
    { name: "Maya", here: false, dot: S.border },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "18px 24px", opacity: 0.55 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: S.mutedFg,
        }}
      >
        Performance squad · Culford
      </div>
      <div
        style={{
          fontFamily: display,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          marginTop: 2,
        }}
      >
        Sat 5 Sep · 2–4pm
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <StatusBadge tone="success">3 here</StatusBadge>
        <StatusBadge tone="neutral">1 absent</StatusBadge>
        <StatusBadge tone={sent ? "success" : complete ? "success" : "danger"}>
          {sent ? "Reports sent" : `${complete ? 3 : 2}/3 reports complete`}
        </StatusBadge>
      </div>
      <div
        style={{
          marginTop: 14,
          background: S.card,
          border: `1px solid ${S.border}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {players.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 56,
              padding: "0 16px",
              borderTop: i ? `1px solid ${S.border}` : "none",
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "rgba(2,101,180,0.1)",
                color: S.primary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {p.name[0]}
            </span>
            <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{p.name}</span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: p.dot }} />
            <span
              style={{
                fontSize: 12,
                color: p.here ? "#065f46" : S.mutedFg,
                background: p.here ? "#ecfdf5" : S.muted,
                borderRadius: 999,
                padding: "2px 10px",
              }}
            >
              {p.here ? "Here" : "Absent"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Coach: ReportSheet.tsx ────────────────────────────────────── */

const AREA_BLOCK = 98;

function ReportSheet({
  ratings,
  ratedCount,
  complete,
  sentAt,
  saved,
  chipRefs,
  saveRef,
  compact,
  dimmed,
}: {
  ratings: Ratings;
  ratedCount: number;
  complete: boolean;
  sentAt: string | null;
  saved: boolean;
  chipRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  saveRef: React.RefObject<HTMLButtonElement | null>;
  compact: boolean;
  dimmed: boolean;
}) {
  // Keep the area being rated in view — the real sheet scrolls; here the list glides.
  const active = Math.min(8, ratedCount);
  const windowH = compact ? 300 : 330;
  const offset = Math.max(0, Math.min(active - 1, 9 - 3) * AREA_BLOCK);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: dimmed ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: compact ? 540 : 512,
        marginLeft: compact ? -270 : -256,
        marginTop: compact ? -270 : -262,
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 16,
        boxShadow: "0 10px 30px -10px hsl(215 28% 12% / 0.14)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "18px 24px 12px" }}>
        <div
          style={{
            fontFamily: display,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Session report · {PLAYER}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
            fontSize: 13,
            color: S.mutedFg,
          }}
        >
          <StatusBadge tone={complete ? "success" : "danger"}>
            {complete ? "Complete" : `${ratedCount}/9 rated`}
          </StatusBadge>
          {sentAt && <span>Sent Sat 5 Sep 3.58pm</span>}
        </div>
      </div>

      {/* Areas — the scrolling body */}
      <div
        style={{
          height: windowH,
          overflow: "hidden",
          position: "relative",
          padding: "0 24px",
        }}
      >
        <motion.div
          animate={{ y: -offset }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
        >
          {LTA_AREAS.map((area) => {
            const value = ratings[area.name];
            const last = PREVIOUS.ratings[area.name];
            const note = AREA_NOTES[area.name];
            return (
              <div
                key={area.name}
                style={{ height: AREA_BLOCK, boxSizing: "border-box", paddingTop: 6 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
                    {area.name}
                  </div>
                  <div style={{ fontSize: 11, color: S.mutedFg, whiteSpace: "nowrap" }}>
                    Last time:{" "}
                    <span style={{ fontWeight: 500, color: "rgba(30,41,59,0.8)" }}>
                      {levelLabel(last)}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: S.mutedFg, marginBottom: 6 }}>
                  {area.descriptor}
                </div>
                <div
                  role="radiogroup"
                  aria-label={area.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 6,
                  }}
                >
                  {LTA_LEVELS.map((level) => {
                    const on = value === level.value;
                    const c = LEVEL_COLOURS[level.value];
                    return (
                      <button
                        key={level.value}
                        ref={(el) => {
                          if (el) chipRefs.current.set(`${area.name}:${level.value}`, el);
                        }}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        style={{
                          minHeight: 34,
                          borderRadius: 12,
                          border: `1px solid ${on ? c.border : S.border}`,
                          boxShadow: on ? `inset 0 0 0 1px ${c.fg}` : "none",
                          background: on ? c.bg : S.card,
                          color: on ? c.fg : S.mutedFg,
                          fontFamily: body,
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1.1,
                          padding: "0 6px",
                          cursor: "pointer",
                          transition:
                            "background 150ms ease, color 150ms ease, border-color 150ms ease",
                        }}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: note && value ? S.fg : S.primary,
                    marginTop: 5,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {note && value ? note : "+ Add note"}
                </div>
              </div>
            );
          })}
          {/* Overall comment */}
          <div style={{ paddingTop: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Overall comment
            </div>
            <div
              style={{
                minHeight: 64,
                border: `1px solid hsl(214 16% 86%)`,
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 13,
                lineHeight: 1.5,
                color: complete ? S.fg : S.mutedFg,
              }}
            >
              {complete ? COMMENT : "What went well, what to work on…"}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: S.mutedFg }}>
              Parents see the ratings, notes and this comment together on the report.
            </p>
          </div>
        </motion.div>
        {/* Fade at the bottom of the scroll window */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 28,
            background: "linear-gradient(transparent, #fff)",
          }}
        />
      </div>

      {/* Sticky footer */}
      <div
        style={{
          borderTop: `1px solid ${S.border}`,
          background: S.card,
          padding: "12px 24px 16px",
        }}
      >
        <button
          ref={saveRef}
          type="button"
          style={{
            width: "100%",
            height: 48,
            borderRadius: 12,
            border: "none",
            background: saved ? "#065f46" : S.primary,
            color: "#fff",
            fontFamily: body,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 300ms ease",
          }}
        >
          {saved ? "Saved" : complete ? "Save report" : `Save (${ratedCount}/9 rated)`}
        </button>
      </div>
    </motion.div>
  );
}

function EndSessionDialog({
  endRef,
}: {
  endRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        style={{
          width: 380,
          background: S.card,
          borderRadius: 16,
          border: `1px solid ${S.border}`,
          padding: 22,
          boxShadow: "0 12px 40px -8px hsl(220 60% 14% / 0.25)",
        }}
      >
        <div style={{ fontFamily: display, fontSize: 18, fontWeight: 600 }}>
          End session?
        </div>
        <p
          style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5, color: S.mutedFg }}
        >
          3 complete reports will be sent to parents.
        </p>
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}
        >
          <span
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 12,
              border: `1px solid ${S.border}`,
              display: "inline-flex",
              alignItems: "center",
              fontSize: 14,
              fontWeight: 600,
              color: S.fg,
            }}
          >
            Cancel
          </span>
          <button
            ref={endRef}
            type="button"
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 12,
              border: "none",
              background: S.primary,
              color: "#fff",
              fontFamily: body,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            End session
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{
        position: "absolute",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        marginLeft: -180,
        width: 360,
        background: S.fg,
        color: "#fff",
        fontSize: 13,
        lineHeight: 1.4,
        padding: "12px 16px",
        borderRadius: 12,
        boxShadow: "0 12px 40px -8px rgba(0,0,0,0.3)",
        textAlign: "center",
      }}
    >
      {text}
    </motion.div>
  );
}

/* ── Parent: ChildReportsView.tsx ─────────────────────────────── */

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: S.mutedFg,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: display,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          marginTop: 2,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: S.mutedFg, marginTop: 2 }}>{description}</div>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: display, fontSize: 15, fontWeight: 600 }}>{title}</div>
      {description && <div style={{ fontSize: 12, color: S.mutedFg }}>{description}</div>}
    </div>
  );
}

function LatestReportView({ compact }: { compact: boolean }) {
  const visible = isParentVisible({
    complete: true,
    sent_at: "2026-09-05T15:58:00Z",
    ratings: LATEST.ratings,
  });
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "1fr 260px",
        gap: 18,
      }}
    >
      <div>
        <PageHeader
          eyebrow="Session reports"
          title={PLAYER}
          description={`${REPORTS.length} reports · latest ${LATEST.label}`}
        />
        <div style={{ marginTop: 14 }}>
          <SectionTitle title="Latest report" />
          <div
            style={{
              background: S.card,
              border: `1px solid ${S.border}`,
              borderRadius: 16,
              padding: "10px 12px 8px",
            }}
          >
            <div style={{ fontSize: 12.5, color: S.mutedFg, marginBottom: 2 }}>
              {LATEST.long} · 2–4pm · Coach {COACH}
            </div>
            <Radar
              latest={LATEST.ratings}
              previous={PREVIOUS.ratings}
              size={compact ? 300 : 320}
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "4px 16px",
                fontSize: 12,
                color: S.mutedFg,
                marginTop: 2,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: S.primary,
                    opacity: 0.8,
                  }}
                />{" "}
                Latest · {LATEST.label}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 16, borderTop: `2px dashed ${S.mutedFg}` }} />{" "}
                Previous · {PREVIOUS.label}
              </span>
              <span
                style={{
                  flexBasis: "100%",
                  textAlign: "center",
                  fontSize: 11,
                  opacity: 0.8,
                }}
              >
                Outer edge = Excelling
              </span>
            </div>
          </div>
        </div>
      </div>
      {!compact && (
        <div style={{ paddingTop: 58 }}>
          <SectionTitle title="Coach's comment" />
          <div
            style={{
              background: S.card,
              border: `1px solid ${S.border}`,
              borderRadius: 16,
              padding: "12px 14px",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {COMMENT}
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: S.mutedFg }}>
            {visible
              ? "Visible to parents: complete, sent, nine areas rated."
              : "Not yet visible."}
          </div>
        </div>
      )}
    </div>
  );
}

/** Split an area name into short lines so the radar labels never clip (their wrapLabel). */
function wrapLabel(name: string, max = 12): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of name.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

/** Their radar: latest in Suffolk blue, previous ghosted; polygon grid; the
 *  LTA scale inverted so Excelling is the outer edge. Morphs previous → latest. */
function Radar({
  latest,
  previous,
  size,
}: {
  latest: Ratings;
  previous: Ratings;
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.31;
  const n = LTA_AREAS.length;
  const point = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };
  const path = (ratings: Ratings) =>
    LTA_AREAS.map((a, i) => {
      const v = outward(ratings[a.name]) ?? 0;
      const p = point(i, (v / 4) * maxR);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ") + "Z";
  const dLatest = path(latest);
  const dPrev = path(previous);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height={size}
      role="img"
      aria-label="Radar chart of the nine LTA areas"
      style={{ display: "block" }}
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={Array.from({ length: n }, (_, i) => {
            const p = point(i, maxR * f);
            return `${p.x},${p.y}`;
          }).join(" ")}
          fill="none"
          stroke={S.border}
          strokeWidth={1}
        />
      ))}
      {LTA_AREAS.map((_, i) => {
        const p = point(i, maxR);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={S.border}
            strokeWidth={0.7}
          />
        );
      })}
      <motion.path
        d={dPrev}
        fill="none"
        stroke={S.mutedFg}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <motion.path
        initial={{ d: dPrev, opacity: 0.4 }}
        animate={{ d: dLatest, opacity: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        fill={S.primary}
        fillOpacity={0.25}
        stroke={S.primary}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {LTA_AREAS.map((a, i) => {
        const v = outward(latest[a.name]) ?? 0;
        const p = point(i, (v / 4) * maxR);
        return (
          <motion.circle
            key={a.name}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={S.primary}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
          />
        );
      })}
      {LTA_AREAS.map((a, i) => {
        const p = point(i, maxR + 18);
        const lines = wrapLabel(a.name);
        const above = p.y < cy - 6;
        const below = p.y > cy + 6;
        const lh = 11;
        const startY = above
          ? p.y - (lines.length - 1) * lh
          : below
            ? p.y + 8
            : p.y + 4 - ((lines.length - 1) * lh) / 2;
        const anchor = Math.abs(p.x - cx) < 4 ? "middle" : p.x < cx ? "end" : "start";
        return (
          <text
            key={a.name}
            x={p.x}
            y={startY}
            textAnchor={anchor}
            fontSize={10}
            fontWeight={500}
            fill={S.mutedFg}
            fontFamily={body}
          >
            {lines.map((l, j) => (
              <tspan key={j} x={p.x} dy={j === 0 ? 0 : lh}>
                {l}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

function TrendView({ compact }: { compact: boolean }) {
  const changes = LTA_AREAS.map((a) =>
    trendSentence(a.name, PREVIOUS.ratings[a.name], LATEST.ratings[a.name])
  ).filter((s): s is string => !!s);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "1fr 240px",
        gap: 18,
      }}
    >
      <div>
        <SectionTitle
          title="Progress over time"
          description="Up is better. Latest level shown on each area."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "repeat(2, minmax(0, 1fr))"
              : "repeat(3, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {LTA_AREAS.map((a, idx) => {
            const points = REPORTS.map((rep) => outward(rep.ratings[a.name]) ?? 0);
            const last = LATEST.ratings[a.name];
            return (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * idx }}
                style={{
                  background: S.card,
                  border: `1px solid ${S.border}`,
                  borderRadius: 14,
                  padding: "8px 10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {a.name}
                  </span>
                  <LevelPill value={last} />
                </div>
                <Sparkline points={points} delay={0.3 + 0.08 * idx} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: S.mutedFg,
                    opacity: 0.8,
                  }}
                >
                  <span>{REPORTS[0].label}</span>
                  <span>{LATEST.label}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      {!compact && (
        <div>
          <SectionTitle title="Since last time" />
          <div
            style={{
              background: S.card,
              border: `1px solid ${S.border}`,
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {changes.map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.15 }}
                style={{
                  padding: "9px 12px",
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: S.mutedFg,
                  borderTop: i ? `1px solid ${S.border}` : "none",
                }}
              >
                {c}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkline({ points, delay }: { points: number[]; delay: number }) {
  const w = 160;
  const h = 44;
  const xs = points.map((_, i) => 8 + (i * (w - 16)) / Math.max(1, points.length - 1));
  const ys = points.map((v) => h - 6 - ((v - 0.5) / 4) * (h - 12));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      style={{ display: "block", marginTop: 4 }}
    >
      <motion.path
        d={d}
        fill="none"
        stroke={S.primary}
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay }}
      />
      {xs.map((x, i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={ys[i]}
          r={3}
          fill={S.primary}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.2 + i * 0.2 }}
        />
      ))}
    </svg>
  );
}

/* ── Trace: lib/lta.ts, shared by coach app, parent hub and the edge function ── */

function Trace({
  compact,
  step,
  ratedCount,
  complete,
  sentAt,
}: {
  compact: boolean;
  step: number;
  ratedCount: number;
  complete: boolean;
  sentAt: string | null;
}) {
  const rows: { code: string; value: string; tone?: "accent" | "warn" | "muted" }[] = [
    { code: "LTA_AREAS.length", value: "9 · the JSON keys in session_reports.ratings" },
    {
      code: "LTA_LEVELS",
      value: "1 Excelling · 2 Consistent · 3 Progressing · 4 Next Step Focus",
      tone: "muted",
    },
    {
      code: "isComplete(ratings)",
      value: complete ? "true · all nine rated" : `false · ${ratedCount}/9 rated`,
      tone: complete ? "accent" : undefined,
    },
  ];
  if (step >= 1) {
    rows.push({
      code: "save_report",
      value: `{ complete: ${complete}, sent_at: ${sentAt ? '"15:58"' : "null"} }`,
      tone: sentAt ? undefined : "muted",
    });
    rows.push({
      code: "end_session → send",
      value: sentAt
        ? "sent_at claimed first, then the email — or the 2-hour grace cron"
        : "waiting for the coach",
      tone: sentAt ? "accent" : "muted",
    });
    rows.push({
      code: "isUpdated(report)",
      value: "edited > 60 s after sending → “Updated” badge, no second email",
      tone: "muted",
    });
  }
  if (step >= 2) {
    rows.push({
      code: "isParentVisible(r)",
      value: "complete && sent_at && isComplete → true",
      tone: "accent",
    });
    rows.push({
      code: "outward(r) = 5 − r",
      value: `Serving ${LATEST.ratings.Serving} → ${outward(LATEST.ratings.Serving)} · Excelling on the outer edge`,
    });
  }
  if (step >= 3) {
    const s = trendSentence("Serving", PREVIOUS.ratings.Serving, LATEST.ratings.Serving);
    rows.push({
      code: 'trendSentence("Serving", 3, 2)',
      value: `“${s}”`,
      tone: "accent",
    });
    rows.push({
      code: "sort",
      value: "oldest → newest, so “previous” is simply the one before",
      tone: "muted",
    });
  }
  return (
    <div
      style={{
        width: compact ? 600 : 440,
        height: compact ? 380 : 640,
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
          Nullshift <span style={{ color: T.faint }}>{"//"}</span> lib/lta.ts
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.faint,
          }}
        >
          {step <= 1 ? "coach app" : "parent hub"}
        </span>
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
              key={`${r.code}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              style={{
                display: "grid",
                gap: 1,
                padding: "5px 8px",
                borderLeft: `2px solid ${r.tone === "accent" ? T.primary : r.tone === "warn" ? T.warning : "transparent"}`,
                background: r.tone === "accent" ? "rgba(16,185,129,0.06)" : "transparent",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: r.tone === "muted" ? "#9a9a90" : "#f4f4e8",
                }}
              >
                {r.code}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  color: r.tone === "accent" ? T.primary : "#9a9a90",
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
        One vocabulary file, imported by the coach app, the parent hub and the edge
        function that validates every save — so an area name can never drift.
      </div>
    </div>
  );
}
