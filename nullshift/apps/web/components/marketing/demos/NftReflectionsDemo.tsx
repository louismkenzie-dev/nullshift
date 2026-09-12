"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  HeartHandshake,
  Leaf,
  MessageSquareText,
  Phone,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import type { ClientStory } from "@nullshift/content/clientStories";
import { T } from "@nullshift/ui/tokens";
import { DemoShowcase } from "./DemoShowcase";
import {
  CursorLayer,
  ScaledStage,
  useElapsed,
  useTypewriter,
  type DemoStep,
} from "./engine";
import { nftBody, nftSerif } from "./fonts";
import {
  CHAT_MODEL,
  PIPELINE,
  SAFETY_MODEL,
  routeAfterSafety,
  type PipelineId,
  type SafetyTier,
} from "./nft/logic";

/* ────────────────────────────────────────────────────────────────
   NewFuture Reflections — reproduced from the client's
   `components/reflections/ReflectionsPanel.tsx` and `CrisisScreen.tsx`
   (their palette from globals.css @theme, their typefaces), beside a live
   trace of `api/reflections/chat/route.ts`: the safety classifier runs on
   the raw message before the chat model exists, and an "immediate" tier
   returns a JSON flag the client answers with fixed UI.
   ──────────────────────────────────────────────────────────────── */

const NFT = {
  cream: "#F5F3EF",
  sage: "#6B8C6F",
  sageLight: "#C4D9C6",
  sagePale: "#EBF2EC",
  sageDark: "#3A5A40",
  greyLight: "#E4E0DB",
  greyMid: "#8C8680",
  charcoal: "#2D2926",
  muted: "#5C5651",
} as const;

const serif = "var(--demo-nft-serif), 'Cormorant Garamond', Georgia, serif";
const body = "var(--demo-nft-body), 'DM Sans', system-ui, sans-serif";

const INVITATION = "Help me reflect on how the programme is going";
const REPLY =
  "Of course. Before we look at anything in particular, I'm curious how it has felt to be doing this work. Is there a moment from the programme that has stayed with you?";
const RISK_MESSAGE = "Some days I'm not sure I can keep going.";

const STEPS: DemoStep[] = [
  {
    id: "open",
    label: "Open Reflections",
    hold: 3000,
    caption:
      "The panel ships with a pinned disclosure — fixed interface copy above every conversation: not counselling, not therapy, no therapist reads it.",
  },
  {
    id: "invite",
    label: "A guided opener",
    hold: 8000,
    caption:
      "One click on the invitation sends the first message. The reply streams back in the therapists' own preferred language — reflective, curious, never diagnostic. (An illustrative exchange.)",
  },
  {
    id: "gate",
    label: "The safety gate",
    hold: 7000,
    caption:
      "Every inbound message is classified on its own, with no conversation context, before the chat model is called. An “immediate” tier ends the request with a JSON flag — the model never runs.",
  },
  {
    id: "crisis",
    label: "A fixed screen",
    hold: 6500,
    caption:
      "The support screen is a React component, not model output: 999, Samaritans, NHS 111, Shout and the domestic-abuse helpline exactly as the practice approved them. The conversation does not continue beneath it.",
  },
];

