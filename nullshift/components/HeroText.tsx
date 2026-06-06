"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { T } from "@/lib/tokens";

const WORDS = ["NULLSHIFT", "WE BUILD", "BESPOKE", "NO TEMPLATES"];
const CYCLE_MS = 3200; // time each word holds before re-shuttering

export default function HeroText() {
  const [index, setIndex] = useState(0);
  const word = WORDS[index % WORDS.length];
  const characters = word.split("");

  useEffect(() => {
    const id = setInterval(() => setIndex((c) => c + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const sliceClass =
    "absolute inset-0 leading-none font-black z-10 pointer-events-none";
  const bigText: React.CSSProperties = {
    fontFamily: T.display,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  };

  return (
    <section
      className="relative flex flex-col items-center justify-center min-h-screen w-full overflow-hidden"
      style={{ background: T.bg }}
    >
      {/* Immersive background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.12,
          backgroundImage:
            "linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)",
          backgroundSize: "clamp(20px, 5vw, 60px) clamp(20px, 5vw, 60px)",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      {/* Ambient emerald glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 50%, color-mix(in oklab, ${T.primary} 8%, transparent) 0%, transparent 70%)`,
        }}
      />

      {/* Eyebrow */}
      <div
        className="absolute top-20 left-8 md:left-16 flex items-center gap-3 z-20"
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
        }}
      >
        <span className="size-1.5 rounded-full pulse-dot" style={{ background: T.primary }} />
        <span>SYS_01 / WEB_DEV</span>
      </div>

      {/* Main sliced text */}
      <div className="relative z-10 w-full px-4 flex flex-col items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="flex flex-wrap justify-center items-center w-full"
          >
            {characters.map((char, i) => (
              <div key={i} className="relative px-[0.1vw] overflow-hidden">
                {/* Base character */}
                <motion.span
                  initial={{ opacity: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: i * 0.04 + 0.3, duration: 0.8 }}
                  className="text-[17vw] md:text-[15vw] leading-none font-black"
                  style={{ ...bigText, color: T.fg }}
                >
                  {char === " " ? " " : char}
                </motion.span>

                {/* Top slice — emerald */}
                <motion.span
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "100%", opacity: [0, 1, 0] }}
                  transition={{ duration: 0.7, delay: i * 0.04, ease: "easeInOut" }}
                  className={`${sliceClass} text-[17vw] md:text-[15vw]`}
                  style={{ ...bigText, color: T.primary, clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)" }}
                >
                  {char === " " ? " " : char}
                </motion.span>

                {/* Middle slice — pale */}
                <motion.span
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: "-100%", opacity: [0, 1, 0] }}
                  transition={{ duration: 0.7, delay: i * 0.04 + 0.1, ease: "easeInOut" }}
                  className={`${sliceClass} text-[17vw] md:text-[15vw]`}
                  style={{ ...bigText, color: "#d4d4d8", clipPath: "polygon(0 35%, 100% 35%, 100% 65%, 0 65%)" }}
                >
                  {char === " " ? " " : char}
                </motion.span>

                {/* Bottom slice — emerald */}
                <motion.span
                  initial={{ x: "-100%", opacity: 0 }}
                  animate={{ x: "100%", opacity: [0, 1, 0] }}
                  transition={{ duration: 0.7, delay: i * 0.04 + 0.2, ease: "easeInOut" }}
                  className={`${sliceClass} text-[17vw] md:text-[15vw]`}
                  style={{ ...bigText, color: T.primary, clipPath: "polygon(0 65%, 100% 65%, 100% 100%, 0 100%)" }}
                >
                  {char === " " ? " " : char}
                </motion.span>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subheading + CTA */}
      <div className="absolute bottom-28 md:bottom-32 z-20 flex flex-col items-center gap-6 px-6 text-center">
        <p
          className="max-w-[42ch]"
          style={{ fontFamily: T.sans, fontWeight: 400, fontSize: "clamp(0.9rem,1.3vw,1.05rem)", lineHeight: 1.65, color: T.muted }}
        >
          Nullshift helps established businesses make the move online — with websites and branding built to last.
        </p>
        <a
          href="/book"
          className="inline-flex items-center gap-3 px-6 h-12 font-semibold transition-opacity hover:opacity-90"
          style={{ fontFamily: T.mono, fontSize: "0.78rem", letterSpacing: "0.06em", textTransform: "uppercase", background: T.primary, color: T.primaryFg, borderRadius: "2px", boxShadow: `0 0 24px color-mix(in oklab, ${T.primary} 30%, transparent)` }}
        >
          Book a discovery call →
        </a>
      </div>

      {/* Corner accents */}
      <div className="absolute top-16 left-8 w-12 h-12 border-l border-t" style={{ borderColor: T.border }} />
      <div className="absolute bottom-8 right-8 w-12 h-12 border-r border-b" style={{ borderColor: T.border }} />
    </section>
  );
}
