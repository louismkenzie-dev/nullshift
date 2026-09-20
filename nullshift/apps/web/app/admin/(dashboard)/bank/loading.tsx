import s from "../shell.module.css";
import b from "./bank.module.css";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className={b.skeleton} style={{ width: 160, marginBottom: 12 }} />
      <div className={b.skeleton} style={{ width: 240, minHeight: 28, marginBottom: 24 }} />
      <div className={s.stack}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={b.skeletonBlock} style={{ minHeight: 120 }} />
        ))}
      </div>
    </div>
  );
}
