#!/usr/bin/env node
/**
 * Migration dry-run for the admin redesign series (brief §14.2: "Migration
 * dry-runs have zero provider writes").
 *
 * Reads the SQL TEXT of supabase/migrations/0057–0065 (or the range given with
 * --range), parses it without a database and reports:
 *
 *   - objects created and existing tables altered (tables, columns, indexes,
 *     functions, triggers, policies, views, enum types);
 *   - forbidden statements: DROP TABLE / DROP TYPE / DROP SCHEMA / DROP COLUMN,
 *     DELETE, TRUNCATE, top-level INSERT, and UPDATE anywhere except inside the
 *     documented 0062 backfill DO block; any http / provider / extension call
 *     (pg_net, http_*, dblink, cron.schedule, supabase_functions, create
 *     extension);
 *   - header hygiene (NOT APPLIED, purpose, dependencies, rollback), RLS
 *     enabled on every new table, timestamptz only, integer minor units with a
 *     currency column, SECURITY DEFINER functions listed for review;
 *   - number uniqueness and gaps in the migrations directory, and file-name
 *     collisions against the production ledger names recorded in
 *     docs/ADMIN-REDESIGN-PHASE0-2026-09-17.md §11 (the ledger is name-based);
 *   - the apply order with dependencies (declared in each header and detected
 *     from FOREIGN KEY references to tables created by sibling files).
 *
 * This script opens no network connection and no database connection. It
 * never executes SQL. Exit code 1 when any ERROR is reported.
 *
 * Run: pnpm -C apps/web migrations:dry-run            (default range 0057-0065)
 *      pnpm -C apps/web migrations:dry-run -- --range 0057-0065 --json
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const json = args.includes("--json");
const rangeArg = (() => {
  const i = args.indexOf("--range");
  return i >= 0 ? args[i + 1] : "0057-0065";
})();
const [RANGE_FROM, RANGE_TO] = rangeArg.split("-").map((s) => Number.parseInt(s, 10));
if (!Number.isInteger(RANGE_FROM) || !Number.isInteger(RANGE_TO) || RANGE_FROM > RANGE_TO) {
  console.error(`Bad --range "${rangeArg}"; expected e.g. 0057-0065`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Known ledger names (name-based ledger, Phase 0 §11). Applied on production
// with NO file on main, plus the renamed 0040–0043 files, plus PR #20's
// 0056_client_economics.sql which IS applied. Every file below the range in
// the migrations directory is assumed applied under its own name.
// ---------------------------------------------------------------------------

const LEDGER_NAMES_WITHOUT_FILE = [
  "proposal_dpa",
  "rls_isolation_test_fn",
  "unify_clients",
  "unify_clients_drop_permissive_calls_policy",
  "proposed_care_plan",
  "proposal_document",
  "portal_project_hub",
  "portal_project_hub_client_id_nullable",
  "client_entity_type",
  "dpa_client_company_name_and_submitted_at",
  "agent_consultation",
  "agent_research",
  "ai_workspace_phase1",
  "work_classification_on_issues",
  "function_hardening_revoke_public",
  "soc2_ref_allocator_hardening",
  "business_records_vault_functions",
  "client_economics",
  // 0040–0043 were applied under these names before the files were renumbered.
  "delivery_layer",
  "compliance_reviews",
  "sar_completeness",
  "project_updates_bucket_hardening",
];

// Numbers known to be missing from this branch and why (Phase 0 §11, N-h).
const KNOWN_GAPS = {
  56: "0056_client_economics.sql exists only on PR #20 and IS applied in production as `client_economics`",
  61: "0061 was never assigned on this branch",
};

// ---------------------------------------------------------------------------
// SQL tokeniser: statements split on ';' outside strings, comments and
// dollar-quoted bodies. Bodies are lifted out so they can be scanned
// separately (a DO block runs at apply time; a function body runs later).
// ---------------------------------------------------------------------------

function tokenise(sql) {
  const statements = [];
  let i = 0;
  let line = 1;
  let cur = "";
  let bodies = [];
  let stmtLine = null;
  const n = sql.length;

  const push = () => {
    if (cur.trim()) statements.push({ line: stmtLine ?? line, text: cur.trim(), bodies });
    cur = "";
    bodies = [];
    stmtLine = null;
  };

  while (i < n) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === "-" && d === "-") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) {
        if (sql[i] === "\n") line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (c === "'") {
      let s = "'";
      i++;
      while (i < n) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            s += "''";
            i += 2;
            continue;
          }
          break;
        }
        if (sql[i] === "\n") line++;
        s += sql[i];
        i++;
      }
      s += "'";
      i++;
      if (stmtLine === null) stmtLine = line;
      cur += s;
      continue;
    }
    if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64));
      if (m) {
        const tag = m[0];
        const start = i + tag.length;
        const end = sql.indexOf(tag, start);
        if (end < 0) throw new Error(`unterminated dollar quote ${tag} at line ${line}`);
        const body = sql.slice(start, end);
        const bodyLine = line;
        line += (body.match(/\n/g) ?? []).length;
        i = end + tag.length;
        if (stmtLine === null) stmtLine = bodyLine;
        cur += ` ${tag}BODY${bodies.length}${tag} `;
        bodies.push({ text: body, line: bodyLine });
        continue;
      }
    }
    if (c === ";") {
      push();
      i++;
      continue;
    }
    if (c === "\n") line++;
    if (stmtLine === null && !/\s/.test(c)) stmtLine = line;
    cur += c;
    i++;
  }
  push();
  return statements;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();
const bare = (name) => name.replace(/"/g, "").replace(/^public\./, "");

/** Split a CREATE TABLE body on top-level commas and return {name, type, rest} per column. */
function columnDefs(body) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts
    .map((p) => norm(p))
    .filter((p) => p && !/^(constraint|unique|primary\s+key|foreign\s+key|check|exclude)\b/i.test(p))
    .map((p) => {
      const m = /^([\w"]+)\s+([\w]+(?:\s*\([^)]*\))?(?:\s+with(?:out)?\s+time\s+zone)?)(.*)$/is.exec(p);
      return m ? { name: bare(m[1]), type: m[2].toLowerCase(), rest: m[3] ?? "" } : { name: p, type: "?", rest: "" };
    });
}

/** Dependency numbers declared in the header's DEPENDENCIES section only. */
function declaredDependencies(header, own) {
  const lines = header.split("\n");
  const start = lines.findIndex((l) => /^--\s*depend/i.test(l));
  if (start < 0) return [];
  const section = [];
  for (let i = start; i < lines.length; i++) {
    if (i > start && /^--\s*(ACCESS|Access|ROLLBACK|Rollback|NO BACKFILL|WHAT THIS|EQUIVALENT|BACKFILL|PURPOSE|Purpose|DESIGN NOTES|STATUS|Money)\b/.test(lines[i])) break;
    section.push(lines[i]);
  }
  // Negated or descriptive mentions are not dependencies: "No dependency on
  // 0056", "this file does not reference it", "same convention as 0060".
  const text = section
    .join(" ")
    .replace(/no\s+dependency\s+on[^.]*\./gi, " ")
    .replace(/[^.]*does\s+not\s+reference[^.]*\./gi, " ")
    .replace(/[^.]*same\s+convention[^.]*\./gi, " ");
  return [...new Set((text.match(/\b0\d{3}\b/g) ?? []).map(Number))].filter((n) => n !== own);
}

function stripBodyComments(body) {
  return body
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

const HTTP_PATTERNS = [
  /\bnet\.http_\w+/i,
  /\bhttp_(get|post|put|delete|request)\b/i,
  /\bpg_net\b/i,
  /\bdblink\b/i,
  /\bcron\.schedule\b/i,
  /\bsupabase_functions\b/i,
  /\bcreate\s+extension\b/i,
  /\bcurl\b/i,
  /https?:\/\/[^\s'"]+/i,
];

// ---------------------------------------------------------------------------
// Per-file analysis
// ---------------------------------------------------------------------------

function analyseFile(file) {
  const raw = readFileSync(file.path, "utf8");
  const findings = [];
  const add = (level, line, message) => findings.push({ level, line, message });

  // Header: the leading run of `--` comment lines.
  const headerLines = [];
  for (const l of raw.split("\n")) {
    if (l.startsWith("--")) headerLines.push(l);
    else if (l.trim() === "" && headerLines.length) continue;
    else break;
  }
  const header = headerLines.join("\n");
  const headerChecks = {
    notApplied: /not applied/i.test(header),
    purpose: /purpose/i.test(header),
    dependencies: /depend/i.test(header),
    rollback: /rollback/i.test(header),
  };
  for (const [k, ok] of Object.entries(headerChecks)) {
    if (!ok) add("ERROR", 1, `header is missing the "${k}" section`);
  }
  const declaredDeps = declaredDependencies(header, file.number);

  let statements;
  try {
    statements = tokenise(raw);
  } catch (e) {
    add("ERROR", 1, `could not tokenise: ${e.message}`);
    return { file, findings, objects: {}, deps: { declared: declaredDeps, detected: [] } };
  }

  const objects = {
    tables: [],
    alteredTables: {},
    columnsAdded: [],
    indexes: [],
    functions: [],
    securityDefiner: [],
    triggers: [],
    policies: [],
    views: [],
    types: [],
    rlsEnabled: [],
    dropped: [],
    comments: 0,
    grants: 0,
    mutations: [],
  };
  const tableDefs = {};
  const referencedTables = new Set();
  let transaction = { begin: false, commit: false };

  const scanBody = (body, ctx, stmtLine) => {
    const text = stripBodyComments(body.text);
    const at = body.line;
    for (const m of text.matchAll(/\bcreate\s+type\s+([\w."]+)/gi)) {
      objects.types.push(bare(m[1]));
    }
    for (const m of text.matchAll(/\breferences\s+([\w."]+)\s*\(/gi)) referencedTables.add(bare(m[1]));
    for (const p of HTTP_PATTERNS) {
      if (p.test(text)) add("ERROR", at, `${ctx}: http / provider / extension call matched ${p}`);
    }
    if (/\bdrop\s+(table|schema|type)\b/i.test(text)) add("ERROR", at, `${ctx}: DROP TABLE/SCHEMA/TYPE inside body`);
    if (/\btruncate\b/i.test(text)) add("ERROR", at, `${ctx}: TRUNCATE inside body`);
    const updates = [...text.matchAll(/\bupdate\s+([\w."]+)(?:\s+\w+)?\s+set\b/gi)].map((m) => bare(m[1]));
    const inserts = [...text.matchAll(/\binsert\s+into\s+([\w."]+)/gi)].map((m) => bare(m[1]));
    const deletes = [...text.matchAll(/\bdelete\s+from\s+([\w."]+)/gi)].map((m) => bare(m[1]));
    if (ctx === "DO block") {
      const documentedBackfill = file.number === 62 && /backfill/i.test(text);
      for (const t of updates) {
        objects.mutations.push({ kind: "UPDATE", table: t, where: ctx, line: at, documented: documentedBackfill });
        if (documentedBackfill) add("INFO", at, `documented 0062 backfill: UPDATE ${t} (identity link only; see header BACKFILL)`);
        else add("ERROR", at, `UPDATE ${t} executed at apply time outside the documented 0062 backfill`);
      }
      for (const t of inserts) {
        objects.mutations.push({ kind: "INSERT", table: t, where: ctx, line: at, documented: documentedBackfill });
        if (documentedBackfill) add("INFO", at, `documented 0062 backfill: INSERT ${t} (one obligation per live legacy build invoice)`);
        else add("ERROR", at, `INSERT ${t} executed at apply time (seed data is not allowed in this series)`);
      }
      for (const t of deletes) {
        objects.mutations.push({ kind: "DELETE", table: t, where: ctx, line: at, documented: false });
        add("ERROR", at, `DELETE FROM ${t} executed at apply time`);
      }
      if (documentedBackfill) {
        if (!/raise\s+exception/i.test(text)) add("WARN", at, "0062 backfill has no abort pre-check");
        if (!/get\s+diagnostics/i.test(text)) add("WARN", at, "0062 backfill does not report the linked row count");
      }
    } else {
      // Function body: runs later, at call time, under the function's rights.
      for (const t of updates) objects.mutations.push({ kind: "UPDATE", table: t, where: ctx, line: at, runtime: true });
      for (const t of inserts) objects.mutations.push({ kind: "INSERT", table: t, where: ctx, line: at, runtime: true });
      for (const t of deletes) {
        objects.mutations.push({ kind: "DELETE", table: t, where: ctx, line: at, runtime: true });
        add("WARN", at, `${ctx}: DELETE FROM ${t} in a function body (runtime path; review)`);
      }
    }
    void stmtLine;
  };

  for (const st of statements) {
    const t = norm(st.text);
    const low = t.toLowerCase();
    let m;

    if (/^begin$/i.test(low)) {
      transaction.begin = true;
      continue;
    }
    if (/^commit$/i.test(low)) {
      transaction.commit = true;
      continue;
    }

    for (const p of HTTP_PATTERNS) {
      if (p.test(t)) add("ERROR", st.line, `http / provider / extension call matched ${p}`);
    }

    if ((m = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\((.*)\)\s*$/is.exec(t))) {
      const name = bare(m[1]);
      objects.tables.push(name);
      tableDefs[name] = m[2];
      if (!/if\s+not\s+exists/i.test(t)) add("WARN", st.line, `create table ${name} without IF NOT EXISTS`);
      for (const r of m[2].matchAll(/\breferences\s+([\w."]+)\s*\(/gi)) referencedTables.add(bare(r[1]));
      const cols = columnDefs(m[2]);
      for (const c of cols) {
        // timestamptz only
        if (/^timestamp(\s*\(\d+\))?(\s+without\s+time\s+zone)?$/i.test(c.type)) add("ERROR", st.line, `${name}.${c.name}: timestamp without time zone`);
        // money: integer minor units with an explicit currency column
        if (/_minor$/i.test(c.name) && !/^(integer|int|bigint|int4|int8)$/i.test(c.type)) add("ERROR", st.line, `${name}.${c.name} is ${c.type}; minor units must be integer`);
        if (/^numeric/i.test(c.type) && !/pct|percent|rate|multiplier|score/i.test(c.name)) add("WARN", st.line, `${name}.${c.name} is numeric; money must be integer minor units`);
      }
      if (cols.some((c) => /_minor$/i.test(c.name)) && !cols.some((c) => c.name === "currency")) add("ERROR", st.line, `${name} has minor-unit money but no currency column`);
      continue;
    }

    if ((m = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+(.*)$/is.exec(t))) {
      const name = bare(m[1]);
      const actions = m[2];
      objects.alteredTables[name] ??= [];
      if (/enable\s+row\s+level\s+security/i.test(actions)) {
        objects.rlsEnabled.push(name);
        objects.alteredTables[name].push("enable RLS");
      }
      for (const a of actions.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([\w"]+)\s+([^,]+?)(?=,\s*add\s+column|,\s*add\s+constraint|$)/gis)) {
        const col = bare(a[1]);
        objects.columnsAdded.push(`${name}.${col}`);
        objects.alteredTables[name].push(`add column ${col}`);
        if (!/if\s+not\s+exists/i.test(a[0])) add("WARN", st.line, `${name}.${col}: add column without IF NOT EXISTS`);
        if (/\bnot\s+null\b/i.test(a[2]) && !/\bdefault\b/i.test(a[2])) add("ERROR", st.line, `${name}.${col}: NOT NULL without a default would rewrite/refuse existing rows`);
        if (/\btimestamp\b(?!\s*tz)/i.test(a[2])) add("ERROR", st.line, `${name}.${col}: timestamp without time zone`);
        for (const r of a[2].matchAll(/\breferences\s+([\w."]+)\s*\(/gi)) referencedTables.add(bare(r[1]));
      }
      for (const a of actions.matchAll(/add\s+constraint\s+([\w"]+)/gi)) objects.alteredTables[name].push(`add constraint ${bare(a[1])}`);
      for (const a of actions.matchAll(/drop\s+constraint\s+(?:if\s+exists\s+)?([\w"]+)/gi)) {
        objects.alteredTables[name].push(`drop constraint ${bare(a[1])}`);
        const recreated = new RegExp(`add\\s+constraint\\s+${bare(a[1])}\\b`, "i").test(raw);
        if (!recreated) add("ERROR", st.line, `${name}: drop constraint ${bare(a[1])} without re-adding it`);
      }
      if (/\bdrop\s+column\b/i.test(actions)) add("ERROR", st.line, `${name}: DROP COLUMN`);
      if (/\balter\s+column\b.*\btype\b/i.test(actions)) add("ERROR", st.line, `${name}: ALTER COLUMN TYPE rewrites existing rows`);
      if (/\bset\s+not\s+null\b/i.test(actions)) add("ERROR", st.line, `${name}: SET NOT NULL on an existing column`);
      if (/\bdisable\s+row\s+level\s+security\b/i.test(actions)) add("ERROR", st.line, `${name}: RLS disabled`);
      continue;
    }

    if ((m = /^create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([\w."]+)\s+on\s+([\w."]+)/i.exec(t))) {
      objects.indexes.push({ name: bare(m[2]), table: bare(m[3]), unique: Boolean(m[1]), partial: /\bwhere\b/i.test(t) });
      if (!/if\s+not\s+exists/i.test(t)) add("WARN", st.line, `index ${bare(m[2])} without IF NOT EXISTS`);
      continue;
    }

    if ((m = /^create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/i.exec(t))) {
      const name = bare(m[1]);
      const definer = /\bsecurity\s+definer\b/i.test(t);
      const searchPath = /\bset\s+search_path\b/i.test(t);
      objects.functions.push({ name, definer, searchPath });
      if (definer) {
        objects.securityDefiner.push(name);
        if (!searchPath) add("ERROR", st.line, `${name}: SECURITY DEFINER without SET search_path`);
        const revoked = new RegExp(`revoke\\s+all\\s+on\\s+function\\s+(public\\.)?${name}\\b`, "i").test(raw);
        if (!revoked) add("WARN", st.line, `${name}: SECURITY DEFINER but no REVOKE ALL ... FROM public in this file`);
      } else if (!searchPath) {
        add("INFO", st.line, `${name}: no SET search_path (invoker rights; trigger/helper)`);
      }
      st.bodies.forEach((b) => scanBody(b, `function ${name}`, st.line));
      continue;
    }

    if ((m = /^create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+([\w."]+)\s+.*?\bon\s+([\w."]+)/is.exec(t))) {
      objects.triggers.push({ name: bare(m[1]), table: bare(m[2]) });
      const dropped = new RegExp(`drop\\s+trigger\\s+if\\s+exists\\s+${bare(m[1])}\\b`, "i").test(raw);
      if (!dropped) add("WARN", st.line, `trigger ${bare(m[1])} is not preceded by DROP TRIGGER IF EXISTS (re-run would fail)`);
      continue;
    }

    if ((m = /^create\s+policy\s+([\w."]+)\s+on\s+([\w."]+)/i.exec(t))) {
      const roles = /\bto\s+([\w, ]+?)\s+(using|with)\b/i.exec(t)?.[1] ?? "public";
      const staffOnly = /is_internal_staff\(\)/i.test(t);
      const memberScoped = /is_member_of\(|is_tenant_admin\(/i.test(t);
      objects.policies.push({ name: bare(m[1]), table: bare(m[2]), roles: roles.trim(), staffOnly, memberScoped, text: t });
      if (!staffOnly && !memberScoped) add("ERROR", st.line, `policy ${bare(m[1])} has neither a staff nor a tenant-membership predicate`);
      if (/\bto\s+anon\b/i.test(t) || /\bto\s+public\b/i.test(t)) add("ERROR", st.line, `policy ${bare(m[1])} is granted to anon/public`);
      const dropped = new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+${bare(m[1])}\\b`, "i").test(raw);
      if (!dropped) add("WARN", st.line, `policy ${bare(m[1])} is not preceded by DROP POLICY IF EXISTS`);
      continue;
    }

    if ((m = /^create\s+(?:or\s+replace\s+)?view\s+([\w."]+)/i.exec(t))) {
      const name = bare(m[1]);
      const barrier = /security_barrier\s*=\s*true/i.test(t);
      const invoker = /security_invoker\s*=\s*true/i.test(t);
      objects.views.push({ name, barrier, invoker });
      if (!/is_member_of\(|is_internal_staff\(/i.test(t)) add("ERROR", st.line, `view ${name} has no tenant/staff predicate`);
      if (!barrier && !invoker) add("WARN", st.line, `view ${name} is neither security_barrier nor security_invoker`);
      continue;
    }

    if ((m = /^create\s+type\s+([\w."]+)/i.exec(t))) {
      objects.types.push(bare(m[1]));
      add("WARN", st.line, `create type ${bare(m[1])} is not idempotent (wrap in DO ... exception when duplicate_object)`);
      continue;
    }

    if ((m = /^drop\s+(table|type|schema|view|function|index|trigger|policy)\s+(?:if\s+exists\s+)?([\w."]+)/i.exec(t))) {
      const kind = m[1].toLowerCase();
      const name = bare(m[2]);
      objects.dropped.push({ kind, name });
      if (kind === "table" || kind === "type" || kind === "schema" || kind === "view" || kind === "function") {
        add("ERROR", st.line, `DROP ${kind.toUpperCase()} ${name}`);
      } else if (kind === "index") {
        const documented = /equivalent protection|replac/i.test(header);
        const replacementFirst = new RegExp(`create\\s+unique\\s+index[\\s\\S]*?drop\\s+index\\s+if\\s+exists\\s+(public\\.)?${name}`, "i").test(raw);
        if (documented && replacementFirst) add("WARN", st.line, `drops existing index ${name} — replacement created first and documented in the header (brief §14.2); rehearse on a branch database`);
        else add("ERROR", st.line, `drops existing index ${name} without a documented, preceding replacement (brief §14.2)`);
      } else {
        // drop trigger / policy if exists: the idempotent re-create pattern.
        const recreated = new RegExp(`create\\s+(?:or\\s+replace\\s+)?(?:constraint\\s+)?${kind}\\s+${name}\\b`, "i").test(raw);
        if (!recreated) add("WARN", st.line, `drop ${kind} ${name} is not re-created in this file`);
      }
      continue;
    }

    if (/^do\s+/i.test(t)) {
      st.bodies.forEach((b) => scanBody(b, "DO block", st.line));
      continue;
    }

    if (/^comment\s+on\b/i.test(t)) {
      objects.comments++;
      continue;
    }
    if (/^(grant|revoke)\b/i.test(t)) {
      objects.grants++;
      if (/^grant\b.*\bto\s+(anon|public)\b/i.test(t)) add("ERROR", st.line, `grant to anon/public: ${t.slice(0, 80)}`);
      continue;
    }

    if ((m = /^(update|delete|truncate|insert)\b/i.exec(t))) {
      const kind = m[1].toUpperCase();
      objects.mutations.push({ kind, table: "?", where: "top level", line: st.line, documented: false });
      add("ERROR", st.line, `top-level ${kind} statement: ${t.slice(0, 80)}`);
      continue;
    }

    add("WARN", st.line, `unclassified statement: ${t.slice(0, 80)}`);
  }

  // RLS on every new table.
  for (const tbl of objects.tables) {
    if (!objects.rlsEnabled.includes(tbl)) add("ERROR", 1, `${tbl}: RLS is not enabled in this file`);
    const pol = objects.policies.filter((p) => p.table === tbl);
    if (pol.length === 0) {
      const documented = /no policies|default-deny|service role only|service_role only/i.test(header);
      add(documented ? "INFO" : "WARN", 1, `${tbl}: no policies (default deny; service role only)${documented ? " — documented in header" : " — confirm intentional"}`);
    }
    const clientWrite = pol.filter((p) => !p.staffOnly && /for\s+(all|insert|update|delete)/i.test(p.text));
    for (const p of clientWrite) add("INFO", 1, `${tbl}: tenant-member write policy ${p.name} (review against §12.5)`);
  }
  if (transaction.begin !== transaction.commit) add("ERROR", 1, "unbalanced BEGIN/COMMIT");

  return {
    file,
    header: headerChecks,
    transaction,
    findings,
    objects,
    referencedTables: [...referencedTables],
    deps: { declared: declaredDeps, detected: [] },
  };
}

// ---------------------------------------------------------------------------
// Directory scan, numbering, collisions, dependencies, order
// ---------------------------------------------------------------------------

const entries = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => {
    const m = /^(\d{4})_(.+)\.sql$/.exec(f);
    return m ? { file: f, number: Number(m[1]), name: m[2], path: join(MIGRATIONS_DIR, f) } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));

const global = [];
const gadd = (level, message) => global.push({ level, message });

const byNumber = new Map();
for (const e of entries) byNumber.set(e.number, [...(byNumber.get(e.number) ?? []), e]);
for (const [num, list] of byNumber) {
  if (list.length > 1) {
    const inRange = num >= RANGE_FROM && num <= RANGE_TO;
    gadd(inRange ? "ERROR" : "WARN", `number ${String(num).padStart(4, "0")} is used by ${list.length} files: ${list.map((l) => l.file).join(", ")}${inRange ? "" : " (pre-existing; outside the range)"}`);
  }
}
for (let n = RANGE_FROM; n <= RANGE_TO; n++) {
  if (!byNumber.has(n)) {
    const why = KNOWN_GAPS[n];
    gadd("WARN", `no file numbered ${String(n).padStart(4, "0")}${why ? ` — ${why}` : ""}`);
  }
}
const highestOnDisk = Math.max(...entries.map((e) => e.number));
for (const [n, why] of Object.entries(KNOWN_GAPS)) {
  const num = Number(n);
  if (num < RANGE_FROM && num <= highestOnDisk && !byNumber.has(num)) gadd("INFO", `no file numbered ${String(num).padStart(4, "0")} below the range — ${why}`);
}
gadd("INFO", `${LEDGER_NAMES_WITHOUT_FILE.length} ledger names are checked for collisions (Phase 0 §11: 18 applied with no file on main, 0040–0043 by their applied names, client_economics); the ledger is name-based, so confirm numbering against schema_migrations before apply (N-h)`);

const inRange = entries.filter((e) => e.number >= RANGE_FROM && e.number <= RANGE_TO);
const appliedNames = new Set([
  ...LEDGER_NAMES_WITHOUT_FILE,
  ...entries.filter((e) => e.number < RANGE_FROM).map((e) => e.name),
]);
for (const e of inRange) {
  if (appliedNames.has(e.name)) gadd("ERROR", `${e.file}: name "${e.name}" collides with an applied ledger entry`);
  const dup = inRange.filter((o) => o !== e && o.name === e.name);
  if (dup.length) gadd("ERROR", `${e.file}: name duplicated within the range by ${dup.map((d) => d.file).join(", ")}`);
}

const results = inRange.map(analyseFile);

// Which in-range file creates which table / function.
const creator = new Map();
for (const r of results) {
  for (const t of r.objects.tables) creator.set(t, r.file.number);
  for (const f of r.objects.functions) creator.set(f.name, r.file.number);
}
for (const r of results) {
  const detected = new Set();
  for (const t of r.referencedTables) {
    const c = creator.get(t);
    if (c !== undefined && c !== r.file.number) detected.add(c);
  }
  r.deps.detected = [...detected].sort((a, b) => a - b);
  for (const d of r.deps.detected) {
    if (d > r.file.number) r.findings.push({ level: "ERROR", line: 1, message: `depends on ${String(d).padStart(4, "0")} which is numbered AFTER this file` });
    if (!r.deps.declared.includes(d)) r.findings.push({ level: "WARN", line: 1, message: `foreign key into a table from ${String(d).padStart(4, "0")} but the header does not declare it` });
  }
  for (const d of r.deps.declared) {
    if (d >= RANGE_FROM && d <= RANGE_TO && !byNumber.has(d)) r.findings.push({ level: "ERROR", line: 1, message: `header declares dependency ${String(d).padStart(4, "0")} which has no file` });
  }
  const externalRefs = r.referencedTables.filter((t) => creator.get(t) === undefined);
  r.externalRefs = externalRefs;
}

// Apply order: ascending number, verified against detected deps.
const order = results.map((r) => r.file.number).sort((a, b) => a - b);
for (const r of results) {
  for (const d of r.deps.detected) {
    if (order.indexOf(d) > order.indexOf(r.file.number)) gadd("ERROR", `apply order violated: ${r.file.file} needs ${d} first`);
  }
}

// Cross-file object name collisions (tables, functions, indexes, policies).
const seen = new Map();
for (const r of results) {
  const names = [
    ...r.objects.tables.map((t) => `table ${t}`),
    ...r.objects.functions.map((f) => `function ${f.name}`),
    ...r.objects.indexes.map((i) => `index ${i.name}`),
    ...r.objects.views.map((v) => `view ${v.name}`),
    ...r.objects.types.map((t) => `type ${t}`),
  ];
  for (const n of names) {
    if (seen.has(n) && seen.get(n) !== r.file.number) gadd("ERROR", `${n} is created by both ${seen.get(n)} and ${r.file.number}`);
    seen.set(n, r.file.number);
  }
}

// Objects that already exist in earlier files (a redesign file must not re-create them).
const earlierText = entries
  .filter((e) => e.number < RANGE_FROM)
  .map((e) => readFileSync(e.path, "utf8"))
  .join("\n");
for (const r of results) {
  for (const t of r.objects.tables) {
    if (new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${t}\\b`, "i").test(earlierText)) gadd("ERROR", `${r.file.file}: table ${t} already exists in an earlier migration`);
  }
  for (const i of r.objects.indexes) {
    if (new RegExp(`create\\s+(unique\\s+)?index\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${i.name}\\b`, "i").test(earlierText)) gadd("ERROR", `${r.file.file}: index ${i.name} already exists in an earlier migration`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(4, "0");
const count = (level) => results.reduce((a, r) => a + r.findings.filter((f) => f.level === level).length, 0) + global.filter((g) => g.level === level).length;
const errors = count("ERROR");
const warns = count("WARN");

if (json) {
  console.log(JSON.stringify({ range: rangeArg, order: order.map(pad), results, global, errors, warns }, null, 2));
  process.exit(errors ? 1 : 0);
}

const lines = [];
const out = (s = "") => lines.push(s);

out(`Migration dry-run — ${MIGRATIONS_DIR}`);
out(`Range ${pad(RANGE_FROM)}–${pad(RANGE_TO)} · ${results.length} file(s) · no database, no network, nothing executed`);
out();

for (const r of results) {
  const o = r.objects;
  out(`== ${r.file.file}`);
  out(`   header: NOT APPLIED=${r.header.notApplied} purpose=${r.header.purpose} dependencies=${r.header.dependencies} rollback=${r.header.rollback}` + (r.transaction.begin ? " · wrapped in BEGIN/COMMIT" : ""));
  if (o.tables.length) out(`   tables created: ${o.tables.join(", ")}`);
  if (o.types.length) out(`   enum types: ${o.types.join(", ")}`);
  for (const [tbl, acts] of Object.entries(o.alteredTables)) {
    if (o.tables.includes(tbl)) continue; // enable RLS on own table
    out(`   existing table altered: ${tbl} — ${acts.join("; ")}`);
  }
  if (o.indexes.length) out(`   indexes: ${o.indexes.map((i) => `${i.name}${i.unique ? " (unique" + (i.partial ? ", partial" : "") + ")" : ""}`).join(", ")}`);
  if (o.functions.length) out(`   functions: ${o.functions.map((f) => `${f.name}${f.definer ? " [SECURITY DEFINER]" : ""}`).join(", ")}`);
  if (o.triggers.length) out(`   triggers: ${o.triggers.map((t) => `${t.name} on ${t.table}`).join(", ")}`);
  if (o.views.length) out(`   views: ${o.views.map((v) => `${v.name}${v.barrier ? " [security_barrier]" : ""}`).join(", ")}`);
  if (o.policies.length) out(`   policies: ${o.policies.map((p) => `${p.name}${p.staffOnly ? " [staff]" : p.memberScoped ? " [tenant member]" : ""}`).join(", ")}`);
  if (o.rlsEnabled.length) out(`   RLS enabled on: ${o.rlsEnabled.join(", ")}`);
  const applyMut = o.mutations.filter((m) => !m.runtime);
  const runtimeMut = o.mutations.filter((m) => m.runtime);
  out(`   row mutations at apply time: ${applyMut.length ? applyMut.map((m) => `${m.kind} ${m.table}${m.documented ? " (documented backfill)" : ""}`).join(", ") : "none"}`);
  if (runtimeMut.length) out(`   runtime writes inside function bodies (not executed at apply): ${[...new Set(runtimeMut.map((m) => `${m.kind} ${m.table}`))].join(", ")}`);
  out(`   dependencies: declared ${r.deps.declared.length ? r.deps.declared.map(pad).join(", ") : "none"}; detected in-range FK deps ${r.deps.detected.length ? r.deps.detected.map(pad).join(", ") : "none"}; references outside the range: ${r.externalRefs.length ? r.externalRefs.join(", ") : "none"}`);
  const shown = r.findings.filter((f) => f.level !== "INFO");
  const infos = r.findings.filter((f) => f.level === "INFO");
  for (const f of shown) out(`   ${f.level.padEnd(5)} L${f.line}: ${f.message}`);
  for (const f of infos) out(`   info  L${f.line}: ${f.message}`);
  out();
}

out("== Directory, ledger and order");
for (const g of global) out(`   ${g.level.padEnd(5)} ${g.message}`);
if (!global.length) out("   no numbering or naming problems");
out();
out("== Apply order (ascending number; every detected dependency precedes its dependant)");
for (const n of order) {
  const r = results.find((x) => x.file.number === n);
  const deps = r.deps.detected.length ? `after ${r.deps.detected.map(pad).join(", ")}` : "no in-range dependency";
  out(`   ${pad(n)} ${r.file.name.padEnd(34)} ${deps}`);
}
out();
out(`Result: ${errors} error(s), ${warns} warning(s). ${errors ? "FIX OR JUSTIFY BEFORE APPLY." : "No blocking finding. Still NOT APPLIED: reconcile schema_migrations (Phase 0 N-h) and rehearse on a branch database first."}`);

console.log(lines.join("\n"));
process.exit(errors ? 1 : 0);
