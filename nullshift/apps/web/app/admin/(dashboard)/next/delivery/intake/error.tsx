"use client";

import s from "../../next.module.css";
import o from "../../ops.module.css";

export default function IntakeError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className={`${o.notice} ${o.noticeDanger}`} role="alert">
      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
        Work intake could not be rendered.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        {error.digest ? `Reference ${error.digest}. ` : ""}No classification, split or
        next action was recorded by this render.
      </p>
      <button type="button" className={s.btn} onClick={() => unstable_retry()}>
        Try again
      </button>
    </div>
  );
}
