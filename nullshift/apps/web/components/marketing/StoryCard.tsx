import React from "react";
import Link from "next/link";
import type { ClientStory } from "@nullshift/content/clientStories";
import { T } from "@nullshift/ui/tokens";
import { MonoTag } from "@/components/kyma";
import { ClientLogo } from "./ClientLogo";
import { statusStamp } from "@/lib/clientStories";

/** The shared card — gallery on `/client-stories` and the homepage grid read
 *  the same data. `href` is the story's anchor: "#slug" on the gallery page,
 *  "/client-stories#slug" from the homepage. */
export function StoryCard({
  story,
  href,
  theme,
  cta = "Read the story",
}: {
  story: ClientStory;
  href: string;
  theme: "dark" | "cream";
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className="k-kard k-kard-h flex flex-col gap-4 h-full"
      style={{
        background: "var(--k-surface)",
        padding: "22px 24px",
        textDecoration: "none",
      }}
    >
      <span className="flex items-center justify-between gap-3">
        <ClientLogo logo={story.logo} theme={theme} height={40} />
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "0.62rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--k-faint)",
            textAlign: "right",
            maxWidth: "12ch",
            lineHeight: 1.5,
          }}
        >
          {statusStamp(story)}
        </span>
      </span>
      <MonoTag>{story.sector}</MonoTag>
      <span
        style={{
          fontFamily: T.sans,
          fontWeight: 700,
          fontSize: "1.25rem",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          color: "var(--k-fg)",
        }}
      >
        {story.homeCard.title}
      </span>
      <span
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          lineHeight: 1.65,
          color: "var(--k-muted)",
          flex: 1,
        }}
      >
        {story.summary}
      </span>
      <span
        className="inline-flex items-center gap-2"
        style={{
          fontFamily: T.mono,
          fontSize: "0.66rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--k-faint)",
          marginTop: 6,
        }}
      >
        {story.homeCard.meta}
        <span style={{ color: "var(--k-accent)" }}>
          {cta}
          <span className="k-arrow" aria-hidden>
            {" "}
            →
          </span>
        </span>
      </span>
    </Link>
  );
}
