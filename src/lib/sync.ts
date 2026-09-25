"use client";

import { create } from "zustand";
import { useStore, type AppState } from "./store";
import type { WorkspaceSettings } from "./types";

/**
 * Write-through sync: watches the store, diffs each collection by object
 * identity (immutable updates only touch changed entities) and pushes upserts
 * and deletes to /api/sync in debounced batches. Last write wins.
 */

export const COLLECTIONS = ["users", "clients", "tags", "projects", "sprints", "issues", "timeEntries", "offers", "offerBaselines", "allocations", "holidays", "timeOffs"] as const;
export type Collection = (typeof COLLECTIONS)[number];

type Entity = { id: string };

export type SyncStatus = "idle" | "saving" | "saved" | "error" | "offline";
export const useSyncStatus = create<{ status: SyncStatus; pending: number; lastError?: string; set: (p: Partial<{ status: SyncStatus; pending: number; lastError?: string }>) => void }>((set) => ({
  status: "idle",
  pending: 0,
  set: (p) => set(p),
}));

const prev: Record<Collection, Map<string, Entity>> = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()])) as Record<Collection, Map<string, Entity>>;
let prevSettings: WorkspaceSettings | null = null;
const pendingUpserts: Record<Collection, Map<string, Entity>> = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()])) as Record<Collection, Map<string, Entity>>;
const pendingDeletes: Record<Collection, Set<string>> = Object.fromEntries(COLLECTIONS.map((c) => [c, new Set()])) as Record<Collection, Set<string>>;
let pendingSettings: WorkspaceSettings | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let started = false;

function snapshot(state: AppState) {
  for (const c of COLLECTIONS) prev[c] = new Map((state[c] as Entity[]).map((e) => [e.id, e]));
  prevSettings = state.settings;
}

function pendingCount() {
  return COLLECTIONS.reduce((a, c) => a + pendingUpserts[c].size + pendingDeletes[c].size, 0) + (pendingSettings ? 1 : 0);
}

function onChange(state: AppState) {
  if (!state.bootstrapped || state.applyingRemote) {
    if (state.bootstrapped) snapshot(state);
    return;
  }
  let changed = false;
  for (const c of COLLECTIONS) {
    const list = state[c] as Entity[];
    const next = new Map(list.map((e) => [e.id, e]));
    const old = prev[c];
    if (next === old) continue;
    for (const [id, e] of next) {
      if (old.get(id) !== e) {
        pendingUpserts[c].set(id, e);
        pendingDeletes[c].delete(id);
        changed = true;
      }
    }
    for (const id of old.keys()) {
      if (!next.has(id)) {
        pendingDeletes[c].add(id);
        pendingUpserts[c].delete(id);
        changed = true;
      }
    }
    prev[c] = next;
  }
  if (state.settings !== prevSettings) {
    pendingSettings = state.settings;
    prevSettings = state.settings;
    changed = true;
  }
  if (changed) schedule();
}

function schedule(delay = 500) {
  useSyncStatus.getState().set({ pending: pendingCount(), status: "saving" });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, delay);
}

async function flush() {
  timer = null;
  if (inFlight) return schedule(300);
  if (pendingCount() === 0) return;
  const body = {
    upserts: Object.fromEntries(COLLECTIONS.filter((c) => pendingUpserts[c].size).map((c) => [c, Array.from(pendingUpserts[c].values())])),
    deletes: Object.fromEntries(COLLECTIONS.filter((c) => pendingDeletes[c].size).map((c) => [c, Array.from(pendingDeletes[c])])),
    settings: pendingSettings ?? undefined,
  };
  const taken = { upserts: { ...pendingUpserts }, deletes: { ...pendingDeletes } };
  for (const c of COLLECTIONS) {
    pendingUpserts[c] = new Map();
    pendingDeletes[c] = new Set();
  }
  const takenSettings = pendingSettings;
  pendingSettings = null;
  inFlight = true;
  let failed = false;
  try {
    const res = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 401) {
      window.location.assign(window.location.origin + "/login");
      return;
    }
    if (!res.ok) throw new Error(`Sync failed (${res.status})`);
    useSyncStatus.getState().set({ status: pendingCount() ? "saving" : "saved", pending: pendingCount(), lastError: undefined });
  } catch (e) {
    failed = true;
    // put the batch back (newer pending changes win over the requeued ones)
    for (const c of COLLECTIONS) {
      for (const [id, ent] of taken.upserts[c]) if (!pendingUpserts[c].has(id) && !pendingDeletes[c].has(id)) pendingUpserts[c].set(id, ent);
      for (const id of taken.deletes[c]) if (!pendingUpserts[c].has(id)) pendingDeletes[c].add(id);
    }
    if (takenSettings && !pendingSettings) pendingSettings = takenSettings;
    useSyncStatus.getState().set({ status: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error", pending: pendingCount(), lastError: String(e) });
    setTimeout(flush, 5000);
  } finally {
    inFlight = false;
    // after a failure the retry above takes over (and keeps the error visible); otherwise push what arrived meanwhile
    if (!failed && pendingCount() && !timer) schedule(300);
  }
}

/** Start watching the store. Call once after the first bootstrap. */
export function startSync() {
  if (started) return;
  started = true;
  snapshot(useStore.getState());
  useStore.subscribe(onChange);
  window.addEventListener("online", () => pendingCount() && flush());
  window.addEventListener("beforeunload", (e) => {
    if (pendingCount() > 0) {
      // try a last synchronous-ish push
      void flush();
      e.preventDefault();
    }
  });
}

/** Re-snapshot after a remote load so the diff does not replay the whole workspace. */
export function resnapshot() {
  snapshot(useStore.getState());
}
