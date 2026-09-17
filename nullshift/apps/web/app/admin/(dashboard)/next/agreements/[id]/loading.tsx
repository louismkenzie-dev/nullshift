import s from "../../next.module.css";
import a from "../agreements.module.css";

export default function Loading() {
  return (
    <div className={a.skeleton} aria-busy="true" aria-label="Loading agreement">
      <span className={s.mono}>Loading agreement…</span>
      <div className={`${a.bone} ${a.boneWide}`} />
      <div className={a.bone} />
      <div className={`${a.bone} ${a.boneBlock}`} />
      <div className={`${a.bone} ${a.boneBlock}`} />
    </div>
  );
}
