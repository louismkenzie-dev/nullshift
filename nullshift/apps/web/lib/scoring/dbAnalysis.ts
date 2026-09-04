import type { DatabaseEvidence, DbTable } from "./types";

/**
 * Database analysis — pure. One scan query reads the shape of a client's
 * production database (users, activity, tables and their columns); a second,
 * built from what the first found, counts the things that matter to the Scale
 * Index — staff, locations — against the tables that actually exist. The
 * Supabase collector runs the SQL; everything here just writes and reads it.
 *
 * Identifier safety: every table/column name interpolated into the follow-up
 * SQL must pass IDENT_RE. Names come from the client's own schema, which a
 * client developer controls, so nothing is trusted just because it is there.
 */

export const IDENT_RE = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * Count a table that may not exist on this project (pg_cron is opt-in;
 * storage is not installed on every project).
 *
 * `to_regclass(...) is null` alone is NOT enough: Postgres parses and plans
 * the whole statement before running it, so a bare `select count(*) from
 * cron.job` in the untaken CASE branch still raises 42P01 and fails the
 * entire scan. Passing the inner query to query_to_xml as TEXT defers its
 * parse to execution time, which CASE then never reaches.
 */
const optionalCount = (rel: string) =>
  `(select case when to_regclass('${rel}') is null then 0 else ` +
  `(xpath('/row/c/text()', query_to_xml('select count(*) as c from ${rel}', false, true, '')))[1]::text::int end)`;

/** Everything the first round-trip needs, as one JSON row. */
export const SCAN_SQL = `
select json_build_object(
  'users_total', (select count(*) from auth.users),
  'mau_30', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
  'new_30', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
  'public_tables', (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'),
  'db_size_mb', (select round(pg_database_size(current_database()) / 1048576.0)),
  'cron_jobs', ${optionalCount("cron.job")},
  'storage_buckets', ${optionalCount("storage.buckets")},
  'extensions', (select coalesce(json_agg(extname order by extname), '[]'::json) from pg_extension),
  'tables', (
    select coalesce(json_agg(json_build_object(
      'name', t.table_name,
      'rows', s.n_live_tup,
      'columns', (
        select coalesce(json_agg(c.column_name order by c.ordinal_position), '[]'::json)
        from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.table_name
      )
    ) order by t.table_name), '[]'::json)
    from information_schema.tables t
    left join pg_stat_user_tables s on s.relname = t.table_name and s.schemaname = 'public'
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
  )
) as scan;
`.trim();

