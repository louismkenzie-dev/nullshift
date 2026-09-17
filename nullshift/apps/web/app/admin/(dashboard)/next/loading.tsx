import s from "./next.module.css";
export default function Loading() {
  return (
    <section className={s.empty} role="status" aria-live="polite">
      <p className={s.eyebrow}>Nullshift Operations</p>
      <h2>Loading your workspace…</h2>
    </section>
  );
}
