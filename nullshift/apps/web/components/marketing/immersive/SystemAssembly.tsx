"use client";

import React, { useRef } from "react";
import { createTimeline, onScroll, stagger, svg } from "animejs";
import { T } from "@nullshift/ui/tokens";
import { useAnimeScope, useHeavyMotion } from "@/lib/motion";

/* ════════════════════════════════════════════════════════════════
   SYSTEM ASSEMBLY — scrolling builds the thing.

   A tall section with a sticky stage. As you descend, an interface
   constructs itself in front of you: the frame draws, the structure
   blocks in, the real parts drop into their slots, the brand goes on,
   and it comes alive. The scroll position IS the timeline, so the
   visitor is doing the building.

   It ends on a deliberate note — the same skeleton relabelled for a
   different trade — because the argument of the page is that the parts
   are ours and the arrangement is yours.

   Below the heavy-motion threshold the whole thing renders in its
   finished state and simply scrolls past. A phone gets the picture,
   not five synchronised timelines.
   ════════════════════════════════════════════════════════════════ */

const STAGES = [
  { n: "01", t: "A blank canvas", d: "No template. Nothing assumed about how you work." },
  {
    n: "02",
    t: "The structure",
    d: "We map what your business actually does, then block it out.",
  },
  {
    n: "03",
    t: "The parts",
    d: "Bookings, payments, records, people — whichever ones you need.",
  },
  { n: "04", t: "Your brand", d: "It looks like you, not like software." },
  { n: "05", t: "Live", d: "Real data, real customers, running on its own." },
];

/* The rows that drop into the built interface. Deliberately mixed, so no
   one reads this as a booking product. */
const ROWS = [
  { label: "New enquiry", meta: "2 min ago" },
  { label: "Payment received", meta: "£240.00" },
  { label: "Job scheduled", meta: "Thu 09:00" },
  { label: "Stock updated", meta: "−12 units" },
  { label: "Report sent", meta: "Delivered" },
];

