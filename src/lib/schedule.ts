import { addDays, format, parseISO } from "date-fns";
import { isHoliday, type HolidayLike } from "./holidays";
import type { ID, OfferLine } from "./types";

/**
 * Working-day arithmetic and the finish-to-start scheduling of offer lines.
 * A line with a predecessor starts `lagDays` working days after that line
 * ends (next working day when the lag is 0) and keeps its own duration.
 */

export interface WorkCalendar {
  /** 0 = Sunday ... 6 = Saturday */
  workDays: number[];
  /** Public holidays and company closures (single days or ranges) */
  holidays: HolidayLike[];
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export function isWorkingDay(iso: string, cal: WorkCalendar) {
  const d = parseISO(iso);
  return (cal.workDays.length ? cal.workDays : [1, 2, 3, 4, 5]).includes(d.getDay()) && !isHoliday(iso, cal.holidays);
}

/**
 * Move `n` working days forward (or backward when negative) from `iso`.
 * n = 0 snaps to the same day, or to the next working day if it is not one.
 */
export function addWorkingDays(iso: string, n: number, cal: WorkCalendar): string {
  let d = parseISO(iso);
  let left = Math.trunc(n);
  const step = left < 0 ? -1 : 1;
  let guard = 0;
  if (left === 0) {
    while (!isWorkingDay(ymd(d), cal) && guard++ < 1000) d = addDays(d, 1);
    return ymd(d);
  }
  while (left !== 0 && guard++ < 10000) {
    d = addDays(d, step);
    if (isWorkingDay(ymd(d), cal)) left -= step;
  }
  return ymd(d);
}

/** Working days from `fromIso` to `toIso`, both inclusive (at least 1) */
export function workingDaysBetween(fromIso: string, toIso: string, cal: WorkCalendar): number {
  if (toIso < fromIso) return 1;
  let d = parseISO(fromIso);
  const end = parseISO(toIso);
  let count = 0;
  let guard = 0;
  while (d <= end && guard++ < 10000) {
    if (isWorkingDay(ymd(d), cal)) count++;
    d = addDays(d, 1);
  }
  return Math.max(1, count);
}

/** Duration of a line in working days: its planned span, or its hours at hoursPerDay, at least 1 */
export function lineDurationDays(line: Pick<OfferLine, "plannedStart" | "plannedEnd" | "hours">, cal: WorkCalendar, hoursPerDay: number) {
  if (line.plannedStart && line.plannedEnd) return workingDaysBetween(line.plannedStart, line.plannedEnd, cal);
  return Math.max(1, Math.ceil((line.hours || 0) / (hoursPerDay || 8)));
}

/** Ids of the lines that depend, directly or through others, on `id` (they cannot become its predecessor) */
export function dependentsOf(lines: Pick<OfferLine, "id" | "predecessorId">[], id: ID): Set<ID> {
  const out = new Set<ID>();
  let grew = true;
  let guard = 0;
  while (grew && guard++ < lines.length + 1) {
    grew = false;
    for (const l of lines) {
      if (!l.predecessorId || out.has(l.id)) continue;
      if (l.predecessorId === id || out.has(l.predecessorId)) {
        out.add(l.id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * Recompute the dates of the lines that have a predecessor. Lines without one,
 * and lines whose predecessor has no end date or sits in a cycle, are returned
 * as they are (same object), so the store diff only sees real changes.
 */
export function scheduleLines(lines: OfferLine[], opts: { cal: WorkCalendar; hoursPerDay: number }): OfferLine[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  // lines whose chain of predecessors comes back to themselves are left alone
  const cyclic = new Set<ID>();
  for (const l of lines) {
    let cur = l.predecessorId ? byId.get(l.predecessorId) : undefined;
    let guard = 0;
    while (cur && guard++ < lines.length) {
      if (cur.id === l.id) {
        cyclic.add(l.id);
        break;
      }
      cur = cur.predecessorId ? byId.get(cur.predecessorId) : undefined;
    }
  }
  const memo = new Map<ID, OfferLine>();
  const resolve = (line: OfferLine, stack: Set<ID>): OfferLine => {
    const done = memo.get(line.id);
    if (done) return done;
    let out = line;
    const pred = line.predecessorId && !cyclic.has(line.id) ? byId.get(line.predecessorId) : undefined;
    if (pred && pred.id !== line.id && !stack.has(pred.id)) {
      const p = resolve(pred, new Set([...stack, line.id]));
      if (p.plannedEnd) {
        const start = addWorkingDays(p.plannedEnd, 1 + (line.lagDays ?? 0), opts.cal);
        const duration = lineDurationDays(line, opts.cal, opts.hoursPerDay);
        const end = addWorkingDays(start, duration - 1, opts.cal);
        if (start !== line.plannedStart || end !== line.plannedEnd) out = { ...line, plannedStart: start, plannedEnd: end };
      }
    }
    memo.set(line.id, out);
    return out;
  };
  const scheduled = lines.map((l) => resolve(l, new Set()));
  return scheduled.every((l, i) => l === lines[i]) ? lines : scheduled;
}
