"use client";

import s from "@/lib/delivery/portal.module.css";

export default function AcceptanceError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className={s.root}>
      <div className={`${s.notice} ${s.noticeDanger}`} role="alert">
        <p style={{ fontWeight: 600 }}>Build acceptance could not be loaded.</p>
        <p>
          {error.digest ? `Reference ${error.digest}. ` : ""}No acceptance was recorded by
          this page. If this keeps happening, reply to any email from Nullshift and quote
          the reference.
        </p>
        <div className={s.btnRow}>
          <button type="button" className={s.btn} onClick={() => unstable_retry()}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
