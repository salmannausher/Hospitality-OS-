// Sprint 5 ticket 4 (docs/06-system-architecture.md §3): the actual
// self-mounting entry point a host page loads via
// `<script src=".../widget.js" data-widget-key="wk_...">`.
//
// document.currentScript is only reliable during the script's own synchronous
// top-level execution — captured here, before any DOM-readiness deferral,
// rather than inside mount() where it would already be null.

import * as React from "react";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import cssText from "@hospitality/ui/tokens.css";
import { WidgetEmbed } from "./WidgetEmbed";

// motion/react's bundled code references a global `React` binding in a few
// places (a UMD-era assumption) — a plain ES import doesn't create one, and
// an IIFE bundle has no module scope to resolve it from, so it throws
// `ReferenceError: React is not defined` the instant an animated component
// mounts. Exposing it explicitly is the standard workaround for bundling
// this kind of dependency into a browser IIFE with esbuild.
(globalThis as unknown as { React: typeof React }).React = React;

const scriptEl = document.currentScript as HTMLScriptElement | null;

function mount() {
  const widgetKey = scriptEl?.dataset.widgetKey;
  if (!widgetKey) {
    console.error(
      "[hospitality-widget] the script tag is missing a data-widget-key attribute — nothing mounted.",
    );
    return;
  }

  const style = document.createElement("style");
  style.textContent = cssText;
  document.head.appendChild(style);

  const container = document.createElement("div");
  container.id = "hospitality-widget-root";
  document.body.appendChild(container);

  createRoot(container).render(createElement(WidgetEmbed, { widgetKey }));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
