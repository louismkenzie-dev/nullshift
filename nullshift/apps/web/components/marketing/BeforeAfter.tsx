import { T } from "@nullshift/ui/tokens";

/* ════════════════════════════════════════════════════════════════
   BEFORE / AFTER — the fastest way a visitor recognises themselves.

   Every client we have taken on arrived running the same three tools:
   a spreadsheet, WhatsApp and manual bank transfers. Naming that back
   to them does more work than any description of what we build, so it
   sits directly under the walkthrough, in their words rather than ours.
   ════════════════════════════════════════════════════════════════ */

const PAIRS: { was: string; now: string }[] = [
  {
    was: "Chasing monthly fees by bank transfer",
    now: "Paid automatically, into your own account",
  },
  {
    was: "Paper registers, typed up later",
    now: "Marked on a phone as people walk in",
  },
  {
    was: "Allergies and medical notes kept in someone's head",
    now: "On the register row, in front of whoever is teaching",
  },
  {
    was: "Emailing people one at a time from a spreadsheet",
    now: "One click, and you can see who opened it",
  },
  {
    was: "“I never got that message” — and no way to check",
    now: "Every message shows whether it arrived",
  },
  {
    was: "Customer details sitting in an inbox",
    now: "Locked down properly, seen only by the people who should",
  },
  {
    was: "Waiting on someone technical to change a price or a page",
    now: "You change it yourself, in seconds",
  },
  {
    was: "“Who's in this room tonight, and have they paid?”",
    now: "One screen, always right",
  },
];

export function BeforeAfter() {
  return (
    <div
      style={{
        borderTop: "1px solid var(--k-border)",
        borderLeft: "1px solid var(--k-border)",
        borderRight: "1px solid var(--k-border)",
      }}
    >
      {PAIRS.map((p) => (
        <div
          key={p.was}
          className="ns-ba-row"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 40px 1fr",
            alignItems: "center",
            borderBottom: "1px solid var(--k-border)",
          }}
        >
          <div
            style={{
              padding: "14px clamp(14px,2vw,24px)",
              fontFamily: T.sans,
              fontSize: "0.92rem",
              lineHeight: 1.5,
              color: "var(--k-faint)",
              minWidth: 0,
            }}
          >
            {p.was}
          </div>
          <div
            aria-hidden
            className="ns-ba-arrow"
            style={{
              fontFamily: T.mono,
              fontSize: "0.8rem",
              color: "var(--k-accent)",
              textAlign: "center",
            }}
          >
            →
          </div>
          <div
            style={{
              padding: "14px clamp(14px,2vw,24px)",
              fontFamily: T.sans,
              fontSize: "0.92rem",
              lineHeight: 1.5,
              color: "var(--k-fg)",
              minWidth: 0,
            }}
          >
            {p.now}
          </div>
        </div>
      ))}

      {/* Side by side needs two readable columns; narrower than that the pair
          stacks and the arrow turns downward. */}
      <style>{`
        @media (max-width: 720px) {
          .ns-ba-row { grid-template-columns: minmax(0, 1fr) !important; }
          .ns-ba-arrow { display: none !important; }
          .ns-ba-row > div:first-child { padding-bottom: 2px !important; }
          .ns-ba-row > div:first-child::after { content: " ↓"; color: var(--k-accent); }
          .ns-ba-row > div:last-child { padding-top: 2px !important; }
        }
      `}</style>
    </div>
  );
}
