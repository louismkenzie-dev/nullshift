import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Shared ESLint config for every Nullshift Next.js app. Each app re-exports this
 * and may append app-specific overrides.
 */
export const nullshiftEslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "dist/**", "next-env.d.ts"]),
]);

export default nullshiftEslintConfig;
