"use client";

import Link from "next/link";
import { useEffect } from "react";
import s from "../../next.module.css";

export default function AgreementError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Agreement workspace error:", error);
  }, [error]);

  return (
    <div className={s.card} role="alert">
      <p className={s.mono} style={{ color: "var(--ns-danger)" }}>
        Agreement · error
      </p>
      <h2 className={s.h2}>This document could not be rendered</h2>
      <p className={s.muted}>
        Nothing was changed. {error.digest ? `Reference ${error.digest}.` : ""}
      </p>
      <div className={s.chips}>
        <button className={s.btn} type="button" onClick={() => unstable_retry()}>
          Try again
        </button>
        <Link href="/admin/next/agreements" className={s.btn}>
          Back to library
        </Link>
      </div>
    </div>
  );
}
