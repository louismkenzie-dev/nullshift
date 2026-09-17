"use client";

import s from "../next.module.css";
import o from "../ops.module.css";

export default function AutomationsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className={`${o.notice} ${o.noticeDanger}`} role="alert">
      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
        Automations could not be rendered.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        {error.digest ? `Reference ${error.digest}. ` : ""}No workflow ran; fixtures only.
      </p>
      <button type="button" className={s.btn} onClick={() => unstable_retry()}>
        Try again
      </button>
    </div>
  );
}