export type DbScan = {
  users_total: number;
  mau_30: number;
  new_30: number;
  public_tables: number;
  db_size_mb: number | null;
  cron_jobs: number;
  storage_buckets: number;
  extensions: string[];
  tables: DbTable[];
};

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** The management API returns rows as an array; the scan is one row with one column. */
export function parseScan(rows: unknown): DbScan | null {
  const first = Array.isArray(rows) ? rows[0] : rows;
  const raw =
    first && typeof first === "object" && "scan" in (first as Record<string, unknown>)
      ? (first as Record<string, unknown>).scan
      : first;
  const obj = typeof raw === "string" ? safeJson(raw) : raw;
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const tables: DbTable[] = Array.isArray(o.tables)
    ? (o.tables as unknown[]).flatMap((t) => {
        const r = (t ?? {}) as Record<string, unknown>;
        const name = typeof r.name === "string" ? r.name : null;
        if (!name) return [];
        return [
          {
            name,
            rows: numOrNull(r.rows),
            columns: Array.isArray(r.columns)
              ? (r.columns as unknown[]).filter((c): c is string => typeof c === "string")
              : [],
          },
        ];
      })
    : [];
  return {
    users_total: num(o.users_total),
    mau_30: num(o.mau_30),
    new_30: num(o.new_30),
    public_tables: num(o.public_tables),
    db_size_mb: numOrNull(o.db_size_mb),
    cron_jobs: num(o.cron_jobs),
    storage_buckets: num(o.storage_buckets),
    extensions: Array.isArray(o.extensions)
      ? (o.extensions as unknown[]).filter((e): e is string => typeof e === "string")
      : [],
    tables,
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* ── Table classification ─────────────────────────────────────── */

const CUSTOMER_ROLES = [
  "user",
  "customer",
  "parent",
  "client",
  "member",
  "student",
  "subscriber",
  "guest",
  "guardian",
  "patient",
  "attendee",
  "buyer",
];
const STAFF_TABLES = [
  "staff",
  "employees",
  "team_members",
  "team",
  "instructors",
  "coaches",
  "admins",
  "practitioners",
  "therapists",
  "agents",
];
const LOCATION_TABLES = [
  "venues",
  "locations",
  "sites",
  "branches",
  "studios",
  "stores",
  "clinics",
  "offices",
  "centres",
  "centers",
  "schools",
  "campuses",
  "hubs",
  "premises",
];
const PAYMENT_TABLE_RE =
  /(payment|invoice|subscription|checkout|transaction|order|cart|coupon|refund|passes|membership|billing|payout)/i;
const PAYMENT_COLUMN_RE =
  /^(stripe_|gocardless_|gc_|paypal_|payment_intent|hosted_invoice|amount_paid|paid_at)/i;
const OPERATIONAL_TABLE_RE =
  /(booking|appointment|reservation|class|session|schedule|attendance|ticket|order|job|task|case|shift|rota|timesheet|enrol|register|waitlist|delivery|dispatch)/i;
const LEAD_TABLE_RE = /(enquir|inquir|lead|contact|submission|message|quote_request)/i;
const PII_COLUMN_RE =
  /(^|_)(email|phone|mobile|tel|address|postcode|zip|date_of_birth|dob|birth|nok_|next_of_kin|emergency_contact|national_insurance|passport)/i;
const SPECIAL_COLUMN_RE =
  /(medical|allerg|health|disab|send_|ehcp|religion|ethnic|dbs_|criminal|sexual|gender|inhaler|epipen|nappies|toilet)/i;

const hasCol = (t: DbTable, c: string) => t.columns.includes(c);
const findTable = (scan: DbScan, names: string[]) =>
  scan.tables.find((t) => names.includes(t.name)) ?? null;

/**
 * Targeted counts the scan can't give generically. Returns null when there is
 * nothing worth a second trip. Every identifier is validated first.
 */
export function buildFollowUpSql(scan: DbScan): { sql: string; keys: string[] } | null {
  const parts: string[] = [];
  const keys: string[] = [];
  const customerList = CUSTOMER_ROLES.map((r) => `'${r}'`).join(", ");
  const ident = (s: string) => IDENT_RE.test(s);

  // Roles: a user_roles table, or a role column on profiles/users.
  const userRoles = scan.tables.find(
    (t) => t.name === "user_roles" && hasCol(t, "user_id") && hasCol(t, "role")
  );
  const profileRole = scan.tables.find(
    (t) => ["profiles", "users", "accounts"].includes(t.name) && hasCol(t, "role")
  );
  if (userRoles && ident(userRoles.name)) {
    parts.push(
      `'staff_total', (select count(distinct r.user_id) from public.user_roles r where lower(r.role::text) not in (${customerList}))`,
      `'staff_active_30', (select count(distinct r.user_id) from public.user_roles r join auth.users u on u.id = r.user_id where lower(r.role::text) not in (${customerList}) and u.last_sign_in_at >= now() - interval '30 days')`
    );
    keys.push("staff_total", "staff_active_30");
  } else if (profileRole && ident(profileRole.name)) {
    const idCol = hasCol(profileRole, "user_id") ? "user_id" : "id";
    parts.push(
      `'staff_total', (select count(distinct p.${idCol}) from public.${profileRole.name} p where lower(p.role::text) not in (${customerList}))`,
      `'staff_active_30', (select count(distinct p.${idCol}) from public.${profileRole.name} p join auth.users u on u.id = p.${idCol} where lower(p.role::text) not in (${customerList}) and u.last_sign_in_at >= now() - interval '30 days')`
    );
    keys.push("staff_total", "staff_active_30");
  }

  const staffTable = findTable(scan, STAFF_TABLES);
  if (staffTable && ident(staffTable.name)) {
    const where = hasCol(staffTable, "is_active") ? " where is_active = true" : "";
    parts.push(
      `'staff_table_count', (select count(*) from public.${staffTable.name}${where})`
    );
    keys.push("staff_table_count");
  }

  const locTable = findTable(scan, LOCATION_TABLES);
  if (locTable && ident(locTable.name)) {
    const where = hasCol(locTable, "is_active") ? " where is_active = true" : "";
    parts.push(
      `'locations_count', (select count(*) from public.${locTable.name}${where})`
    );
    keys.push("locations_count");
  }

  if (parts.length === 0) return null;
  return { sql: `select json_build_object(${parts.join(", ")}) as extra;`, keys };
}

export function parseFollowUp(rows: unknown): Record<string, number | null> {
  const first = Array.isArray(rows) ? rows[0] : rows;
  const raw =
    first && typeof first === "object" && "extra" in (first as Record<string, unknown>)
      ? (first as Record<string, unknown>).extra
      : first;
  const obj = typeof raw === "string" ? safeJson(raw) : raw;
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>))
    out[k] = numOrNull(v);
  return out;
}

