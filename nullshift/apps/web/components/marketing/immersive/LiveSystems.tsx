"use client";

import Image from "next/image";
import { CLIENT_STORIES } from "@nullshift/content/clientStories";
import { DeviceFrame } from "@/components/marketing/DeviceFrame";
import React, { useEffect, useState } from "react";
import { useSpring, useTrail, animated, config } from "@react-spring/web";
import { T } from "@nullshift/ui/tokens";
import { useInView, usePrefersReducedMotion } from "@/lib/motion";

/* ════════════════════════════════════════════════════════════════
   LIVE SYSTEMS — the client work, running.

   Three real systems, each shown doing the thing it actually does:
   money settling into a studio's own account, a ticket scanned at a
   gate, an enquiry sealed before it leaves the page. Springs rather
   than timelines here, because this is meant to feel like something
   happening rather than something played — a number that settles has
   weight, a number that eases does not.

   Every figure is one we can stand behind. Nothing claims revenue for
   a system that has not launched.
   ════════════════════════════════════════════════════════════════ */

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

function Shell({
  client,
  slug,
  sector,
  title,
  body,
  status,
  children,
}: {
  client: string;
  slug: string;
  sector: string;
  title: string;
  body: string;
  status: string;
  children: React.ReactNode;
}) {
  const story = CLIENT_STORIES.find((entry) => entry.slug === slug);
  return (
    <div
      className="ns-live"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
        alignItems: "center",
        gap: "clamp(28px,5vw,72px)",
        paddingBlock: "clamp(56px,9vh,110px)",
        borderTop: "1px dashed var(--k-border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ ...mono, fontSize: "0.66rem", color: "var(--k-accent)" }}>
            {client}
          </span>
          <span style={{ ...mono, fontSize: "0.6rem", color: "var(--k-faint)" }}>
            {sector}
          </span>
        </div>
        <h3
          className="mt-5"
          style={{
            margin: 0,
            fontFamily: T.sans,
            fontWeight: 500,
            fontSize: "clamp(1.6rem,3.2vw,2.4rem)",
            lineHeight: 0.92,
            letterSpacing: "normal",
            textTransform: "uppercase",
            color: "var(--k-fg)",
          }}
        >
          {title}
        </h3>
        <p
          className="mt-6"
          style={{
            margin: 0,
            fontFamily: T.sans,
            fontSize: "clamp(0.98rem,1.4vw,1.2rem)",
            lineHeight: 1.4,
            color: "var(--k-muted)",
            maxWidth: "34ch",
          }}
        >
          {body}
        </p>
        <p
          className="mt-6"
          style={{ ...mono, fontSize: "0.62rem", color: "var(--k-faint)" }}
        >
          {status}
        </p>
        <div style={{ marginTop: 24, maxWidth: 300 }}>
          <p
            style={{
              ...mono,
              fontSize: "0.52rem",
              color: "var(--k-muted)",
              marginBottom: 10,
            }}
          >
            Illustrated system behaviour
          </p>
          {children}
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        {story?.screenshot && (
          <figure style={{ margin: "0 0 24px" }}>
            <DeviceFrame
              url={story.liveUrl}
              caption={story.displayUrl}
              tint={story.brand.primary}
            >
              <Image
                src={story.screenshot.src}
                alt={story.screenshot.alt}
                width={story.screenshot.width}
                height={story.screenshot.height}
                sizes="(max-width: 900px) 90vw, 45vw"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </DeviceFrame>
            <figcaption
              style={{
                ...mono,
                fontSize: "0.52rem",
                color: "var(--k-muted)",
                marginTop: 10,
              }}
            >
              Public website · captured September 2026
            </figcaption>
          </figure>
        )}
      </div>
    </div>
  );
}

