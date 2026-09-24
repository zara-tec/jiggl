"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

/** True once the workspace has been loaded from the server. */
export function useHydrated() {
  return useStore((s) => s.bootstrapped);
}

/** Ticks every second; used by running timers. */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}
