import tls from "node:tls";

/**
 * External checks for Nullshift Watch. Each is a small, independent function
 * with a hard timeout so one slow site cannot stall the cron. All run from
 * the outside, exactly as a visitor would hit the site.
 */

export const UA =
  "Mozilla/5.0 (compatible; NullshiftWatch/1.0; +https://nullshift.co.uk/products/watch)";

export function normaliseUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 10_000
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": UA, ...(init.headers ?? {}) },
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
}

export type UptimeResult = {
  ok: boolean;
  status: number | null;
  ms: number;
  error?: string;
};

export async function checkUptime(url: string): Promise<UptimeResult> {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(url, { method: "GET", cache: "no-store" }, 12_000);
    const ms = Date.now() - started;
    return { ok: res.status >= 200 && res.status < 400, status: res.status, ms };
  } catch (e) {
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error:
        e instanceof Error
          ? e.name === "AbortError"
            ? "Timed out after 12s"
            : e.message
          : "Request failed",
    };
  }
}

export type SslResult = {
  ok: boolean;
  expiresAt: string | null;
  daysLeft: number | null;
  issuer?: string;
  error?: string;
};

export function checkSsl(url: string): Promise<SslResult> {
  const host = new URL(url).hostname;
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: 8000, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to)
          return resolve({
            ok: false,
            expiresAt: null,
            daysLeft: null,
            error: "No certificate presented",
          });
        const exp = new Date(cert.valid_to);
        const daysLeft = Math.floor((exp.getTime() - Date.now()) / 86_400_000);
        const authorised = socket.authorized;
        resolve({
          ok: authorised && daysLeft > 0,
          expiresAt: exp.toISOString(),
          daysLeft,
          issuer:
            typeof cert.issuer === "object" && cert.issuer
              ? String(
                  (cert.issuer as Record<string, string>).O ??
                    (cert.issuer as Record<string, string>).CN ??
                    ""
                )
              : undefined,
          error: authorised
            ? undefined
            : socket.authorizationError
              ? String(socket.authorizationError)
              : undefined,
        });
      }
    );
    socket.on("error", (e) =>
      resolve({ ok: false, expiresAt: null, daysLeft: null, error: e.message })
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        ok: false,
        expiresAt: null,
        daysLeft: null,
        error: "TLS handshake timed out",
      });
    });
  });
}

export type BrokenLink = { href: string; status: number | null; error?: string };
export type LinksResult = {
  ok: boolean;
  checked: number;
  broken: BrokenLink[];
  error?: string;
};

/** Pull href targets from a page, absolutised, deduplicated, capped. */
export function extractLinks(html: string, baseUrl: string, cap = 60): string[] {
  const out = new Set<string>();
  const re = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.size < cap) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript|sms|data):/i.test(raw))
      continue;
    try {
      const u = new URL(raw, baseUrl);
      if (!/^https?:$/.test(u.protocol)) continue;
      u.hash = "";
      out.add(u.toString());
    } catch {
      /* skip malformed */
    }
  }
  return [...out];
}

export async function checkLinks(url: string): Promise<LinksResult> {
  let html: string;
  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" }, 12_000);
    if (!res.ok)
      return {
        ok: false,
        checked: 0,
        broken: [],
        error: `Homepage returned ${res.status}`,
      };
    html = (await res.text()).slice(0, 1_500_000);
  } catch (e) {
    return {
      ok: false,
      checked: 0,
      broken: [],
      error: e instanceof Error ? e.message : "Could not load homepage",
    };
  }
  const links = extractLinks(html, url);
  const broken: BrokenLink[] = [];
  const queue = [...links];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const href = queue.shift()!;
      try {
        let res = await fetchWithTimeout(
          href,
          { method: "HEAD", cache: "no-store" },
          8000
        );
        // Many hosts refuse HEAD; confirm with GET before calling it broken.
        if (
          res.status === 405 ||
          res.status === 403 ||
          res.status === 404 ||
          res.status >= 500
        )
          res = await fetchWithTimeout(href, { method: "GET", cache: "no-store" }, 8000);
        if (res.status >= 400) broken.push({ href, status: res.status });
      } catch (e) {
        broken.push({
          href,
          status: null,
          error:
            e instanceof Error
              ? e.name === "AbortError"
                ? "Timed out"
                : e.message
              : "Failed",
        });
      }
    }
  });
  await Promise.all(workers);
  return { ok: broken.length === 0, checked: links.length, broken };
}

export type SpeedResult = {
  ok: boolean;
  mobile: number | null;
  desktop: number | null;
  error?: string;
};

/** PageSpeed Insights v5. Works without a key at low volume; PAGESPEED_API_KEY raises the quota. */
export async function checkSpeed(url: string): Promise<SpeedResult> {
  const key = process.env.PAGESPEED_API_KEY;
  const one = async (strategy: "mobile" | "desktop"): Promise<number | null> => {
    const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    api.searchParams.set("url", url);
    api.searchParams.set("strategy", strategy);
    api.searchParams.set("category", "performance");
    if (key) api.searchParams.set("key", key);
    const res = await fetchWithTimeout(api.toString(), {}, 60_000);
    if (!res.ok) throw new Error(`PageSpeed ${res.status}`);
    const data = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } } };
    };
    const score = data.lighthouseResult?.categories?.performance?.score;
    return typeof score === "number" ? Math.round(score * 100) : null;
  };
  try {
    const [mobile, desktop] = await Promise.all([one("mobile"), one("desktop")]);
    return { ok: mobile !== null || desktop !== null, mobile, desktop };
  } catch (e) {
    return {
      ok: false,
      mobile: null,
      desktop: null,
      error: e instanceof Error ? e.message : "PageSpeed failed",
    };
  }
}

/** Uptime percentage from a list of uptime checks (ok flags). */
export function uptimePercent(flags: boolean[]): number | null {
  if (!flags.length) return null;
  const up = flags.filter(Boolean).length;
  return Math.round((up / flags.length) * 1000) / 10;
}
