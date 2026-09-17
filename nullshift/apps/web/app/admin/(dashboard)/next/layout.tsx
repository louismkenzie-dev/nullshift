import type { Metadata } from "next";
import { BottomNav, Rail } from "./Rail";
import s from "./next.module.css";

export const metadata: Metadata = {
  title: "Nullshift — Operations (prototype)",
  robots: { index: false, follow: false },
};

/**
 * Admin redesign prototype shell (brief §4.3–4.5), Phase 1 slice.
 *
 * Deliberately mounted INSIDE the existing (dashboard) route group so the
 * current login → MFA step-up → staff check is inherited unchanged. The shell
 * paints over the legacy top bar with a fixed full-viewport container; the real
 * cut-over moves this into the layout once the design is approved. Every page
 * under /admin/next reads fixtures only and performs no writes.
 */
export default function NextLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell}>
      <Rail />
      <header className={s.header}>
        <div className={s.crumbs}>
          <span>Operations</span>
          <span aria-hidden="true">/</span>
          <strong>Prototype</strong>
        </div>
        <input
          className={s.search}
          type="search"
          placeholder="Search clients, projects, quotes, invoice refs…"
          aria-label="Search"
          disabled
        />
        <div className={s.headerRight}>
          <button
            className={s.btn}
            type="button"
            disabled
            title="Create menu — not in this slice"
          >
            + Create
          </button>
          <span className={s.mono}>louis · staff</span>
        </div>
      </header>
      <div className={s.content}>
        <div className={s.banner}>
          <span aria-hidden="true">▲</span> Fictional demo data — no live clients, prices
          or integrations
        </div>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
