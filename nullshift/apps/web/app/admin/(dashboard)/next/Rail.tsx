"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  FileText,
  House,
  LayoutGrid,
  Plus,
  Search,
  Settings2,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import s from "./next.module.css";

const PRIMARY = [
  { label: "Today", href: "/admin/next", icon: House },
  { label: "Clients", href: "/admin/next/clients", icon: Users },
  { label: "Sales & quotes", href: "/admin/next/sales", icon: BriefcaseBusiness },
  { label: "Delivery", href: "/admin/next/delivery", icon: LayoutGrid },
  { label: "Finance", href: "/admin/next/finance", icon: Wallet },
  { label: "Agreements", href: "/admin/next/agreements", icon: FileText },
];
function active(path: string, href: string) {
  if (href === "/admin/next") return path === href;
  if (href === "/admin/next/sales")
    return path.startsWith(href) || path.startsWith("/admin/next/quotes");
  return path.startsWith(href);
}
export function Rail() {
  const path = usePathname();
  return (
    <nav className={s.rail} aria-label="Operations navigation">
      <Link href="/admin/next" className={s.brand}>
        <Image src="/logos/nullshift-pill-dark.svg" alt="" width={22} height={27} />
        <span>
          Nullshift<span className={s.brandSub}>Operations</span>
        </span>
      </Link>
      <span className={s.railLabel}>Workspace</span>
      <div className={s.railList}>
        {PRIMARY.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(path, href) ? "page" : undefined}
            className={[s.railLink, active(path, href) ? s.railLinkActive : ""].join(" ")}
          >
            <Icon size={18} strokeWidth={1.6} />
            <span>{label}</span>
            {active(path, href) && <span className={s.activeDot} />}
          </Link>
        ))}
      </div>
      <div className={s.railFoot}>
        <Link href="/admin/next/automations" className={s.railLink}>
          <Workflow size={17} />
          Automations
        </Link>
        <Link href="/admin/next/settings" className={s.railLink}>
          <Settings2 size={17} />
          Settings
        </Link>
        <Link href="/admin" className={s.railLink}>
          <CircleHelp size={17} />
          Existing admin tools
        </Link>
        <div className={s.railNote}>
          A little less admin.
          <br />A lot more clarity.
        </div>
      </div>
    </nav>
  );
}
export function OperationsHeader() {
  const path = usePathname();
  const section = PRIMARY.find((item) => active(path, item.href));
  return (
    <header className={s.header}>
      <div className={s.crumbs}>
        <span>Workspace</span>
        <ChevronRight size={13} />
        <strong>{section?.label ?? "Tools"}</strong>
      </div>
      <form action="/admin/next/clients" className={s.headerSearch}>
        <Search size={16} />
        <input name="q" aria-label="Search clients" placeholder="Search clients…" />
      </form>
      <div className={s.headerRight}>
        <Link href="/admin/next/clients/new" className={s.headerAdd}>
          <Plus size={16} />
          <span>Add client</span>
        </Link>
        <Link
          href="/admin/security"
          className={s.accountButton}
          aria-label="Account and security"
        >
          <span>NS</span>
        </Link>
      </div>
    </header>
  );
}
export function DataContext({
  real,
  billingEnabled,
}: {
  real: boolean;
  billingEnabled: boolean;
}) {
  const path = usePathname();
  const actualRoutes = [
    "/admin/next",
    "/admin/next/clients",
    "/admin/next/clients/new",
    "/admin/next/sales",
    "/admin/next/delivery",
    "/admin/next/finance",
    "/admin/next/agreements",
    "/admin/next/settings",
    "/admin/next/automations",
  ];
  const actual =
    real &&
    (actualRoutes.includes(path) || /^\/admin\/next\/clients\/[0-9a-f-]{36}$/.test(path));
  return (
    <div className={actual ? s.dataContext : s.demoContext}>
      <span className={s.contextDot} />
      {actual ? "Your existing records" : "Design preview · Fictional data"}
      <span className={s.contextDivider}>/</span>
      <span>
        {actual
          ? billingEnabled
            ? "Existing agreements unchanged"
            : "New billing automation is off"
          : "Example workflow — not your client records"}
      </span>
    </div>
  );
}
export function BottomNav() {
  const path = usePathname();
  const entries = [
    PRIMARY[0],
    PRIMARY[1],
    PRIMARY[3],
    { label: "More", href: "/admin/next/settings", icon: LayoutGrid },
  ];
  return (
    <nav className={s.bottomNav} aria-label="Mobile navigation">
      {entries.map(({ label, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={[s.bottomLink, active(path, href) ? s.bottomLinkActive : ""].join(
            " "
          )}
          aria-current={active(path, href) ? "page" : undefined}
        >
          <Icon size={19} strokeWidth={1.7} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
