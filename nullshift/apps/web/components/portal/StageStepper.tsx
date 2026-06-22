import { T } from "@nullshift/ui/tokens";

const STAGES = [
  { key: "discovery", label: "Discovery" },
  { key: "build", label: "Build" },
  { key: "review", label: "Review" },
  { key: "live", label: "Live" },
  { key: "care", label: "Care" },
];

/** Compact, wrap-friendly project stage indicator (mobile-safe). */
export function StageStepper({ stage }: { stage: string }) {
  const idx = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
      {STAGES.map((s, i) => {
        const done = i <= idx;
        const current = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: done ? "var(--k-accent)" : "var(--k-border-strong)",
                boxShadow: current ? `0 0 0 3px rgba(16,185,129,0.18)` : "none",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: current
                  ? "var(--k-accent)"
                  : done
                    ? "var(--k-fg)"
                    : "var(--k-faint)",
              }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
