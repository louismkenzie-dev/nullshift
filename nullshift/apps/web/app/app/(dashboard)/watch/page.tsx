import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { PRODUCTS } from "@nullshift/content/products";
import { PageHeader, Panel, StatusChip } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { listSites } from "@/lib/watch/data";
import { addSiteAction } from "./actions";

export const dynamic = "force-dynamic";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1
    ? "just now"
    : m < 60
      ? `${m} min ago`
      : m < 1440
        ? `${Math.round(m / 60)} h ago`
        : `${Math.round(m / 1440)} d ago`;
};

export default async function WatchHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const { workspace, email, entitlement } = await requireProduct("watch");
  if (!entitlement.entitled)
    return <ProductGate product="watch" entitlement={entitlement} />;
  const sites = await listSites(workspace.tenantId);
  const p = PRODUCTS.watch;
  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="watch" />
      <PageHeader
        index={p.index}
        label={p.title}
        title="Sites you watch"
        lead="Uptime every fifteen minutes, SSL daily, broken links and speed weekly, and a report on the first of the month. Nothing to install."
      />
      {sp.error && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.danger }}>{sp.error}</p>
        </Panel>
      )}

      {sites.length > 0 && (
        <Panel pad={false}>
          <table className="k-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Status</th>
                <th>Speed (m / d)</th>
                <th>SSL</th>
                <th>Links</th>
                <th>Checked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const sslDays = s.ssl_expires_at
                  ? Math.floor(
                      (new Date(s.ssl_expires_at).getTime() - Date.now()) / 86_400_000
                    )
                  : null;
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.label}</strong>
                      <br />
                      <span style={{ color: "var(--k-muted)", fontSize: "0.8rem" }}>
                        {s.url}
                      </span>
                    </td>
                    <td>
                      <StatusChip
                        tone={
                          !s.active
                            ? "muted"
                            : s.status === "up"
                              ? "success"
                              : s.status === "down"
                                ? "danger"
                                : "muted"
                        }
                      >
                        {!s.active ? "paused" : s.status}
                      </StatusChip>
                    </td>
                    <td>
                      {s.speed_mobile ?? "—"} / {s.speed_desktop ?? "—"}
                    </td>
                    <td
                      style={{
                        color: sslDays !== null && sslDays < 14 ? T.warning : undefined,
                      }}
                    >
                      {sslDays === null ? "—" : `${sslDays} d`}
                    </td>
                    <td style={{ color: s.broken_links?.length ? T.warning : undefined }}>
                      {s.links_checked_at ? `${s.broken_links?.length ?? 0} broken` : "—"}
                    </td>
                    <td style={{ color: "var(--k-muted)", whiteSpace: "nowrap" }}>
                      {ago(s.last_checked_at)}
                    </td>
                    <td>
                      <Link href={`/app/watch/${s.id}`} className="kb kb-outline kb-sm">
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {sites.length < p.limits.sites && (
        <Panel label={`${sites.length} of ${p.limits.sites} sites`} title="Add a site">
          <form action={addSiteAction} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Website address</span>
              <input
                name="url"
                className="k-input"
                placeholder="www.client-site.co.uk"
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Label</span>
              <input
                name="label"
                className="k-input"
                placeholder="Client name or site"
                maxLength={80}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">Send downtime alerts to</span>
              <input
                name="alertEmail"
                type="email"
                className="k-input"
                defaultValue={email}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="k-label">
                Monthly report also goes to (client, optional)
              </span>
              <input
                name="clientEmail"
                type="email"
                className="k-input"
                placeholder="client@example.com"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="kb kb-primary">
                Start watching
                <span className="k-arrow" aria-hidden>
                  →
                </span>
              </button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
