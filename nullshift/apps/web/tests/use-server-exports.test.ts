import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A "use server" module may only export async functions.
 *
 * Export a string, an object, a class — anything else — and Next throws at
 * MODULE EVALUATION: "A 'use server' file can only export async functions,
 * found string." Which means the route does not fail when the action runs, it
 * fails when the page is rendered, and every visitor gets a 500.
 *
 * Nothing catches this before production. It type-checks, it lints, it builds,
 * and the dev server is happy. We shipped exactly this on /portal/forgot and it
 * sat there for three weeks: every client who tried to reset their password got
 * "A server error occurred", and the one path a locked-out client has to help
 * themselves was the one path that was down.
 *
 * So the build is not the safety net — this is. It reads every server module in
 * the app and fails on any export that is not an async function.
 */

const APP = join(__dirname, "..", "app");
const LIB = join(__dirname, "..", "lib");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Files whose first statement is the "use server" directive. */
function serverModules(): { path: string; source: string }[] {
  return [...walk(APP), ...walk(LIB)]
    .map((path) => ({ path, source: readFileSync(path, "utf8") }))
    .filter(({ source }) => /^\s*["']use server["'];/.test(source));
}

/**
 * Exports that are legal in a "use server" module: async functions, and
 * type-only exports (erased at compile time, so they never reach the runtime
 * check).
 */
const LEGAL = [
  /^export\s+async\s+function\s/,
  /^export\s+type\s/,
  /^export\s+interface\s/,
  /^export\s+default\s+async\s+function\s/,
];

describe("\"use server\" modules", () => {
  const modules = serverModules();

  it("finds the server modules to check", () => {
    // A guard on the guard: if the walk silently stops finding anything, this
    // whole suite would pass while checking nothing.
    expect(modules.length).toBeGreaterThan(5);
  });

  it.each(modules.map((m) => [m.path.split("/apps/web/")[1] ?? m.path, m] as const))(
    "%s exports only async functions",
    (_name, mod) => {
      const offenders = mod.source
        .split("\n")
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(({ line }) => line.startsWith("export"))
        .filter(({ line }) => !LEGAL.some((re) => re.test(line)))
        // `export { a, b }` re-exports of async functions are fine; what is not
        // fine is a value binding declared with const/let/var/class/enum.
        .filter(({ line }) => /^export\s+(const|let|var|class|enum|default)\s/.test(line))
        .map(({ line, n }) => `${n}: ${line}`);

      expect(
        offenders,
        `${mod.path} exports a non-async value from a "use server" module — ` +
          `this throws at module evaluation and 500s the whole route`
      ).toEqual([]);
    }
  );
});
