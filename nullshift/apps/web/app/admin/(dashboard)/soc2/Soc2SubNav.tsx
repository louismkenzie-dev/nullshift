"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "@nullshift/ui/tokens";

/**
 * Compact mono link rail across the 14 readiness areas. Client component only
 * for the active-path highlight; carries no data.
 */
const LINKS: { label: string; href: string }[] = [
  { label: "Overview", href: "/admin/soc2" },
  { label: "Scope", href: "/admin/soc2/scope" },
  { label: "Controls", href: "/admin/soc2/controls" },
  { label: "Evidence", href: "/admin/soc2/evidence" },
  { label: "Exceptions", href: "/admin/soc2/exceptions" },
  { label: "Risks", href: "/admin/soc2/risks" },
  { label: "Policies", href: "/admin/soc2/policies" },
  { label: "Access reviews", href: "/admin/soc2/access-reviews" },
  { label: "Changes", href: "/admin/soc2/changes" },
  { label: "Incidents", href: "/admin/soc2/incidents" },
  { label: "Vendors", href: "/admin/soc2/vendors" },
  { label: "Continuity", href: "/admin/soc2/continuity" },
  { label: "Audit pack", href: "/admin/soc2/audit-pack" },
  { label: "Settings", href: "/admin/soc2/settings" },
];

export function Soc2SubNav({ bootstrap }: { bootstrap: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin/soc2" ? pathname === "/admin/soc2" : pathname.startsWith(href);

  return (
    <div style={{ marginBottom: 22 }}>
      <div className="flex flex-wrap gap-1.5">
        {LINKS.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontFamily: T.mono,
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "6px 10px",
                border: `1px solid ${active ? "var(--k-accent)" : "var(--k-border)"}`,
                color: active ? "var(--k-accent)" : "var(--k-muted)",
                background: active ? "rgba(16,185,129,0.08)" : "var(--k-surface)",
                whiteSpace: "nowrap",
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      {bootstrap && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: T.warning,
            marginTop: 10,
          }}
        >
          Setup mode — no programme roles exist yet. Appoint the Programme Owner under
          Settings; until then this area is read-only scaffolding.
        </p>
      )}
    </div>
  );
}
