"use client";

import { useEffect } from "react";
import Link from "next/link";
import s from "../next.module.css";

/** Error boundary for the Finance area. Client component per Next.js convention. */
export default function FinanceError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Finance (prototype) error:", error);
  }, [error]);

  return (
    <div className={s.card} role="alert">
      <p className={s.mono} style={{ color: "var(--ns-danger)" }}>
        Finance could not render
      </p>
      <h2 className={s.h2}>Something went wrong on this page</h2>
      <p className={s.muted}>
        No data was changed — Finance pages in this prototype never write.{" "}
        {error.message || "Unknown error"}
        {error.digest ? <span className={s.faint}> · digest {error.digest}</span> : null}
      </p>
      <div className={s.chips}>
        <button className={s.btn} type="button" onClick={() => unstable_retry()}>
          Try again
        </button>
        <Link className={s.btn} href="/admin/next/finance">
          Back to Finance overview
        </Link>
      </div>
    </div>
  );
}
