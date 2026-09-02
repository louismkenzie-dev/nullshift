import type { IntegrationCategory, IntegrationHit, RepoEvidence } from "./types";

/**
 * Repository analysis — pure. Given a file listing and the package.json files
 * found in it, work out what the system is made of: how many dependencies it
 * carries, which external services it talks to, whether it has an admin area,
 * a role model, scheduled jobs, edge functions. No network here; the GitHub
 * collector fetches, this decides.
 */

export type RepoSnapshot = {
  fullName: string;
  defaultBranch: string | null;
  /** Every path in the tree (recursive). */
  paths: string[];
  treeTruncated?: boolean;
  packageJsons: { path: string; json: unknown }[];
  vercelJson?: unknown;
  meta?: { sizeKb?: number | null; language?: string | null; pushedAt?: string | null };
};

type CatalogueEntry = {
  match: RegExp;
  key: string;
  label: string;
  category: IntegrationCategory;
};

/** Package names → the external service they imply. Order matters only for the first match. */
export const INTEGRATION_CATALOGUE: CatalogueEntry[] = [
  { match: /^(stripe|@stripe\/)/, key: "stripe", label: "Stripe", category: "payments" },
  { match: /^gocardless/, key: "gocardless", label: "GoCardless", category: "payments" },
  { match: /^@paypal\//, key: "paypal", label: "PayPal", category: "payments" },
  {
    match: /^(braintree|square|sumup)/,
    key: "other-payments",
    label: "Payments",
    category: "payments",
  },
  { match: /^@supabase\//, key: "supabase", label: "Supabase", category: "database" },
  { match: /^(next-auth|@auth\/)/, key: "next-auth", label: "Auth.js", category: "auth" },
  { match: /^@clerk\//, key: "clerk", label: "Clerk", category: "auth" },
  {
    match: /^(firebase|firebase-admin)$/,
    key: "firebase",
    label: "Firebase",
    category: "auth",
  },
  { match: /^@auth0\//, key: "auth0", label: "Auth0", category: "auth" },
  {
    match: /^(prisma|@prisma\/|drizzle-orm|pg|mongoose|mongodb|mysql2)/,
    key: "orm",
    label: "Database driver",
    category: "database",
  },
  { match: /^resend$/, key: "resend", label: "Resend", category: "email" },
  {
    match:
      /^(nodemailer|@sendgrid\/|postmark|mailgun|mailgun-js|@aws-sdk\/client-ses|@mailchimp\/)/,
    key: "email",
    label: "Email delivery",
    category: "email",
  },
  { match: /^openai$/, key: "openai", label: "OpenAI", category: "ai" },
  { match: /^@anthropic-ai\//, key: "anthropic", label: "Anthropic", category: "ai" },
  {
    match: /^(@google\/generative-ai|@google\/genai)$/,
    key: "gemini",
    label: "Google Gemini",
    category: "ai",
  },
  {
    match: /^(ai|@ai-sdk\/|replicate|cohere-ai|langchain|@langchain\/)/,
    key: "ai-sdk",
    label: "AI SDK",
    category: "ai",
  },
  {
    match: /^(twilio|@vonage\/|vonage|messagebird)/,
    key: "sms",
    label: "SMS",
    category: "sms",
  },
  {
    match: /^(mapbox-gl|react-map-gl)$/,
    key: "mapbox",
    label: "Mapbox",
    category: "maps",
  },
  {
    match: /^(leaflet|react-leaflet)$/,
    key: "leaflet",
    label: "Leaflet maps",
    category: "maps",
  },
  {
    match: /^(@react-google-maps\/|@googlemaps\/)/,
    key: "google-maps",
    label: "Google Maps",
    category: "maps",
  },
  {
    match: /^(posthog-js|posthog-node)$/,
    key: "posthog",
    label: "PostHog",
    category: "analytics",
  },
  {
    match: /^@vercel\/analytics$/,
    key: "vercel-analytics",
    label: "Vercel Analytics",
    category: "analytics",
  },
  {
    match: /^(plausible-tracker|next-plausible)$/,
    key: "plausible",
    label: "Plausible",
    category: "analytics",
  },
  {
    match: /^(mixpanel|mixpanel-browser|@segment\/|react-ga|react-ga4)/,
    key: "analytics",
    label: "Analytics",
    category: "analytics",
  },
  { match: /^@sentry\//, key: "sentry", label: "Sentry", category: "monitoring" },
  {
    match: /^(logrocket|@datadog\/|dd-trace)/,
    key: "monitoring",
    label: "Monitoring",
    category: "monitoring",
  },
  {
    match: /^(@aws-sdk\/client-s3|cloudinary|uploadthing|@uploadthing\/)/,
    key: "storage",
    label: "File storage",
    category: "storage",
  },
  {
    match: /^(googleapis|@googleapis\/calendar)$/,
    key: "google-api",
    label: "Google APIs",
    category: "calendar",
  },
  {
    match: /^(xero-node|node-quickbooks)$/,
    key: "accounting",
    label: "Accounting",
    category: "accounting",
  },
  {
    match: /^(contentful|@sanity\/|@prismicio\/|@storyblok\/)/,
    key: "cms",
    label: "Headless CMS",
    category: "cms",
  },
  {
    match: /^(algoliasearch|@algolia\/|meilisearch|typesense)/,
    key: "search",
    label: "Search",
    category: "search",
  },
];

/** Edge function / file names that give away an integration without a package. */
const NAME_HINTS: {
  match: RegExp;
  key: string;
  label: string;
  category: IntegrationCategory;
}[] = [
  {
    match: /stripe|checkout|payment|refund|payout/i,
    key: "stripe",
    label: "Stripe",
    category: "payments",
  },
  {
    match: /gocardless|mandate|direct-?debit/i,
    key: "gocardless",
    label: "GoCardless",
    category: "payments",
  },
  { match: /resend/i, key: "resend", label: "Resend", category: "email" },
  {
    match: /send-?email|mailer|sendgrid|postmark/i,
    key: "email",
    label: "Email delivery",
    category: "email",
  },
  { match: /openai|gpt/i, key: "openai", label: "OpenAI", category: "ai" },
  { match: /anthropic|claude/i, key: "anthropic", label: "Anthropic", category: "ai" },
  { match: /twilio|sms/i, key: "sms", label: "SMS", category: "sms" },
  { match: /mapbox/i, key: "mapbox", label: "Mapbox", category: "maps" },
  {
    match: /google-?reviews|places-?api/i,
    key: "google-api",
    label: "Google APIs",
    category: "calendar",
  },
];

const SCHEDULE_RE =
  /(daily|weekly|nightly|hourly|cron|reminder|maintenance|scheduled|digest)/i;
const ADMIN_SEGMENT_RE =
  /^(admin|dashboard|backoffice|back-office|staff|manage|management|internal|ops)$/i;
const AUTH_PATH_RE =
  /(^|\/)(auth|login|signin|sign-in|signup|sign-up|register|reset-?password)[^/]*\.(tsx?|jsx?|vue|svelte)$/i;
const ROLE_PATH_RE = /(role|permission|rbac|guard|policies|policy)/i;

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function detectFramework(deps: Set<string>): string | null {
  if (deps.has("next")) return "Next.js";
  if (deps.has("@remix-run/react") || deps.has("@remix-run/node")) return "Remix";
  if (deps.has("nuxt")) return "Nuxt";
  if (deps.has("@sveltejs/kit")) return "SvelteKit";
  if (deps.has("astro")) return "Astro";
  if (deps.has("react-router-dom") || deps.has("react-router")) return "React (SPA)";
  if (deps.has("react")) return "React";
  if (deps.has("vue")) return "Vue";
  if (deps.has("express") || deps.has("fastify") || deps.has("hono"))
    return "Node service";
  return null;
}

function addHit(
  map: Map<string, IntegrationHit>,
  e: { key: string; label: string; category: IntegrationCategory },
  via: string
) {
  const existing = map.get(e.key);
  if (existing) {
    if (!existing.via.includes(via)) existing.via.push(via);
    return;
  }
  map.set(e.key, { key: e.key, label: e.label, category: e.category, via: [via] });
}

/** Route files: Next app/pages routers, and a plain `pages/` directory in a SPA. */
function isRouteFile(path: string): boolean {
  if (/(^|\/)node_modules\//.test(path)) return false;
  if (/(^|\/)app\/.*\/?page\.(tsx|jsx|ts|js|mdx)$/.test(path)) return true;
  if (/(^|\/)pages\/.*\.(tsx|jsx|vue|svelte)$/.test(path)) {
    const base = path.split("/").pop() ?? "";
    if (/^_(app|document|error)\./.test(base)) return false;
    if (/(^|\/)pages\/api\//.test(path)) return false;
    return true;
  }
  if (/(^|\/)routes\/.*\.(tsx|jsx)$/.test(path)) return true;
  return false;
}

function isAdminPath(path: string): boolean {
  return path.split("/").some((seg) => ADMIN_SEGMENT_RE.test(seg));
}

export function analyseRepo(snap: RepoSnapshot): RepoEvidence {
  const paths = snap.paths.filter((p) => !/(^|\/)node_modules\//.test(p));
  const deps = new Set<string>();
  const devDeps = new Set<string>();
  const packageJsonPaths: string[] = [];

  for (const pj of snap.packageJsons) {
    if (/(^|\/)node_modules\//.test(pj.path)) continue;
    const json = asRecord(pj.json);
    packageJsonPaths.push(pj.path);
    for (const name of Object.keys(asRecord(json.dependencies))) deps.add(name);
    for (const name of Object.keys(asRecord(json.devDependencies))) devDeps.add(name);
  }
  // Workspace-internal packages are not third-party load.
  for (const name of Array.from(deps)) {
    const spec = snap.packageJsons
      .map((pj) => asRecord(asRecord(pj.json).dependencies)[name])
      .find((v) => typeof v === "string") as string | undefined;
    if (spec && /^(workspace:|file:|link:)/.test(spec)) deps.delete(name);
  }

  const hits = new Map<string, IntegrationHit>();
  for (const name of deps) {
    const entry = INTEGRATION_CATALOGUE.find((c) => c.match.test(name));
    if (entry) addHit(hits, entry, `pkg:${name}`);
  }

  // Supabase edge functions + notable source files carry names that say what
  // they integrate with even when the SDK is loaded via URL imports (Deno).
  const edgeFunctions = new Set<string>();
  for (const p of paths) {
    const m = p.match(/(^|\/)supabase\/functions\/([^/]+)\//);
    if (m) {
      const name = m[2];
      if (name === "_shared") continue;
      edgeFunctions.add(name);
      for (const hint of NAME_HINTS)
        if (hint.match.test(name)) addHit(hits, hint, `fn:${name}`);
    }
    const base = p.split("/").pop() ?? "";
    if (
      /^(src|lib|app|server|api|packages)\//.test(p) &&
      /\.(ts|tsx|js|jsx|mjs)$/.test(base)
    ) {
      for (const hint of NAME_HINTS)
        if (hint.match.test(base.replace(/\.(ts|tsx|js|jsx|mjs)$/, "")))
          addHit(hits, hint, `path:${p}`);
    }
  }

  const routeFiles = paths.filter(isRouteFile);
  const adminRoutes = routeFiles.filter(isAdminPath);
  const hasAdminDir = paths.some((p) =>
    p
      .split("/")
      .slice(0, -1)
      .some((s) => ADMIN_SEGMENT_RE.test(s))
  );

  const hasAuth =
    hits.has("supabase") ||
    Array.from(hits.values()).some((h) => h.category === "auth") ||
    paths.some((p) => AUTH_PATH_RE.test(p));
  const hasRoleModel =
    deps.has("@casl/ability") ||
    paths.some(
      (p) => ROLE_PATH_RE.test(p.split("/").pop() ?? "") && !/node_modules/.test(p)
    );

  const migrationCount = paths.filter((p) =>
    /(^|\/)(supabase\/migrations|prisma\/migrations|drizzle|migrations)\/[^/]+\.(sql|ts|js)$/.test(
      p
    )
  ).length;

  const vercel = asRecord(snap.vercelJson);
  const crons = Array.isArray(vercel.crons) ? vercel.crons.length : 0;
  const scheduledFunctions = Array.from(edgeFunctions).filter((n) =>
    SCHEDULE_RE.test(n)
  ).length;
  const scheduledWorkflows = paths.filter(
    (p) =>
      /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(p) &&
      SCHEDULE_RE.test(p.split("/").pop() ?? "")
  ).length;
  const scheduledJobs = crons + scheduledFunctions + scheduledWorkflows;
  if (scheduledJobs > 0)
    addHit(
      hits,
      { key: "scheduled-jobs", label: "Scheduled jobs", category: "automation" },
      `count:${scheduledJobs}`
    );

  // A generic hint ("send-email" → email) is the same service as a specific
  // one already found (resend) — keep the specific, drop the generic.
  const GENERIC = new Set([
    "email",
    "other-payments",
    "analytics",
    "monitoring",
    "ai-sdk",
    "storage",
  ]);
  for (const [key, hit] of Array.from(hits)) {
    if (!GENERIC.has(key)) continue;
    const specific = Array.from(hits.values()).some(
      (h) => h.key !== key && h.category === hit.category
    );
    if (specific) hits.delete(key);
  }

  const hasTests =
    paths.some((p) => /\.(test|spec)\.(tsx?|jsx?|mjs)$/.test(p)) ||
    paths.some((p) => /(^|\/)(tests?|__tests__|e2e)\//.test(p));
  const hasCi = paths.some((p) => /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(p));

  return {
    fullName: snap.fullName,
    defaultBranch: snap.defaultBranch,
    framework: detectFramework(deps),
    language: snap.meta?.language ?? null,
    sizeKb: snap.meta?.sizeKb ?? null,
    pushedAt: snap.meta?.pushedAt ?? null,
    dependencyCount: deps.size,
    devDependencyCount: devDeps.size,
    dependencies: Array.from(deps).sort(),
    packageJsonPaths,
    integrations: Array.from(hits.values()),
    hasAuth,
    hasRoleModel:
      hasRoleModel ||
      (hasAdminDir && adminRoutes.length > 0 && paths.some((p) => /role/i.test(p))),
    routeCount: routeFiles.length,
    adminRouteCount: adminRoutes.length,
    edgeFunctionCount: edgeFunctions.size,
    migrationCount,
    scheduledJobs,
    hasTests,
    hasCi,
    treeTruncated: !!snap.treeTruncated,
  };
}

/** "https://github.com/owner/repo.git" / "owner/repo/" → "owner/repo". */
export function normaliseRepoName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^git@github\.com:/i, "");
  s = s.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
  s = s.replace(/\.git$/i, "").replace(/\/+$/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
  return `${owner}/${repo}`;
}
