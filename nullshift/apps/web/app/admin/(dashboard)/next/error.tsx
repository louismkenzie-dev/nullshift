"use client";
import Link from "next/link";
import s from "./next.module.css";

export default function OperationsError({ reset }: { reset: () => void }) {
  return (
    <section className={s.empty} role="alert">
      <h1 className={s.h1}>Couldn’t load this view.</h1>
      <p>
        Your records haven’t been replaced with example data. Check your connection and
        try again.
      </p>
      <div className={s.actions}>
        <button className={s.btnPrimary} onClick={reset}>
          Try again
        </button>
        <Link href="/admin/next" className={s.btnGhost}>
          Back to Today
        </Link>
        <Link href="/admin/login" className={s.btnGhost}>
          Sign in again
        </Link>
      </div>
    </section>
  );
}
