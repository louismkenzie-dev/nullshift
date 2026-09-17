import s from "@/lib/delivery/portal.module.css";

export default function Loading() {
  return (
    <div className={s.root} aria-busy="true" aria-live="polite">
      <p className={s.eyebrow}>Loading build acceptance</p>
      <div className={s.skeleton}>
        <div className={s.skeletonLine} style={{ width: "55%" }} />
        <div className={s.skeletonLine} style={{ width: "85%" }} />
        <div className={s.skeletonBlock} />
        <div className={s.skeletonBlock} />
      </div>
    </div>
  );
}
