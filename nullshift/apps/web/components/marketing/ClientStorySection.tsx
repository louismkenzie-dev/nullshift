import React from "react";
import type { Beat, ClientStory } from "@nullshift/content/clientStories";
import { T } from "@nullshift/ui/tokens";
import {
  Reveal,
  Section,
  Display,
  Lead,
  MonoTag,
  Tag,
  StatGrid,
  TextLink,
} from "@/components/kyma";
import { muxMp4Url, muxPosterUrl, statusStamp, storyTheme } from "@/lib/clientStories";
import { ClientLogo } from "./ClientLogo";
import { LiveDemo } from "./demos";
import { NullshiftPlayer } from "./NullshiftPlayer";

/** The uniform story template: header + stamp, three beats, the live demo
 *  reproduced from the client's own code, then the testimonial beside the
 *  ownership proof and the numbers. Content is data — see
 *  `packages/content/src/clientStories.ts`. */
export function ClientStorySection({
  story,
  index,
}: {
  story: ClientStory;
  index: number;
}) {
  const theme = storyTheme(index);
  const n = String(index + 1).padStart(2, "0");
  const id = story.video.muxPlaybackId;
  const stamp = statusStamp(story);
  const isLive = stamp.startsWith("Live");

  return (
    <Section
      id={story.slug}
      theme={theme}
      pad="lg"
      topBorder
      style={{ scrollMarginTop: 64 }}
    >
      {/* Header */}
      <Reveal>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div style={{ maxWidth: 720 }}>
            <div className="flex flex-wrap items-center gap-4">
              <ClientLogo logo={story.logo} theme={theme} height={48} />
              <MonoTag tone="muted">
                {n} · {story.sector}
              </MonoTag>
            </div>
            <Display size="md" className="mt-6">
              {story.name}
            </Display>
            <Lead className="mt-4">{story.summary}</Lead>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span
              className="inline-flex items-center gap-2"
              style={{
                fontFamily: T.mono,
                fontSize: "0.7rem",
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
                border: "1px solid var(--k-border)",
                padding: "8px 12px",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: isLive ? "var(--k-accent)" : "var(--k-faint)",
                }}
              />
              <span style={{ color: isLive ? "var(--k-accent)" : "var(--k-fg)" }}>
                {isLive ? "Live" : "Launching"}
              </span>
              {stamp.replace(/^(Live|Launching) /, "")}
            </span>
            {story.liveUrl && (
              <TextLink href={story.liveUrl}>{story.displayUrl}</TextLink>
            )}
          </div>
        </div>
      </Reveal>

      {/* Beats */}
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        <BeatCard eyebrow="What they had" beat={story.beats.had} delay={0} />
        <BeatCard eyebrow="What we built" beat={story.beats.built} delay={0.07} />
        <BeatCard eyebrow="What runs itself now" beat={story.beats.runs} delay={0.14} />
      </div>

      {/* Live demo — the product, reproduced from their code, in motion */}
      <div className="mt-14">
        <Reveal>
          <LiveDemo story={story} theme={theme} />
        </Reveal>
      </div>

      {/* Testimonial + proof */}
      <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[4fr_8fr] lg:items-start">
        <Reveal>
          <div style={{ maxWidth: 300 }}>
            <NullshiftPlayer
              title={`${story.video.speaker}, ${story.name} — video testimonial`}
              label={`Client story · ${story.name}`}
              aspect="9 / 16"
              src={id ? muxMp4Url(id) : null}
              poster={id ? muxPosterUrl(id) : undefined}
              captionsSrc={story.video.captionsSrc}
            />
            <p
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--k-faint)",
                marginTop: 12,
              }}
            >
              {story.video.speaker} · {story.video.role}
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div
            className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"
            style={{ borderTop: "1px solid var(--k-border)", paddingTop: 22 }}
          >
            <div className="flex flex-col gap-3">
              <MonoTag>Owned outright</MonoTag>
              <div className="flex flex-wrap gap-2">
                {story.proof.ownership.map((o) => (
                  <Tag key={o}>{o}</Tag>
                ))}
              </div>
            </div>
            <div
              className="flex flex-wrap gap-x-6 gap-y-2"
              style={{
                fontFamily: T.mono,
                fontSize: "0.68rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
              }}
            >
              <Check
                on={story.proof.dpaSigned}
                label="Data processing agreement signed"
              />
              <Check on={story.proof.carePlan} label="On a care plan" />
            </div>
          </div>
          {story.stats.length > 0 && (
            <div className="mt-8">
              <StatGrid stats={story.stats} cols={2} />
            </div>
          )}
        </Reveal>
      </div>
    </Section>
  );
}

function BeatCard({
  eyebrow,
  beat,
  delay,
}: {
  eyebrow: string;
  beat: Beat;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div
        className="k-kard flex h-full flex-col gap-3"
        style={{ background: "var(--k-surface)", padding: "22px 24px" }}
      >
        <MonoTag>{eyebrow}</MonoTag>
        <h3
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "1.15rem",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            color: "var(--k-fg)",
            margin: 0,
          }}
        >
          {beat.title}
        </h3>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.92rem",
            lineHeight: 1.65,
            color: "var(--k-muted)",
            margin: 0,
            flex: 1,
          }}
        >
          {beat.body}
        </p>
        {beat.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5" style={{ marginTop: 6 }}>
            {beat.chips.map((c) => (
              <span
                key={c}
                style={{
                  fontFamily: T.mono,
                  fontSize: "9px",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                  background: "rgba(16,185,129,0.1)",
                  padding: "3px 8px",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden style={{ color: on ? "var(--k-accent)" : "var(--k-faint)" }}>
        {on ? "✓" : "·"}
      </span>
      <span style={{ color: on ? "var(--k-fg)" : "var(--k-faint)" }}>{label}</span>
    </span>
  );
}
