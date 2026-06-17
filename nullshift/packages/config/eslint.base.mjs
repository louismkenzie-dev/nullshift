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
  {
    // These newer/stylistic rules fire on long-standing patterns in code that
    // predates the monorepo (the `// label` design motif, inline sub-components,
    // setState-in-effect). They are surfaced as warnings — not gate failures —
    // and get cleaned up as each app is reworked (admin/portal in Phase 3).
    rules: {
      "react/jsx-no-comment-textnodes": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      // React Compiler advisory rules (eslint-plugin-react-hooks v6). These flag
      // compiler-readiness, not runtime bugs, and fire across pre-monorepo code.
      // Kept as warnings; `rules-of-hooks` + `exhaustive-deps` stay at default.
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);

export default nullshiftEslintConfig;
