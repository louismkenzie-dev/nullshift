"use client";

import s from "../shell.module.css";
import b from "./bank.module.css";

export default function BankError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className={`${b.notice} ${b.noticeDanger}`} role="alert">
      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>The bank feed could not be rendered.</p>
      <p style={{ margin: "0 0 12px" }}>
        {error.digest ? `Reference ${error.digest}. ` : ""}No sync ran and no decision was recorded.
      </p>
      <button type="button" className={s.btn} onClick={() => unstable_retry()}>
        Try again
      </button>
    </div>
  );
}