export function NftReflectionsDemo({
  story,
}: {
  story: ClientStory;
  theme: "dark" | "cream";
}) {
  return (
    <DemoShowcase
      steps={STEPS}
      url={story.liveUrl}
      caption={`${story.displayUrl}/learn/reflections`}
      tint={story.brand.primary}
      eyebrow="Reproduced from their codebase · ReflectionsPanel.tsx · CrisisScreen.tsx · route.ts"
      title="NewFuture Reflections — safety by architecture"
    >
      {(step, clock) => (
        <ScaledStage
          width={1200}
          height={640}
          compactWidth={600}
          compactHeight={1040}
          background={NFT.cream}
        >
          {(compact) => (
            <CursorLayer color={NFT.charcoal}>
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

/* ── The scene: product on the left, request trace on the right ── */

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
  const inviteRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);

  // Beats inside each step, by elapsed time.
  const invited = step >= 1 && (step > 1 || t > 900);
  const replyStreaming = step === 1 && t > 2200;
  const replyDone = step > 1;
  const typingRisk = step === 2 && t < 3400;
  const riskSent = (step === 2 && t >= 3400) || step === 3;
  const classifyActive = step === 2 && t > 3600 && t <= 4600;
  const classified = (step === 2 && t > 4600) || step === 3;
  const gated = (step === 2 && t > 5000) || step === 3;
  const crisis = step === 3;

  const typedRisk = useTypewriter(RISK_MESSAGE, typingRisk, 20);
  const streamedReply = useTypewriter(REPLY, replyStreaming, 40);

  // Cursor choreography.
  const beat =
    step === 1 ? "invite" : step === 2 && t >= 2600 && t < 3400 ? "send" : "idle";
  useEffect(() => {
    if (beat === "invite") cursorTo(inviteRef.current);
    else if (beat === "send") cursorTo(sendRef.current);
    else cursorTo(null);
  }, [beat, cursorTo]);

  const tier: SafetyTier | null = classified
    ? "immediate"
    : step >= 1 && invited
      ? "none"
      : null;
  const outcome = tier ? routeAfterSafety(tier) : null;

  return (
    <div
      className={`${nftSerif.variable} ${nftBody.variable}`}
      style={{
        display: "flex",
        flexDirection: compact ? "column" : "row",
        width: "100%",
        height: "100%",
      }}
    >
      {/* ── Product ── */}
      <div
        style={{
          width: compact ? 600 : 760,
          height: compact ? 660 : 640,
          padding: compact ? "24px 22px" : "28px 32px",
          background: NFT.cream,
          fontFamily: body,
          color: NFT.charcoal,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* Member header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <NftLogo />
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: NFT.sageDark,
            }}
          >
            Members · Reflections
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {crisis ? (
            <motion.div
              key="crisis"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <CrisisScreen compact={compact} />
            </motion.div>
          ) : (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                background: "#fff",
                borderRadius: 16,
                border: `1px solid ${NFT.greyLight}`,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Disclosure — fixed interface copy, pinned above every conversation */}
              <div
                style={{
                  background: NFT.sagePale,
                  borderBottom: `1px solid ${NFT.sageLight}80`,
                  padding: "12px 24px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <Leaf
                  size={15}
                  color={NFT.sageDark}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: NFT.sageDark,
                  }}
                >
                  NewFuture Reflections is an AI-supported educational and reflective
                  guide. It is not counselling, therapy or emergency support, and no
                  therapist reads these conversations.
                </p>
              </div>

              {/* Messages */}
              <div
                style={{
                  padding: invited ? "24px 24px" : "0 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  minHeight: invited ? 120 : 0,
                }}
                aria-live="polite"
              >
                {invited && <Bubble role="user">{INVITATION}</Bubble>}
                {invited && (replyStreaming || replyDone) && (
                  <Bubble role="assistant">
                    {replyDone ? REPLY : streamedReply || null}
                  </Bubble>
                )}
                {invited && !replyStreaming && !replyDone && (
                  <Bubble role="assistant">{null}</Bubble>
                )}
                {riskSent && <Bubble role="user">{RISK_MESSAGE}</Bubble>}
                {riskSent && !crisis && <Bubble role="assistant">{null}</Bubble>}
              </div>

              {/* Invitation opener */}
              {!invited && (
                <div style={{ padding: "20px 24px 0" }}>
                  <button
                    ref={inviteRef}
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: body,
                      fontSize: 14,
                      background: NFT.sagePale,
                      color: NFT.sageDark,
                      border: `1px solid ${NFT.sageLight}`,
                      padding: "10px 20px",
                      borderRadius: 999,
                      cursor: "pointer",
                    }}
                  >
                    <Sparkles size={15} />
                    {INVITATION}
                  </button>
                </div>
              )}

              {/* Input */}
              <div
                style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: 16 }}
              >
                <div
                  style={{
                    flex: 1,
                    fontFamily: body,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: typedRisk ? NFT.charcoal : `${NFT.muted}b3`,
                    background: NFT.cream,
                    border: `1px solid ${typingRisk ? NFT.sage : NFT.greyLight}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    minHeight: 64,
                    whiteSpace: "pre-wrap",
                  }}
                  aria-label="Message NewFuture Reflections"
                >
                  {typedRisk || "Write to Reflections…"}
                  {typingRisk && <Caret />}
                </div>
                <button
                  ref={sendRef}
                  type="button"
                  aria-label="Send"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: NFT.sageDark,
                    color: NFT.cream,
                    border: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: typedRisk ? 1 : 0.4,
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  <SendHorizontal size={17} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Trace ── */}
      <Trace
        compact={compact}
        step={step}
        invited={invited}
        replyStreaming={replyStreaming || replyDone}
        riskSent={riskSent}
        classifyActive={classifyActive}
        tier={tier}
        gated={gated}
        crisis={crisis}
        outcomeKind={outcome?.kind ?? null}
      />
    </div>
  );
}

/* ── Pieces of their UI ─────────────────────────────────────────── */

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const user = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", justifyContent: user ? "flex-end" : "flex-start" }}
    >
      <div
        style={{
          maxWidth: "85%",
          fontFamily: body,
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          borderRadius: 16,
          padding: "12px 16px",
          background: user ? NFT.sageDark : NFT.cream,
          color: user ? NFT.cream : NFT.charcoal,
          border: user ? "none" : `1px solid ${NFT.greyLight}`,
        }}
      >
        {children ?? <TypingDots />}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", height: 16 }}>
      {[0, 150, 300].map((d) => (
        <motion.span
          key={d}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: d / 1000 }}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: NFT.sage,
            display: "block",
          }}
        />
      ))}
    </span>
  );
}

function Caret() {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
      style={{
        display: "inline-block",
        width: 1.5,
        height: 16,
        background: NFT.sageDark,
        verticalAlign: "text-bottom",
        marginLeft: 1,
      }}
    />
  );
}

/** Their line-veined leaf beside the stacked wordmark (Logo.tsx). */
function NftLogo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg
        height={30}
        viewBox="0 0 180 220"
        fill="none"
        aria-hidden
        style={{ display: "block" }}
      >
        <path
          d="M90 200 C20 150 10 80 90 20 C170 80 160 150 90 200Z"
          fill={NFT.sageDark}
        />
        <line x1="90" y1="200" x2="90" y2="20" stroke={NFT.cream} strokeWidth="3" />
        <line x1="90" y1="120" x2="50" y2="80" stroke={NFT.cream} strokeWidth="2.5" />
        <line x1="90" y1="140" x2="130" y2="100" stroke={NFT.cream} strokeWidth="2.5" />
        <line x1="90" y1="160" x2="55" y2="130" stroke={NFT.cream} strokeWidth="2.5" />
        <line x1="90" y1="100" x2="125" y2="70" stroke={NFT.cream} strokeWidth="2.5" />
      </svg>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          style={{
            fontFamily: serif,
            fontWeight: 600,
            fontSize: 19,
            letterSpacing: "0.02em",
            color: NFT.sageDark,
          }}
        >
          NewFuture
        </span>
        <span
          style={{
            fontFamily: body,
            fontSize: 9.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: NFT.muted,
            marginTop: 1,
          }}
        >
          Therapy
        </span>
      </span>
    </span>
  );
}

/** The approved urgent-support screen (their spec §15.3), copy verbatim. */
function CrisisScreen({ compact }: { compact: boolean }) {
  const lines: { icon: React.ReactNode; strong: string; rest: string }[] = [
    {
      icon: <Phone size={18} />,
      strong: "999",
      rest: " — if you or someone else is in immediate danger.",
    },
    {
      icon: <Phone size={18} />,
      strong: "Samaritans — 116 123",
      rest: " — free, 24 hours a day, every day.",
    },
    {
      icon: <Phone size={18} />,
      strong: "NHS 111, option 2",
      rest: " — urgent mental-health support.",
    },
    {
      icon: <MessageSquareText size={18} />,
      strong: "Shout — text 85258",
      rest: " — free, confidential, 24/7 text support.",
    },
    {
      icon: <Phone size={18} />,
      strong: "National Domestic Abuse Helpline — 0808 2000 247",
      rest: " — free, 24 hours, if you are frightened of someone close to you.",
    },
  ];
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${NFT.sageLight}`,
        borderRadius: 16,
        padding: compact ? 22 : 32,
        fontFamily: body,
      }}
    >
      <p
        style={{
          margin: "0 0 20px",
          fontSize: 15,
          lineHeight: 1.65,
          color: NFT.charcoal,
        }}
      >
        Thank you for telling me. This tool cannot help in an emergency and cannot assess
        risk — support from a person is the right next step, and you deserve that support
        now.
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {lines.map((l) => (
          <li
            key={l.strong}
            style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
          >
            <span style={{ color: NFT.sageDark, flexShrink: 0, marginTop: 3 }}>
              {l.icon}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.6, color: NFT.charcoal }}>
              <strong>{l.strong}</strong>
              {l.rest}
            </span>
          </li>
        ))}
      </ul>
      <p
        style={{
          margin: "0 0 24px",
          fontSize: 14,
          lineHeight: 1.6,
          color: NFT.muted,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <HeartHandshake
          size={18}
          color={NFT.sage}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <span>
          If you can, consider reaching out to someone you trust. You are in control of
          what happens next, and you can return to the course whenever you feel ready.
        </span>
      </p>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 44,
          fontSize: 14,
          border: `1px solid ${NFT.sage}`,
          color: NFT.sageDark,
          padding: "10px 24px",
          borderRadius: 999,
        }}
      >
        I am okay to close this for now
      </span>
    </div>
  );
}

