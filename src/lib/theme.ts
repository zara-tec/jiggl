"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
export const THEME_KEY = "jiggl-theme";

/**
 * Inline script for <head>: applies the saved theme before the first paint so
 * there is no flash of the wrong theme. Keep in sync with resolveTheme().
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

const listeners = new Set<() => void>();
let mql: MediaQueryList | null = null;

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" ? t : "system";
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return theme;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(theme);
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!mql && typeof window !== "undefined") {
    mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", () => {
      if (readTheme() === "system") applyTheme("system");
      listeners.forEach((l) => l());
    });
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      applyTheme(readTheme());
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current theme preference and the resolved appearance. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  return { theme, resolved: resolveTheme(theme), setTheme };
}
