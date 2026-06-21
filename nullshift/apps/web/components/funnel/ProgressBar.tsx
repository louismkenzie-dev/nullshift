import { T } from "@nullshift/ui/tokens";

/** Thin, branded funnel progress indicator. `current`/`total` are 1-based
 *  positions within the visible question sequence. */
export function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (current / total) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Question ${current} of ${total}`}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.muted,
          }}
        >
          Question {current} / {total}
        </span>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.1em",
            color: T.primary,
          }}
        >
          {Math.round(pct)}%
        </span>
      </div>
      <div
        style={{ height: 3, borderRadius: 0, background: T.surface2, overflow: "hidden" }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: T.primary,
            borderRadius: 0,
            boxShadow: `0 0 12px ${T.primarySoft}`,
            transition: "width 0.5s cubic-bezier(.16,1,.3,1)",
          }}
        />
      </div>
    </div>
  );
}