/* ── The trace: route.ts, one request at a time ─────────────────── */

type RowState = "idle" | "active" | "done" | "skipped";

function Trace({
  compact,
  step,
  invited,
  replyStreaming,
  riskSent,
  classifyActive,
  tier,
  gated,
  crisis,
  outcomeKind,
}: {
  compact: boolean;
  step: number;
  invited: boolean;
  replyStreaming: boolean;
  riskSent: boolean;
  classifyActive: boolean;
  tier: SafetyTier | null;
  gated: boolean;
  crisis: boolean;
  outcomeKind: "crisis" | "stream" | null;
}) {
  const inFlight = step === 1 ? invited : step >= 2 ? riskSent : false;
  const state = (id: PipelineId): RowState => {
    if (!inFlight) return "idle";
    switch (id) {
      case "auth":
      case "entitlement":
      case "clamp":
        return "done";
      case "classify":
        if (classifyActive) return "active";
        return tier ? "done" : step === 1 ? "done" : "active";
      case "gate":
        if (step === 1) return replyStreaming ? "done" : "idle";
        return gated ? "done" : "idle";
      case "counter":
        if (step === 1) return replyStreaming ? "skipped" : "idle";
        return gated ? "done" : "idle";
      case "stream":
        if (step === 1) return replyStreaming ? "active" : "idle";
        return gated ? "skipped" : "idle";
      case "client":
        return crisis ? "done" : "idle";
    }
  };

  const tierLabel = classifyActive ? "classifying…" : (tier ?? "—");
  const tierColor =
    tier === "immediate"
      ? "#ff7a90"
      : tier === "none"
        ? T.primary
        : classifyActive
          ? T.warning
          : T.faint;

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
        gap: 14,
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
          api/reflections/chat/route.ts
        </span>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.faint,
          }}
        >
          one request
        </span>
      </div>

      {/* Tier readout */}
      <div
        style={{
          border: "1px solid rgba(244,244,232,0.14)",
          padding: "10px 12px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#9a9a90",
          }}
        >
          safety tier · {SAFETY_MODEL}
        </span>
        <motion.span
          key={tierLabel}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tierColor,
          }}
        >
          {tierLabel}
        </motion.span>
      </div>

      {/* Pipeline rows */}
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: compact ? 5 : 7,
          flex: 1,
        }}
      >
        {PIPELINE.map((row, i) => {
          const s = state(row.id);
          const color =
            s === "active"
              ? T.warning
              : s === "done"
                ? "#f4f4e8"
                : s === "skipped"
                  ? "#6a6a62"
                  : "#6a6a62";
          const mark =
            s === "active" ? "▶" : s === "done" ? "✓" : s === "skipped" ? "—" : "·";
          const markColor =
            s === "active" ? T.warning : s === "done" ? T.primary : "#6a6a62";
          const note =
            row.id === "gate" && tier
              ? tier === "immediate"
                ? 'true → return { kind: "crisis" }'
                : "false → carry on"
              : row.id === "stream" && s === "skipped"
                ? "never called"
                : row.id === "counter" && s === "skipped"
                  ? "nothing to record"
                  : row.note;
          return (
            <li
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "14px 1fr",
                gap: 10,
                padding: "6px 8px",
                background:
                  s === "active"
                    ? "rgba(245,213,71,0.08)"
                    : s === "done"
                      ? "rgba(16,185,129,0.06)"
                      : "transparent",
                borderLeft: `2px solid ${s === "active" ? T.warning : s === "done" ? T.primary : "transparent"}`,
                transition: "background 300ms ease, border-color 300ms ease",
                opacity: s === "idle" ? 0.55 : 1,
                textDecoration: s === "skipped" ? "line-through" : "none",
              }}
            >
              <span style={{ color: markColor, fontSize: 11 }}>{mark}</span>
              <span
                style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    color,
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <span style={{ color: "#6a6a62" }}>
                    {String(i + 1).padStart(2, "0")}{" "}
                  </span>
                  {row.code}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: s === "idle" ? "#6a6a62" : "#9a9a90",
                    textDecoration: "none",
                  }}
                >
                  {note}
                </span>
              </span>
            </li>
          );
        })}
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
        {outcomeKind === "crisis"
          ? `Outcome: crisis. ${CHAT_MODEL} was never called; the client swapped in CrisisScreen.tsx.`
          : outcomeKind === "stream"
            ? `Outcome: stream. ${CHAT_MODEL} replies with the therapists' prompt and the exercise context.`
            : "Waiting for a message."}
      </div>
    </div>
  );
}
