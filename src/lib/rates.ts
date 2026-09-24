import { format } from "date-fns";
import type { Project, RatePeriod, TimeEntry, User, WorkspaceSettings } from "./types";
import { entryDuration } from "./utils";

/** "All time entries" sentinel for applyFrom */
export const EPOCH = "1970-01-01";

export function today() {
  return format(new Date(), "yyyy-MM-dd");
}

/** Rate in force at a given ISO date (latest period whose `from` <= date). */
export function rateAt(periods: RatePeriod[] | undefined, dateIso: string): number | undefined {
  if (!periods || periods.length === 0) return undefined;
  const d = dateIso.slice(0, 10);
  let best: RatePeriod | undefined;
  for (const p of periods) if (p.from <= d && (!best || p.from > best.from)) best = p;
  return best?.rate;
}

/** Current rate (as of today). */
export function currentRate(periods: RatePeriod[] | undefined) {
  return rateAt(periods, today());
}

/** Period currently in force (for "since ..." labels). */
export function currentPeriod(periods: RatePeriod[] | undefined): RatePeriod | undefined {
  if (!periods?.length) return undefined;
  const d = today();
  return [...periods].filter((p) => p.from <= d).sort((a, b) => b.from.localeCompare(a.from))[0];
}

/**
 * Apply a new rate from a date: periods starting on/after `applyFrom` are replaced.
 * `applyFrom = EPOCH` rewrites the whole history (retroactive on everything).
 */
export function applyRate(periods: RatePeriod[] | undefined, rate: number, applyFrom: string): RatePeriod[] {
  const kept = (periods ?? []).filter((p) => p.from < applyFrom);
  return [...kept, { from: applyFrom, rate }].sort((a, b) => a.from.localeCompare(b.from));
}

export function costRateFor(user: User | undefined, project: Project | undefined, dateIso: string): number {
  const override = user && project?.memberRates?.[user.id]?.cost;
  return rateAt(override, dateIso) ?? rateAt(user?.costRates, dateIso) ?? 0;
}

export function billingRateFor(user: User | undefined, project: Project | undefined, dateIso: string): number {
  const override = user && project?.memberRates?.[user.id]?.billing;
  return rateAt(override, dateIso) ?? rateAt(project?.billingRates, dateIso) ?? 0;
}

export interface EntryValue {
  seconds: number;
  billableSeconds: number;
  /** hours x cost rate, all entries */
  cost: number;
  /** billable hours x billing rate */
  revenue: number;
}

export function valueEntries(entries: TimeEntry[], users: User[], projects: Project[], now = new Date()): EntryValue {
  const um = new Map(users.map((u) => [u.id, u]));
  const pm = new Map(projects.map((p) => [p.id, p]));
  let seconds = 0;
  let billableSeconds = 0;
  let cost = 0;
  let revenue = 0;
  for (const e of entries) {
    const s = entryDuration(e, now);
    const h = s / 3600;
    const u = um.get(e.userId);
    const p = e.projectId ? pm.get(e.projectId) : undefined;
    seconds += s;
    cost += h * costRateFor(u, p, e.start);
    if (e.billable) {
      billableSeconds += s;
      revenue += h * billingRateFor(u, p, e.start);
    }
  }
  return { seconds, billableSeconds, cost, revenue };
}

export function formatMoney(value: number, currency: string = "EUR", fractionDigits = 0) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: fractionDigits, minimumFractionDigits: 0 }).format(value);
}

export function formatDays(seconds: number, settings: Pick<WorkspaceSettings, "hoursPerDay">) {
  const d = seconds / 3600 / (settings.hoursPerDay || 8);
  return `${Number.isInteger(d) ? d : d.toFixed(1)} d`;
}

export function marginPct(revenue: number, cost: number) {
  if (!revenue) return 0;
  return Math.round(((revenue - cost) / revenue) * 100);
}
