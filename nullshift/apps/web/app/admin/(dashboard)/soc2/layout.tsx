import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { requireSoc2 } from "@/lib/soc2/guard";
import { Soc2SubNav } from "./Soc2SubNav";

export const dynamic = "force-dynamic";

/**
 * Security & SOC 2 Readiness — restricted internal section (spec: only
 * selected roles may view; client users can never reach it).
 *
 * Gate layering: the (dashboard) layout already enforces staff + MFA step-up;
 * this layout additionally requires a live programme role. While no roles
 * exist at all (bootstrap), staff see the area so the first Programme Owner
 * can be appointed from Settings — an audited act. Every server action
 * re-checks the guard itself: the layout is UX, the actions are the control.
 */
export default async function Soc2Layout({ children }: { children: React.ReactNode }) {
  const guard = await requireSoc2();

  if (!guard.ok) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <div
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: T.danger,
            marginBottom: 16,
          }}
        >
          PROGRAMME_ROLE_REQUIRED
        </div>
        <h1
          style={{
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: "1.6rem",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--k-fg)",
            marginBottom: 12,
          }}
        >
          Security &amp; SOC 2 Readiness is role-restricted
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.9rem", color: "var(--k-muted)" }}>
          Your staff account has no SOC 2 programme role. Ask the Programme Owner to grant
          one under <Link href="/admin/soc2/settings" style={{ color: "var(--k-accent)" }}>Settings</Link>.
          Access to controls, evidence, exceptions and exports is limited to programme roles.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Soc2SubNav bootstrap={guard.bootstrap} />
      {children}
    </div>
  );
}
