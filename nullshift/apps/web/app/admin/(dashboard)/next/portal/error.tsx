"use client";

import { useEffect } from "react";
import s from "./portal.module.css";

/**
 * Error boundary for the portal preview. "Failed to load" is a different state
 * from "no data" (brief §13): it says so, keeps the frame, and offers retry.
 * The error message itself is not shown — Next redacts server errors in
 * production and a client should never see internals.
 */
export default function PortalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error("Portal preview error:", error);
  }, [error]);
  const retry = unstable_retry ?? reset;

  return (
    <div className={s.frame} role="alert">
      <div className={s.bar}>
        <div className={s.barBrand}>
          <span className={s.barDot} aria-hidden="true" />
          Nullshift
        </div>
      </div>
      <div className={s.body}>
        <header>
          <p className={s.eyebrow}>Something went wrong</p>
          <h1 className={s.h1}>We could not load this page</h1>
          <p className={s.lead}>
            Nothing you entered has been lost. Try again; if it keeps happening, email us
            and quote the reference below.
          </p>
        </header>
        {error.digest ? (
          <p className={`${s.notice} ${s.noticeMuted}`}>Reference {error.digest}</p>
        ) : null}
        <div className={s.actions}>
          {retry ? (
            <button
              type="button"
              className={`${s.btnPrimary} ${s.btnBlock}`}
              onClick={retry}
            >
              Try again
            </button>
          ) : null}
          <a href="/admin/next/portal" className={`${s.btn} ${s.btnBlock}`}>
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
