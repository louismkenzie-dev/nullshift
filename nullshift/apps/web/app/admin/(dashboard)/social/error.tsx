"use client";

import s from "../shell.module.css";
import c from "./social.module.css";

export default function SocialError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className={`${c.notice} ${c.noticeDanger}`} role="alert">
      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
        The social queue could not be rendered.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        {error.digest ? `Reference ${error.digest}. ` : ""}Nothing was published or
        changed.
      </p>
      <button type="button" className={s.btn} onClick={() => unstable_retry()}>
        Try again
      </button>
    </div>
  );
}