export function SystemAssembly() {
  const root = useRef<HTMLDivElement>(null);
  const heavy = useHeavyMotion();

  useAnimeScope(
    root,
    heavy,
    (el) => {
      const q = <T extends Element>(s: string) => el.querySelectorAll<T>(s);

      const tl = createTimeline({
        defaults: { ease: "inOutQuad" },
        autoplay: onScroll({
          target: el,
          // Scrub against the section's own travel, smoothed a touch so a
          // trackpad flick does not strobe the build.
          enter: "top top",
          leave: "bottom bottom",
          sync: 0.35,
        }),
      });

      // 01 — the frame draws itself.
      tl.add(
        svg.createDrawable(q("[data-frame]")),
        { draw: ["0 0", "0 1"], duration: 300 },
        0
      );

      // 02 — structure blocks in.
      tl.add(
        q("[data-block]"),
        { opacity: [0, 1], scaleY: [0.2, 1], duration: 220, delay: stagger(30) },
        260
      );

      // 03 — the real parts replace the blocks.
      tl.add(q("[data-block]"), { opacity: [1, 0], duration: 140 }, 520);
      tl.add(
        q("[data-row]"),
        { opacity: [0, 1], x: [-18, 0], duration: 220, delay: stagger(40) },
        540
      );

      // 04 — brand goes on: the accent arrives and the header fills.
      tl.add(q("[data-brand]"), { opacity: [0, 1], duration: 260 }, 820);
      tl.add(q("[data-accent]"), { opacity: [0, 1], scaleX: [0, 1], duration: 300 }, 840);

      // 05 — it comes alive.
      tl.add(q("[data-live]"), { opacity: [0, 1], y: [8, 0], duration: 260 }, 1080);
      tl.add(
        q("[data-pulse]"),
        { opacity: [0.25, 1], duration: 200, delay: stagger(60) },
        1120
      );

      // The stage label tracks the build.
      q("[data-stage-label]").forEach((node, i) => {
        tl.add(node, { opacity: [0.25, 1], duration: 120 }, i * 270);
        if (i < STAGES.length - 1)
          tl.add(node, { opacity: [1, 0.25], duration: 120 }, i * 270 + 240);
      });
    },
    [heavy]
  );

  return (
    <section
      ref={root}
      className="k-dark relative"
      style={{
        background: "var(--k-bg)",
        color: "var(--k-fg)",
        borderTop: "1px dashed var(--k-border)",
        // Tall enough to give the build room to happen; on the calm path it
        // collapses to a single screen because nothing is being scrubbed.
        height: heavy ? "340svh" : "auto",
      }}
    >
      <div
        style={{
          position: heavy ? "sticky" : "static",
          top: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          className="ns-asm"
          style={{
            width: "100%",
            maxWidth: 1320,
            margin: "0 auto",
            paddingInline: "clamp(20px,5vw,64px)",
            paddingBlock: "clamp(72px,10vh,120px)",
            display: "grid",
            gridTemplateColumns: "minmax(0,0.85fr) minmax(0,1.15fr)",
            alignItems: "center",
            gap: "clamp(28px,5vw,72px)",
          }}
        >
          {/* ── Words + the stage ladder ── */}
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                fontFamily: T.mono,
                fontSize: "0.68rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
              }}
            >
              [02] How anything gets built
            </span>
            <h2
              className="mt-6"
              style={{
                margin: 0,
                fontFamily: T.sans,
                fontWeight: 500,
                fontSize: "clamp(1.9rem,4vw,3rem)",
                lineHeight: 0.9,
                letterSpacing: "normal",
                textTransform: "uppercase",
                color: "var(--k-fg)",
              }}
            >
              Watch one get made.
            </h2>

            <ol
              style={{
                listStyle: "none",
                margin: 0,
                marginTop: "clamp(28px,3vw,46px)",
                padding: 0,
                display: "grid",
                gap: 14,
              }}
            >
              {STAGES.map((s, i) => (
                <li
                  key={s.n}
                  data-stage-label
                  style={{
                    opacity: heavy ? 0.25 : 1,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 14,
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.66rem",
                      letterSpacing: "0.12em",
                      color: i === 0 ? "var(--k-accent)" : "var(--k-muted)",
                    }}
                  >
                    {s.n}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontFamily: T.sans,
                        fontWeight: 600,
                        fontSize: "1rem",
                        color: "var(--k-fg)",
                      }}
                    >
                      {s.t}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: T.sans,
                        fontSize: "0.9rem",
                        lineHeight: 1.5,
                        color: "var(--k-muted)",
                        marginTop: 2,
                      }}
                    >
                      {s.d}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* ── The thing being built ── */}
          <div style={{ minWidth: 0, display: "flex", justifyContent: "center" }}>
            <div
              aria-hidden
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 560,
                aspectRatio: "4 / 3",
                background: "var(--k-surface)",
              }}
            >
              {/* The frame that draws */}
              <svg
                viewBox="0 0 400 300"
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              >
                <rect
                  data-frame
                  x="0.5"
                  y="0.5"
                  width="399"
                  height="299"
                  fill="none"
                  stroke="var(--k-border-strong)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: "clamp(14px,2.2vw,22px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Header — brand goes on here */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    data-accent
                    style={{
                      width: 26,
                      height: 8,
                      background: "var(--k-accent)",
                      opacity: heavy ? 0 : 1,
                      transformOrigin: "left center",
                      display: "block",
                    }}
                  />
                  <span
                    data-brand
                    style={{
                      fontFamily: T.mono,
                      fontSize: "0.6rem",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--k-fg)",
                      opacity: heavy ? 0 : 1,
                    }}
                  >
                    Your business
                  </span>
                  <span
                    data-live
                    style={{
                      marginLeft: "auto",
                      fontFamily: T.mono,
                      fontSize: "0.54rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--k-accent)",
                      border: "1px solid var(--k-accent)",
                      padding: "2px 7px",
                      opacity: heavy ? 0 : 1,
                    }}
                  >
                    Live
                  </span>
                </div>

                {/* Structure blocks, then real rows in the same slots */}
                <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {ROWS.map((r) => (
                      <span
                        key={`b-${r.label}`}
                        data-block
                        style={{
                          flex: 1,
                          background: "var(--k-border)",
                          opacity: heavy ? 0 : 0,
                          transformOrigin: "center",
                          display: "block",
                        }}
                      />
                    ))}
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {ROWS.map((r) => (
                      <span
                        key={r.label}
                        data-row
                        style={{
                          flex: 1,
                          minHeight: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          paddingInline: 10,
                          border: "1px solid var(--k-border)",
                          opacity: heavy ? 0 : 1,
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <span
                            data-pulse
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 999,
                              background: "var(--k-accent)",
                              opacity: heavy ? 0.25 : 1,
                              flex: "0 0 5px",
                            }}
                          />
                          <span
                            style={{
                              fontFamily: T.sans,
                              fontSize: "clamp(0.68rem,1vw,0.8rem)",
                              color: "var(--k-fg)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {r.label}
                          </span>
                        </span>
                        <span
                          style={{
                            fontFamily: T.mono,
                            fontSize: "clamp(0.52rem,0.8vw,0.62rem)",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "var(--k-muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.meta}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ns-asm { grid-template-columns: minmax(0,1fr) !important; }
        }
      `}</style>
    </section>
  );
}
