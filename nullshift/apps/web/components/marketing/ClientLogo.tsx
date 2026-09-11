import React from "react";
import type { ClientLogo as Logo } from "@nullshift/content/clientStories";
import { T } from "@nullshift/ui/tokens";

/** A client's mark at a fixed height so a 427×448 splat and a 720×229
 *  landscape lock-up sit on the same baseline. Image logos pick `darkSrc`
 *  on dark sections; marks with white ink only (`plate: "dark"`) always sit
 *  on a dark plate. A `wordmark` renders text + an optional leaf glyph. */
export function ClientLogo({
  logo,
  theme,
  height = 44,
}: {
  logo: Logo;
  theme: "dark" | "cream";
  height?: number;
}) {
  if (logo.kind === "image") {
    const src = theme === "dark" && logo.darkSrc ? logo.darkSrc : logo.src;
    const plated = logo.plate === "dark";
    const h = Math.round(height * (logo.scale ?? 1));
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        loading="lazy"
        style={{
          height: h,
          width: "auto",
          display: "block",
          maxWidth: "100%",
          marginBlock: -(h - height) / 2,
        }}
      />
    );
    if (!plated) return img;
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#0a0a0a",
          border: theme === "cream" ? "1px solid var(--k-border)" : undefined,
          padding: "6px 10px",
        }}
      >
        {img}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center" style={{ gap: 10, height }}>
      {logo.glyph === "leaf" && <Leaf height={height} />}
      <span className="flex flex-col" style={{ lineHeight: 1 }}>
        <span
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: height * 0.5,
            letterSpacing: "-0.01em",
            color: "var(--k-fg)",
          }}
        >
          {logo.text}
        </span>
        {logo.sub && (
          <span
            style={{
              fontFamily: T.mono,
              fontSize: height * 0.24,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--k-muted)",
              marginTop: 3,
            }}
          >
            {logo.sub}
          </span>
        )}
      </span>
    </span>
  );
}

/** NewFuture Therapy's line-veined leaf, from their `Logo.tsx`. Sage on
 *  either theme; the veins take the section background. */
function Leaf({ height }: { height: number }) {
  return (
    <svg
      height={height}
      viewBox="0 0 180 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d="M90 200 C20 150 10 80 90 20 C170 80 160 150 90 200Z" fill="#6B8C6F" />
      <line x1="90" y1="200" x2="90" y2="20" stroke="var(--k-bg)" strokeWidth="3" />
      <line x1="90" y1="120" x2="50" y2="80" stroke="var(--k-bg)" strokeWidth="2.5" />
      <line x1="90" y1="140" x2="130" y2="100" stroke="var(--k-bg)" strokeWidth="2.5" />
      <line x1="90" y1="160" x2="55" y2="130" stroke="var(--k-bg)" strokeWidth="2.5" />
      <line x1="90" y1="100" x2="125" y2="70" stroke="var(--k-bg)" strokeWidth="2.5" />
    </svg>
  );
}
