// Sprint 5 ticket 4 (docs/06-system-architecture.md §3): bundles src/index.tsx
// into one self-contained IIFE any third-party page can load via
// `<script src=".../widget.js" data-widget-key="...">`. Nothing in the docs
// names a bundler — esbuild is the pragmatic choice for "one entry point,
// one output file," not a decision pinned anywhere.
//
// process.env.NEXT_PUBLIC_API_URL is baked in at build time via esbuild's
// `define` — the exact same static-substitution mechanism @hospitality/sdk's
// baseUrl() already documents for Next.js, so the SDK code itself needed zero
// changes to work outside of Next.

import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

// Sprint 5 has no real CDN/hosting decision yet (nothing in the docs
// addresses it) — default to the local api dev port, matching
// apps/web/.env.local's own NEXT_PUBLIC_API_URL, overridable per build.
const apiUrl = process.env.WIDGET_API_URL || "http://localhost:3100";

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [path.join(__dirname, "src/index.tsx")],
  outfile: path.join(__dirname, "dist/widget.js"),
  bundle: true,
  format: "iife",
  target: "es2019",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  loader: { ".css": "text" },
  define: {
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(apiUrl),
    // React/ReactDOM's own source checks process.env.NODE_ENV internally —
    // there's no Node `process` global in a browser at all, so leaving this
    // undefined throws a ReferenceError the instant React's module code
    // runs, which killed the render with no console output (the exception
    // happened before React's own error-logging machinery could engage).
    "process.env.NODE_ENV": watch ? '"development"' : '"production"',
  },
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log(`[widget-embed] watching — api url baked in: ${apiUrl}`);
} else {
  await build(options);
  console.log(`[widget-embed] built dist/widget.js — api url baked in: ${apiUrl}`);
}
