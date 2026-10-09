import s from "../shell.module.css";
import c from "./social.module.css";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className={c.skeleton} style={{ width: 160, marginBottom: 12 }} />
      <div
        className={c.skeleton}
        style={{ width: 240, minHeight: 28, marginBottom: 24 }}
      />
      <div className={s.stack}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={c.skeletonBlock} style={{ minHeight: 140 }} />
        ))}
      </div>
    </div>
  );
}
