import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // public/widget.js is the esbuild-bundled packages/widget-embed output
  // (apps/demo-bellevue/package.json's sync-widget script), copied in on
  // every build — a vendored build artifact, not source, and already
  // gitignored. Never excluded from lint until now, so any local rebuild
  // (e.g. testing findings-log.md #46) makes `pnpm lint` fail on ~1,200
  // problems in a minified bundle it was never meant to check.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/widget.js"]),
]);

export default eslintConfig;
