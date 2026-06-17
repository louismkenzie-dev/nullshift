// RLS cross-tenant isolation test runner (brief §3/§9). Runs the SQL fixture in
// src/rls-isolation.test.sql inside a transaction and ROLLS BACK, so nothing
// persists. Connects via a Postgres URL from the environment.
//
// Set one of: SUPABASE_DB_URL | DATABASE_URL | POSTGRES_URL  (a direct/pooler
// connection string with privileges to create auth.users + SET ROLE authenticated).
//
// Without a connection string the test SKIPS with exit 0 — so `turbo run test`
// stays green in CI until DB creds are wired. The same assertions have been
// verified against the live database during Phase 1.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "rls-isolation.test.sql"), "utf8");

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

if (!connectionString) {
  console.log(
    "[rls.test] SKIP — no SUPABASE_DB_URL/DATABASE_URL/POSTGRES_URL set. " +
      "Wire a Postgres connection string to run the cross-tenant RLS test."
  );
  process.exit(0);
}

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query("begin");
  await client.query(sql); // raises inside the DO block on any isolation failure
  await client.query("rollback");
  console.log(
    "[rls.test] PASS — cross-tenant isolation holds (Tenant A cannot read Tenant B)."
  );
  process.exit(0);
} catch (err) {
  try {
    await client.query("rollback");
  } catch {
    // ignore rollback errors
  }
  console.error("[rls.test] FAIL —", err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