function Stage({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        maxWidth: 380,
        background: "var(--k-surface)",
        border: "1px solid var(--k-border-strong)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 300,
      }}
    >
      <span style={{ ...mono, fontSize: "0.58rem", color: "var(--k-muted)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

/* ── Money settling into the studio's own account ───────────────── */
function MoneyStage({ play }: { play: boolean }) {
  const reduced = usePrefersReducedMotion();
  const amount = useSpring({
    immediate: reduced,
    from: { v: 0 },
    to: { v: play ? 133.99 : 0 },
    config: { mass: 1, tension: 90, friction: 26 },
    delay: 180,
  });
  const count = useSpring({
    immediate: reduced,
    from: { v: 0 },
    to: { v: play ? 274 : 0 },
    config: config.slow,
    delay: 260,
  });
  const bar = useSpring({
    immediate: reduced,
    from: { w: "0%" },
    to: { w: play ? "100%" : "0%" },
    config: { tension: 60, friction: 22 },
    delay: 340,
  });

  return (
    <Stage label="Payments · last 7 weeks">
      <animated.span
        style={{
          fontFamily: T.sans,
          fontWeight: 500,
          fontSize: "2.4rem",
          lineHeight: 0.9,
          color: "var(--k-fg)",
        }}
      >
        {amount.v.to((v) => `£${v.toFixed(2)}`)}
      </animated.span>
      <animated.span style={{ ...mono, fontSize: "0.6rem", color: "var(--k-muted)" }}>
        {count.v.to((v) => `${Math.round(v)} payments taken`)}
      </animated.span>
      <div
        style={{
          height: 3,
          background: "var(--k-border)",
          overflow: "hidden",
          marginTop: 4,
        }}
      >
        <animated.div
          style={{ width: bar.w, height: "100%", background: "var(--k-accent)" }}
        />
      </div>
      <div
        aria-hidden
        style={{ borderTop: "1px dashed var(--k-border)", marginBlock: 6 }}
      />
      <span
        style={{ ...mono, fontSize: "0.56rem", color: "var(--k-muted)", lineHeight: 1.8 }}
      >
        Settles into
        <br />
        <span style={{ color: "var(--k-accent)" }}>the studio&rsquo;s own account</span>
      </span>
      <span
        style={{
          ...mono,
          fontSize: "0.54rem",
          color: "var(--k-faint)",
          marginTop: "auto",
          lineHeight: 1.7,
        }}
      >
        Memberships billed as real subscriptions
      </span>
    </Stage>
  );
}

/* ── A ticket scanned at the gate ───────────────────────────────── */
function ScanStage({ play }: { play: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [didScan, setScanned] = useState(false);
  const scanned = reduced || didScan;
  useEffect(() => {
    if (!play) return;
    const id = setTimeout(() => setScanned(true), 900);
    return () => clearTimeout(id);
  }, [play]);

  const ring = useSpring({
    immediate: reduced,
    to: { scale: scanned ? 1 : 0.7, opacity: scanned ? 1 : 0 },
    config: { tension: 220, friction: 14 },
  });
  const sweep = useSpring({
    immediate: reduced,
    from: { y: -110 },
    to: { y: play && !scanned ? 110 : -110 },
    loop: play && !scanned,
    config: { duration: 1100 },
  });

  return (
    <Stage label="Gate · ticket scan">
      <div
        style={{
          position: "relative",
          height: 148,
          border: "1px solid var(--k-border)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {/* QR block */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 9px)",
            gridAutoRows: "9px",
            gap: 2,
          }}
        >
          {Array.from({ length: 49 }).map((_, i) => (
            <span
              key={i}
              style={{
                background:
                  // A stable, deterministic pattern — no Math.random, so the
                  // server and client render the same squares.
                  (i * 7 + (i % 5) * 3) % 3 === 0 ? "var(--k-fg)" : "transparent",
              }}
            />
          ))}
        </div>
        {!scanned && (
          <animated.div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 1,
              background: "var(--k-accent)",
              boxShadow: "0 0 12px var(--k-accent)",
              transform: sweep.y.to((y) => `translateY(${y}px)`),
            }}
          />
        )}
        <animated.div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "color-mix(in oklab, var(--k-bg) 78%, transparent)",
            opacity: ring.opacity,
            transform: ring.scale.to((s) => `scale(${s})`),
          }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 999,
              border: "1px solid var(--k-accent)",
              color: "var(--k-accent)",
              display: "grid",
              placeItems: "center",
              fontSize: "1.1rem",
            }}
          >
            ✓
          </span>
        </animated.div>
      </div>
      <span
        style={{
          ...mono,
          fontSize: "0.6rem",
          color: scanned ? "var(--k-accent)" : "var(--k-muted)",
        }}
      >
        {scanned ? "Admit — paid in full" : "Waiting for ticket…"}
      </span>
      <span
        style={{
          ...mono,
          fontSize: "0.54rem",
          color: "var(--k-faint)",
          marginTop: "auto",
          lineHeight: 1.7,
        }}
      >
        Every scan logged · not-paid stopped at the door
      </span>
    </Stage>
  );
}

