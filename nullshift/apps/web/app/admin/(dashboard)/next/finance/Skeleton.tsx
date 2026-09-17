import f from "./finance.module.css";

/** Static loading placeholder shared by every Finance segment's loading.tsx. */
export function Skeleton({
  rows = 4,
  metrics = false,
}: {
  rows?: number;
  metrics?: boolean;
}) {
  return (
    <div className={f.skeleton} role="status" aria-live="polite" aria-label="Loading">
      {metrics ? (
        <div className={f.boneRow}>
          <div className={`${f.bone} ${f.boneTall}`} />
          <div className={`${f.bone} ${f.boneTall}`} />
          <div className={`${f.bone} ${f.boneTall}`} />
        </div>
      ) : null}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={f.bone} />
      ))}
    </div>
  );
}
