import { createServiceClient } from "@nullshift/db";
import { PRODUCTS } from "@nullshift/content/products";
import { entitlementFor } from "@/lib/products/entitlement";
import { sendEmail } from "@/lib/sendEmail";
import {
  checkLinks,
  checkSpeed,
  checkSsl,
  checkUptime,
  normaliseUrl,
  uptimePercent,
  type BrokenLink,
} from "./checks";
import { downEmail, monthlyReportEmail, recoveredEmail, sslEmail } from "./emails";

export type SiteRow = {
  id: string;
  tenant_id: string;
  url: string;
  label: string;
  client_email: string | null;
  alert_email: string | null;
  checks: { uptime: boolean; ssl: boolean; links: boolean; speed: boolean };
  active: boolean;
  status: "up" | "down" | "unknown";
  consecutive_failures: number;
  last_checked_at: string | null;
  last_down_at: string | null;
  last_alert_at: string | null;
  ssl_expires_at: string | null;
  ssl_checked_at: string | null;
  ssl_alerted_at: string | null;
  speed_mobile: number | null;
  speed_desktop: number | null;
  speed_checked_at: string | null;
  links_checked_at: string | null;
  broken_links: BrokenLink[];
  last_report_at: string | null;
  created_at: string;
};

export type CheckRow = {
  id: string;
  site_id: string;
  kind: "uptime" | "ssl" | "links" | "speed";
  ok: boolean;
  status_code: number | null;
  ms: number | null;
  details: Record<string, unknown>;
  checked_at: string;
};

const site = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(/\/$/, "");
const HOURS = 3_600_000;
const olderThan = (iso: string | null, ms: number) =>
  !iso || Date.now() - new Date(iso).getTime() > ms;

export async function listSites(tenantId: string): Promise<SiteRow[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("monitored_sites")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at");
  return (data ?? []) as SiteRow[];
}

export async function getSite(tenantId: string, id: string): Promise<SiteRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("monitored_sites")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as SiteRow | null) ?? null;
}

