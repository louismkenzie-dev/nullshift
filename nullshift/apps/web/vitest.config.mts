import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for pure workflow logic only (scoring, gates, folds) — no DOM,
// no Supabase. The cross-tenant RLS test lives in packages/db and runs
// separately against a real database (see packages/db/src/rls.test.mjs).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