export function analyseDatabase(
  ref: string,
  scan: DbScan,
  extra: Record<string, number | null> = {}
): DatabaseEvidence {
  const userRoles = scan.tables.find(
    (t) => t.name === "user_roles" && hasCol(t, "user_id") && hasCol(t, "role")
  );
  const profileRole = scan.tables.find(
    (t) => ["profiles", "users", "accounts"].includes(t.name) && hasCol(t, "role")
  );
  const staffTable = findTable(scan, STAFF_TABLES);
  const locTable = findTable(scan, LOCATION_TABLES);

  const roleSource = userRoles
    ? "user_roles.role"
    : profileRole
      ? `${profileRole.name}.role`
      : staffTable
        ? staffTable.name
        : null;
  const staffTotal =
    extra.staff_total ?? extra.staff_table_count ?? (staffTable ? staffTable.rows : null);
  const staffActive30 = extra.staff_active_30 ?? null;

  let piiColumns = 0;
  let specialCategoryColumns = 0;
  let statusTables = 0;
  const paymentTables: DbTable[] = [];
  const operationalTables: DbTable[] = [];
  const leadTables: DbTable[] = [];
  for (const t of scan.tables) {
    for (const c of t.columns) {
      if (PII_COLUMN_RE.test(c)) piiColumns++;
      if (SPECIAL_COLUMN_RE.test(c)) specialCategoryColumns++;
    }
    if (hasCol(t, "status")) statusTables++;
    if (PAYMENT_TABLE_RE.test(t.name) || t.columns.some((c) => PAYMENT_COLUMN_RE.test(c)))
      paymentTables.push(t);
    else if (OPERATIONAL_TABLE_RE.test(t.name)) operationalTables.push(t);
    else if (LEAD_TABLE_RE.test(t.name)) leadTables.push(t);
  }
  const slim = (t: DbTable) => ({ name: t.name, rows: t.rows });

  return {
    ref,
    usersTotal: scan.users_total,
    mau30: scan.mau_30,
    newUsers30: scan.new_30,
    publicTables: scan.public_tables,
    dbSizeMb: scan.db_size_mb,
    cronJobs: scan.cron_jobs,
    storageBuckets: scan.storage_buckets,
    extensions: scan.extensions,
    roleModel: { source: roleSource, staffTotal, staffActive30 },
    locations:
      locTable && extra.locations_count !== undefined && extra.locations_count !== null
        ? { table: locTable.name, count: extra.locations_count }
        : locTable
          ? { table: locTable.name, count: locTable.rows ?? 0 }
          : null,
    piiColumns,
    specialCategoryColumns,
    paymentTables: paymentTables.map(slim),
    operationalTables: operationalTables.map(slim),
    leadTables: leadTables.map(slim),
    statusTables,
  };
}
