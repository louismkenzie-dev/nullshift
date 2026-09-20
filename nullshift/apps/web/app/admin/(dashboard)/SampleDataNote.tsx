import s from "./shell.module.css";

/**
 * Small per-page note for surfaces that still render from lib/next fixtures.
 * Replaces the shell-wide "Fictional demo data" banner: once a page reads live
 * data, delete its note rather than gating it.
 */
export function SampleDataNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className={s.banner} role="note">
      <span aria-hidden="true">▲</span>{" "}
      {children ?? "Sample data — fixtures only; no live clients, prices or integrations"}
    </p>
  );
}
