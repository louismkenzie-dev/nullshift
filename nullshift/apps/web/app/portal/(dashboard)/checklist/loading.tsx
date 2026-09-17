import s from "@/lib/delivery/portal.module.css";

export default function Loading() {
  return (
    <div className={s.root} aria-busy="true" aria-live="polite">
      <p className={s.eyebrow}>Loading your checklist</p>
      <div className={s.skeleton}>
        <div className={s.skeletonLine} style={{ width: "60%" }} />
        <div className={s.skeletonLine} style={{ width: "80%" }} />
        <div className={s.skeletonBlock} />
        <div className={s.skeletonBlock} />
        <div className={s.skeletonBlock} />
      </div>
    </div>
  );
}
