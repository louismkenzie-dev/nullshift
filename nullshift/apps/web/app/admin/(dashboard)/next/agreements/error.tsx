"use client";

import { useEffect } from "react";
import s from "../next.module.css";

export default function AgreementsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Agreements error:", error);
  }, [error]);

  return (
    <div className={s.card} role="alert">
      <p className={s.mono} style={{ color: "var(--ns-danger)" }}>
        Agreements · error
      </p>
      <h2 className={s.h2}>The agreements library could not be rendered</h2>
      <p className={s.muted}>
        Nothing was changed. {error.digest ? `Reference ${error.digest}.` : ""}
      </p>
      <button className={s.btn} type="button" onClick={() => unstable_retry()}>
        Try again
      </button>
    </div>
  );
}