export async function addSite(opts: {
  tenantId: string;
  url: string;
  label: string;
  clientEmail: string | null;
  alertEmail: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const url = normaliseUrl(opts.url);
  if (!url)
    return { ok: false, error: "That does not look like a public website address." };
  const existing = await listSites(opts.tenantId);
  if (existing.length >= PRODUCTS.watch.limits.sites)
    return { ok: false, error: `Your plan covers ${PRODUCTS.watch.limits.sites} sites.` };
  if (existing.some((s) => s.url === url))
    return { ok: false, error: "You are already watching that address." };
  const db = createServiceClient();
  const { data, error } = await db
    .from("monitored_sites")
    .insert({
      tenant_id: opts.tenantId,
      url,
      label: opts.label.trim().slice(0, 80) || new URL(url).hostname,
      client_email: opts.clientEmail,
      alert_email: opts.alertEmail,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not add site" };
  return { ok: true, id: data.id as string };
}

export async function updateSite(
  tenantId: string,
  id: string,
  patch: Partial<
    Pick<SiteRow, "label" | "client_email" | "alert_email" | "checks" | "active">
  >
) {
  const db = createServiceClient();
  await db.from("monitored_sites").update(patch).eq("tenant_id", tenantId).eq("id", id);
}

export async function removeSite(tenantId: string, id: string) {
  const db = createServiceClient();
  await db.from("monitored_sites").delete().eq("tenant_id", tenantId).eq("id", id);
}

export async function recentChecks(
  siteId: string,
  kind?: CheckRow["kind"],
  limit = 200
): Promise<CheckRow[]> {
  const db = createServiceClient();
  let q = db
    .from("site_checks")
    .select("*")
    .eq("site_id", siteId)
    .order("checked_at", { ascending: false })
    .limit(limit);
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;
  return (data ?? []) as CheckRow[];
}

/** Uptime over a window plus incident count (down→up transitions). */
export async function uptimeSummary(
  siteId: string,
  days: number
): Promise<{
  pct: number | null;
  incidents: number;
  avgMs: number | null;
  checks: number;
}> {
  const db = createServiceClient();
  const since = new Date(Date.now() - days * 24 * HOURS).toISOString();
  const { data } = await db
    .from("site_checks")
    .select("ok, ms, checked_at")
    .eq("site_id", siteId)
    .eq("kind", "uptime")
    .gte("checked_at", since)
    .order("checked_at", { ascending: true })
    .limit(5000);
  const rows = (data ?? []) as { ok: boolean; ms: number | null }[];
  let incidents = 0;
  let prev = true;
  for (const r of rows) {
    if (!r.ok && prev) incidents++;
    prev = r.ok;
  }
  const okMs = rows.filter((r) => r.ok && r.ms !== null).map((r) => r.ms as number);
  return {
    pct: uptimePercent(rows.map((r) => r.ok)),
    incidents,
    avgMs: okMs.length ? Math.round(okMs.reduce((a, b) => a + b, 0) / okMs.length) : null,
    checks: rows.length,
  };
}

/* ───────────────────────────── the runner ───────────────────────────── */

async function log(
  siteRow: SiteRow,
  kind: CheckRow["kind"],
  ok: boolean,
  extra: {
    status_code?: number | null;
    ms?: number | null;
    details?: Record<string, unknown>;
  }
) {
  const db = createServiceClient();
  await db
    .from("site_checks")
    .insert({
      site_id: siteRow.id,
      tenant_id: siteRow.tenant_id,
      kind,
      ok,
      status_code: extra.status_code ?? null,
      ms: extra.ms ?? null,
      details: extra.details ?? {},
    });
}

/**
 * Run whatever is due for one site. Uptime every call; SSL daily; links and
 * speed weekly (or when `force` is set from the console).
 */
export async function runSite(s: SiteRow, force = false): Promise<void> {
  const db = createServiceClient();
  const patch: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
  const alertTo = s.alert_email;
  const dash = `${site()}/app/watch/${s.id}`;

  if (s.checks.uptime !== false) {
    const r = await checkUptime(s.url);
    await log(s, "uptime", r.ok, {
      status_code: r.status,
      ms: r.ms,
      details: r.error ? { error: r.error } : {},
    });
    if (r.ok) {
      if (s.status === "down" && alertTo) {
        const downFor = s.last_down_at
          ? Math.max(
              1,
              Math.round((Date.now() - new Date(s.last_down_at).getTime()) / 60_000)
            )
          : 30;
        const m = recoveredEmail({
          label: s.label,
          url: s.url,
          downForMinutes: downFor,
          dashboardUrl: dash,
        });
        void sendEmail({
          to: alertTo,
          subject: m.subject,
          html: m.html,
          text: m.text,
          purpose: "transactional",
        });
      }
      patch.status = "up";
      patch.consecutive_failures = 0;
    } else {
      const fails = s.consecutive_failures + 1;
      patch.consecutive_failures = fails;
      if (fails >= 2) {
        if (s.status !== "down") {
          patch.status = "down";
          patch.last_down_at = new Date().toISOString();
          if (alertTo && olderThan(s.last_alert_at, 1 * HOURS)) {
            const m = downEmail({
              label: s.label,
              url: s.url,
              status: r.status,
              error: r.error,
              dashboardUrl: dash,
            });
            void sendEmail({
              to: alertTo,
              subject: m.subject,
              html: m.html,
              text: m.text,
              purpose: "transactional",
            });
            patch.last_alert_at = new Date().toISOString();
          }
        }
      }
    }
  }

  if (
    s.checks.ssl !== false &&
    s.url.startsWith("https://") &&
    (force || olderThan(s.ssl_checked_at, 20 * HOURS))
  ) {
    const r = await checkSsl(s.url);
    await log(s, "ssl", r.ok, {
      details: { daysLeft: r.daysLeft, issuer: r.issuer, error: r.error },
    });
    patch.ssl_checked_at = new Date().toISOString();
    patch.ssl_expires_at = r.expiresAt;
    if (
      r.daysLeft !== null &&
      [30, 14, 7, 3, 1].some((d) => r.daysLeft! <= d) &&
      alertTo &&
      olderThan(s.ssl_alerted_at, 6 * 24 * HOURS)
    ) {
      const m = sslEmail({
        label: s.label,
        url: s.url,
        daysLeft: r.daysLeft,
        expiresAt: r.expiresAt!,
        dashboardUrl: dash,
      });
      void sendEmail({
        to: alertTo,
        subject: m.subject,
        html: m.html,
        text: m.text,
        purpose: "transactional",
      });
      patch.ssl_alerted_at = new Date().toISOString();
    }
  }

  if (
    s.checks.links !== false &&
    (force || olderThan(s.links_checked_at, 7 * 24 * HOURS))
  ) {
    const r = await checkLinks(s.url);
    await log(s, "links", r.ok, {
      details: { checked: r.checked, broken: r.broken.length, error: r.error },
    });
    patch.links_checked_at = new Date().toISOString();
    patch.broken_links = r.broken;
  }

  if (
    s.checks.speed !== false &&
    (force || olderThan(s.speed_checked_at, 7 * 24 * HOURS))
  ) {
    const r = await checkSpeed(s.url);
    await log(s, "speed", r.ok, {
      details: { mobile: r.mobile, desktop: r.desktop, error: r.error },
    });
    patch.speed_checked_at = new Date().toISOString();
    if (r.mobile !== null) patch.speed_mobile = r.mobile;
    if (r.desktop !== null) patch.speed_desktop = r.desktop;
  }

  await db.from("monitored_sites").update(patch).eq("id", s.id);
}

/** Cron entry: every active site whose owner is still entitled, 5 at a time. */
export async function runDueChecks(): Promise<{ sites: number; skipped: number }> {
  const db = createServiceClient();
  const { data } = await db
    .from("monitored_sites")
    .select("*")
    .eq("active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(400);
  const rows = (data ?? []) as SiteRow[];
  const entitled = new Map<string, boolean>();
  let skipped = 0;
  const due: SiteRow[] = [];
  for (const s of rows) {
    if (!entitled.has(s.tenant_id))
      entitled.set(s.tenant_id, (await entitlementFor(s.tenant_id, "watch")).entitled);
    if (entitled.get(s.tenant_id)) due.push(s);
    else skipped++;
  }
  const queue = [...due];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (queue.length) {
        const s = queue.shift()!;
        try {
          await runSite(s);
        } catch (e) {
          console.error("watch runSite failed", s.id, e);
        }
      }
    })
  );
  // Prune the log.
  await db
    .from("site_checks")
    .delete()
    .lt("checked_at", new Date(Date.now() - 90 * 24 * HOURS).toISOString());
  return { sites: due.length, skipped };
}

/** Build and send the monthly report for one site. */
export async function sendReport(
  s: SiteRow,
  opts: { to: string[]; senderName: string; days?: number }
): Promise<boolean> {
  const days = opts.days ?? 30;
  const sum = await uptimeSummary(s.id, days);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const m = monthlyReportEmail(
    {
      label: s.label,
      url: s.url,
      from: fmt(new Date(Date.now() - days * 24 * HOURS)),
      to: fmt(new Date()),
      uptimePct: sum.pct,
      incidents: sum.incidents,
      avgMs: sum.avgMs,
      speedMobile: s.speed_mobile,
      speedDesktop: s.speed_desktop,
      sslDaysLeft: s.ssl_expires_at
        ? Math.floor((new Date(s.ssl_expires_at).getTime() - Date.now()) / (24 * HOURS))
        : null,
      brokenLinks: s.broken_links ?? [],
      linksChecked: Number(
        (await recentChecks(s.id, "links", 1))[0]?.details?.checked ?? 0
      ),
      senderName: opts.senderName,
    },
    `${site()}/app/watch/${s.id}`
  );
  const ok = await sendEmail({
    to: opts.to,
    subject: m.subject,
    html: m.html,
    text: m.text,
    purpose: "service_relationship",
  });
  if (ok) {
    const db = createServiceClient();
    await db
      .from("monitored_sites")
      .update({ last_report_at: new Date().toISOString() })
      .eq("id", s.id);
  }
  return ok;
}

/** Cron entry on the 1st: every entitled site gets its report, to client + owner. */
export async function sendMonthlyReports(): Promise<number> {
  const db = createServiceClient();
  const { data } = await db
    .from("monitored_sites")
    .select("*, tenants(name, contact_email)")
    .eq("active", true)
    .limit(1000);
  let sent = 0;
  for (const row of (data ?? []) as (SiteRow & {
    tenants: { name: string; contact_email: string | null } | null;
  })[]) {
    if (!olderThan(row.last_report_at, 25 * 24 * HOURS)) continue;
    const ent = await entitlementFor(row.tenant_id, "watch");
    if (!ent.entitled) continue;
    const to = [row.client_email, row.alert_email ?? row.tenants?.contact_email].filter(
      (x): x is string => !!x
    );
    if (!to.length) continue;
    if (
      await sendReport(row, {
        to: [...new Set(to)],
        senderName: row.tenants?.name ?? "Your web team",
      })
    )
      sent++;
  }
  return sent;
}
