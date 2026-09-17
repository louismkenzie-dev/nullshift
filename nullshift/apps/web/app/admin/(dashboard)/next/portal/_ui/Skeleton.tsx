import s from "../portal.module.css";

/**
 * Route-level loading state for the portal preview: a phone-shaped frame with
 * neutral blocks, no spinner, no motion. "Loading" is announced once via the
 * status region so screen-reader users know the change is pending.
 */
export function PortalSkeleton() {
  return (
    <div className={s.frame} aria-busy="true">
      <div className={s.bar}>
        <span className={s.skeleton} style={{ width: 96 }} />
        <span className={`${s.skeleton} ${s.barClient}`} style={{ width: 120 }} />
      </div>
      <div className={s.body}>
        <p role="status" className={s.srOnly}>
          Loading your portal
        </p>
        <div className={s.skeleton} style={{ width: "40%" }} aria-hidden="true" />
        <div
          className={s.skeleton}
          style={{ width: "80%", minHeight: 26 }}
          aria-hidden="true"
        />
        <div className={s.skeletonBlock} aria-hidden="true" />
        <div className={s.skeletonBlock} aria-hidden="true" />
        <div className={s.skeletonBlock} aria-hidden="true" />
      </div>
      <div className={s.nav} aria-hidden="true" />
    </div>
  );
}