/* ── An enquiry sealed before it leaves the page ────────────────── */
function SealStage({ play }: { play: boolean }) {
  const reduced = usePrefersReducedMotion();
  const lines = ["Name", "Email", "What brings you here", "Consent to contact"];
  const trail = useTrail(lines.length, {
    immediate: reduced,
    from: { opacity: 0, x: -14 },
    to: { opacity: play ? 1 : 0, x: play ? 0 : -14 },
    config: config.stiff,
    delay: 200,
  });
  const seal = useSpring({
    immediate: reduced,
    to: { opacity: play ? 1 : 0, y: play ? 0 : 10 },
    config: config.wobbly,
    delay: 1100,
  });

  return (
    <Stage label="Enquiry · encrypted at source">
      {trail.map((s, i) => (
        <animated.span
          key={lines[i]}
          style={{
            ...s,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 12px",
            border: "1px solid var(--k-border)",
            fontFamily: T.sans,
            fontSize: "0.78rem",
            color: "var(--k-fg)",
          }}
        >
          {lines[i]}
          <span style={{ ...mono, fontSize: "0.52rem", color: "var(--k-faint)" }}>
            ••••••
          </span>
        </animated.span>
      ))}
      <animated.span
        style={{
          ...seal,
          ...mono,
          fontSize: "0.56rem",
          color: "var(--k-accent)",
          border: "1px solid var(--k-accent)",
          padding: "7px 10px",
          textAlign: "center",
          marginTop: "auto",
        }}
      >
        Sealed — unreadable at rest
      </animated.span>
    </Stage>
  );
}

export function LiveSystems() {
  const { ref, inView } = useInView<HTMLDivElement>("-15% 0px -15% 0px");
  const reduced = usePrefersReducedMotion();
  const play = inView || reduced;

  return (
    <div ref={ref}>
      <Shell
        slug="the-dance-exclusive"
        client="The Dance Exclusive"
        sector="Dance school · across Essex"
        title="Money that arrives without being chased."
        body="Parents book and pay on their phones. Memberships bill themselves every month. The studio stopped reconciling bank transfers on a Sunday night."
        status="Live · carrying real payments"
      >
        <MoneyStage play={play} />
      </Shell>

      <Shell
        slug="suffolk-tennis"
        client="Suffolk Tennis"
        sector="LTA county partnership"
        title="A ticket, scanned at the gate."
        body="Players are invited, parents pay, and a ticket is issued to the phone in their pocket. At the door a coach scans it — admitted, already scanned, or not paid."
        status="Live · invitations and payments carrying real traffic"
      >
        <ScanStage play={play} />
      </Shell>

      <Shell
        slug="newfuture-therapy"
        client="NewFuture Therapy"
        sector="Counselling practice · Wakefield"
        title="Sealed before it leaves the page."
        body="A first message to a therapist is about the hardest thing someone has to say. It is encrypted the moment it is written, so even we cannot read it."
        status="Live site · course platform in private testing"
      >
        <SealStage play={play} />
      </Shell>

      <style>{`
        @media (max-width: 900px) {
          .ns-live { grid-template-columns: minmax(0,1fr) !important; }
        }
      `}</style>
    </div>
  );
}
