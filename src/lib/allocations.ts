import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type { Allocation, Holiday, ID, Project, TimeEntry, TimeOff, WorkspaceSettings } from "./types";

export const VIRTUAL_PREFIX = "va_";

export function isVirtual(e: TimeEntry) {
  return !!e.virtual;
}

export function isWorkingDay(date: Date, settings: Pick<WorkspaceSettings, "workDays">, holidays: Holiday[]) {
  if (!settings.workDays.includes(date.getDay())) return false;
  const key = format(date, "yyyy-MM-dd");
  return !holidays.some((h) => h.date === key);
}

export function isOff(userId: ID, date: Date, timeOffs: TimeOff[]) {
  const key = format(date, "yyyy-MM-dd");
  return timeOffs.some((t) => t.userId === userId && t.from <= key && key <= t.to);
}

export function allocationActive(a: Allocation, date: Date) {
  const key = format(date, "yyyy-MM-dd");
  return a.from <= key && (!a.to || key <= a.to);
}

/** Sum of allocation percentages for a user on a day (over-allocation check) */
export function allocatedPercent(userId: ID, date: Date, allocations: Allocation[]) {
  return allocations.filter((a) => a.userId === userId && allocationActive(a, date)).reduce((s, a) => s + a.percent, 0);
}

export interface BuildOptions {
  from: Date;
  to: Date;
  allocations: Allocation[];
  projects: Project[];
  settings: WorkspaceSettings;
  holidays: Holiday[];
  timeOffs: TimeOff[];
  /** Real entries: a real entry on the same user + project + day replaces the virtual one */
  realEntries: TimeEntry[];
}

/**
 * Virtual time entries generated from fixed allocations. They are never stored:
 * every consumer merges them with real entries through `useEffectiveEntries`.
 */
export function buildAllocationEntries(o: BuildOptions): TimeEntry[] {
  const out: TimeEntry[] = [];
  if (o.allocations.length === 0) return out;
  const overrides = new Set(o.realEntries.filter((e) => e.projectId).map((e) => `${e.userId}|${e.projectId}|${e.start.slice(0, 10)}`));
  const projectMap = new Map(o.projects.map((p) => [p.id, p]));
  const [sh, sm] = (o.settings.dayStart || "09:00").split(":").map(Number);
  const days = differenceInCalendarDays(startOfDay(o.to), startOfDay(o.from));
  for (let d = 0; d <= days; d++) {
    const day = addDays(startOfDay(o.from), d);
    if (!isWorkingDay(day, o.settings, o.holidays)) continue;
    const key = format(day, "yyyy-MM-dd");
    // stack allocations per user so blocks do not overlap in the calendar
    const cursor = new Map<ID, Date>();
    for (const a of o.allocations) {
      if (!allocationActive(a, day)) continue;
      const project = projectMap.get(a.projectId);
      if (!project || project.archived) continue;
      if (isOff(a.userId, day, o.timeOffs)) continue;
      if (overrides.has(`${a.userId}|${a.projectId}|${key}`)) continue;
      const seconds = Math.round((a.percent / 100) * o.settings.hoursPerDay * 3600);
      if (seconds <= 0) continue;
      const start = cursor.get(a.userId) ?? new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm, 0);
      const stop = new Date(start.getTime() + seconds * 1000);
      cursor.set(a.userId, stop);
      out.push({
        id: `${VIRTUAL_PREFIX}${a.id}_${key}`,
        userId: a.userId,
        description: a.note || `Allocation ${a.percent}%`,
        projectId: a.projectId,
        issueId: a.issueId,
        tagIds: [],
        billable: project.billable,
        start: toIso(start),
        stop: toIso(stop),
        virtual: true,
        allocationId: a.id,
        percent: a.percent,
      });
    }
  }
  return out;
}

function toIso(d: Date) {
  // local ISO with offset, same shape as date-fns formatISO
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/** Earliest allocation start, used to bound the generation window */
export function earliestAllocation(allocations: Allocation[]) {
  if (!allocations.length) return undefined;
  return parseISO(allocations.reduce((m, a) => (a.from < m ? a.from : m), allocations[0].from));
}

export const TIME_OFF_KINDS: { id: TimeOff["kind"]; name: string }[] = [
  { id: "vacation", name: "Vacation" },
  { id: "sick", name: "Sick leave" },
  { id: "other", name: "Other" },
];
