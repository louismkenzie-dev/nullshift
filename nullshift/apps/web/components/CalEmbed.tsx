import { T } from "@nullshift/ui/tokens";

/**
 * Cal.com booking embed (brief §4 Contact). Renders only when NEXT_PUBLIC_CAL_LINK
 * is configured (e.g. "nullshift/discovery"); otherwise nothing shows and the
 * existing account/brief booking flow stands. Self-contained section.
 */
export function CalEmbed() {
  const link = process.env.NEXT_PUBLIC_CAL_LINK;
  if (!link) return null;

  return (
    <section
      className="mx-auto max-w-3xl px-6"
      style={{
        paddingBlock: "clamp(32px, 6vw, 64px)",
        borderTop: `1px solid ${T.border}`,
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          marginBottom: 16,
          fontFamily: T.mono,
          fontSize: "0.72rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.muted,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: T.primary,
            boxShadow: `0 0 0 4px ${T.primary}22`,
          }}
        />
        Prefer to grab a slot now?
      </div>
      <iframe
        src={`https://cal.com/${link}?theme=dark`}
        title="Book a call with Nullshift"
        loading="lazy"
        style={{
          width: "100%",
          height: 640,
          border: `1px solid ${T.border}`,
          borderRadius: T.r.xl,
          background: T.surface,
        }}
      />
    </section>
  );
}
