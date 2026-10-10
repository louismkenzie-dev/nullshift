import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { ProductGate, TrialStrip } from "@/components/products/ProductGate";
import { requireProduct } from "@/lib/products/session";
import { getSite, recentChecks, uptimeSummary } from "@/lib/watch/data";
import {
  removeSiteAction,
  runNowAction,
  sendReportNowAction,
  updateSiteAction,
} from "../actions";

export const dynamic = "force-dynamic";

const daysUntil = (iso: string | null) =>
  iso ? Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000) : null;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function WatchSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; report?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace, entitlement } = await requireProduct("watch", `/app/watch/${id}`);
  if (!entitlement.entitled)
    return <ProductGate product="watch" entitlement={entitlement} />;
  const s = await getSite(workspace.tenantId, id);
  if (!s) notFound();
  const [sum7, sum30, checks, speeds] = await Promise.all([
    uptimeSummary(s.id, 7),
    uptimeSummary(s.id, 30),
    recentChecks(s.id, undefined, 60),
    recentChecks(s.id, "speed", 12),
  ]);
  const sslDays = daysUntil(s.ssl_expires_at);

  return (
    <div className="flex flex-col gap-8">
      <TrialStrip entitlement={entitlement} product="watch" />
      <PageHeader
        index="03"
        label="Nullshift Watch"
        title={s.label}
        lead={
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--k-accent)" }}
          >
            {s.url}
          </a>
        }
        actions={
          <>
            <Link href="/app/watch" className="kb kb-outline">
              All sites
            </Link>
            <form action={runNowAction}>
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="kb kb-outline">
                Run all checks now
              </button>
            </form>
            <form action={sendReportNowAction}>
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="kb kb-primary">
                Email me the report
              </button>
            </form>
          </>
        }
      />
      {sp.saved && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>Settings saved.</p>
        </Panel>
      )}
      {sp.report && (
        <Panel>
          <p style={{ fontFamily: T.sans, color: T.success }}>
            Report sent to you. On the 1st it goes to the client too.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          value={sum30.pct === null ? "—" : `${sum30.pct}%`}
          label="Uptime · 30 days"
          sub={`${sum30.incidents} outage${sum30.incidents === 1 ? "" : "s"} · 7d ${sum7.pct ?? "—"}%`}
          accent={s.status === "up"}
        />
        <StatCard
          value={sum30.avgMs === null ? "—" : `${(sum30.avgMs / 1000).toFixed(2)}s`}
          label="Avg response"
        />
        <StatCard
          value={s.speed_mobile === null ? "—" : `${s.speed_mobile}`}
          label="Mobile speed /100"
          sub={s.speed_desktop === null ? undefined : `desktop ${s.speed_desktop}`}
        />
        <StatCard
          value={sslDays === null ? "—" : `${sslDays} d`}
          label="SSL valid for"
          sub={
            s.ssl_expires_at
              ? new Date(s.ssl_expires_at).toLocaleDateString("en-GB")
              : "not checked"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          label="Broken links"
          title={
            s.links_checked_at
              ? `${s.broken_links?.length ?? 0} found`
              : "Not checked yet"
          }
          actions={
            <StatusChip tone={s.broken_links?.length ? "warning" : "success"}>
              {s.links_checked_at ? `checked ${when(s.links_checked_at)}` : "pending"}
            </StatusChip>
          }
        >
          {s.broken_links?.length ? (
            <ul
              className="flex flex-col gap-2"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontFamily: T.sans,
                fontSize: "0.85rem",
              }}
            >
              {s.broken_links.slice(0, 25).map((b) => (
                <li key={b.href} className="flex justify-between gap-3">
                  <span style={{ color: "var(--k-fg)", wordBreak: "break-all" }}>
                    {b.href}
                  </span>
                  <span style={{ color: T.warning, whiteSpace: "nowrap" }}>
                    {b.status ?? b.error}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              Every link on the homepage answered.
            </p>
          )}
        </Panel>

        <Panel label="Speed history" title="PageSpeed scores">
          {speeds.length === 0 ? (
            <p style={{ fontFamily: T.sans, color: "var(--k-muted)" }}>
              First speed check runs within the hour.
            </p>
          ) : (
            <table className="k-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Mobile</th>
                  <th>Desktop</th>
                </tr>
              </thead>
              <tbody>
                {speeds.map((c) => (
                  <tr key={c.id}>
                    <td style={{ color: "var(--k-muted)" }}>{when(c.checked_at)}</td>
                    <td>{String(c.details.mobile ?? "—")}</td>
                    <td>{String(c.details.desktop ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel label="Recent checks" pad={false}>
        <table className="k-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Check</th>
              <th>Result</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <td style={{ color: "var(--k-muted)", whiteSpace: "nowrap" }}>
                  {when(c.checked_at)}
                </td>
                <td>{c.kind}</td>
                <td>
                  <StatusChip tone={c.ok ? "success" : "danger"}>
                    {c.ok ? "ok" : "failed"}
                  </StatusChip>
                </td>
                <td style={{ color: "var(--k-muted)", fontSize: "0.82rem" }}>
                  {c.kind === "uptime" &&
                    `${c.status_code ?? "no response"} · ${c.ms ?? "—"} ms${c.details.error ? ` · ${c.details.error}` : ""}`}
                  {c.kind === "ssl" &&
                    `${c.details.daysLeft ?? "—"} days left${c.details.issuer ? ` · ${c.details.issuer}` : ""}${c.details.error ? ` · ${c.details.error}` : ""}`}
                  {c.kind === "links" &&
                    `${c.details.checked ?? 0} checked · ${c.details.broken ?? 0} broken${c.details.error ? ` · ${c.details.error}` : ""}`}
                  {c.kind === "speed" &&
                    `mobile ${c.details.mobile ?? "—"} · desktop ${c.details.desktop ?? "—"}${c.details.error ? ` · ${c.details.error}` : ""}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel label="Settings">
        <form action={updateSiteAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={s.id} />
          <label className="flex flex-col gap-1.5">
            <span className="k-label">Label</span>
            <input
              name="label"
              className="k-input"
              defaultValue={s.label}
              maxLength={80}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="k-label">Downtime alerts to</span>
            <input
              name="alertEmail"
              type="email"
              className="k-input"
              defaultValue={s.alert_email ?? ""}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="k-label">Monthly report also to (client)</span>
            <input
              name="clientEmail"
              type="email"
              className="k-input"
              defaultValue={s.client_email ?? ""}
            />
          </label>
          <div
            className="flex flex-wrap items-center gap-5 sm:col-span-2"
            style={{ fontFamily: T.sans, color: "var(--k-fg)", fontSize: "0.9rem" }}
          >
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={s.active} /> Watching
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="uptime"
                defaultChecked={s.checks.uptime !== false}
              />{" "}
              Uptime
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="ssl" defaultChecked={s.checks.ssl !== false} />{" "}
              SSL
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="links"
                defaultChecked={s.checks.links !== false}
              />{" "}
              Broken links
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="speed"
                defaultChecked={s.checks.speed !== false}
              />{" "}
              Speed
            </label>
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" className="kb kb-primary">
              Save
            </button>
          </div>
        </form>
        <form action={removeSiteAction} className="mt-4">
          <input type="hidden" name="id" value={s.id} />
          <button
            type="submit"
            className="kb kb-outline kb-sm"
            style={{ color: T.danger, borderColor: T.danger }}
          >
            Stop watching and delete history
          </button>
        </form>
      </Panel>
    </div>
  );
}
