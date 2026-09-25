import { differenceInCalendarDays, parseISO } from "date-fns";
import type { HolidayKind } from "./types";

/**
 * Workspace-wide days off: public holidays and company closures. A holiday
 * covers one day (`date`) or a range (`date`..`to`, inclusive). Allocations,
 * line scheduling and capacity all skip these days for everybody.
 */

export interface HolidayLike {
  date: string;
  to?: string;
}

export const HOLIDAY_KINDS: { id: HolidayKind; name: string; description: string }[] = [
  { id: "holiday", name: "Holiday", description: "Public holiday, usually one day" },
  { id: "closure", name: "Company closure", description: "Everybody is off for the whole period" },
];

/** yyyy-MM-dd `iso` falls inside one of the holidays */
export function isHoliday(iso: string, holidays: HolidayLike[]): boolean {
  return holidays.some((h) => h.date <= iso && iso <= (h.to && h.to > h.date ? h.to : h.date));
}

/** Last day of a holiday (its first day when it is a single day) */
export function holidayEnd(h: HolidayLike): string {
  return h.to && h.to > h.date ? h.to : h.date;
}

/** Calendar days covered, inclusive (1 for a single day) */
export function holidayDays(h: HolidayLike): number {
  return differenceInCalendarDays(parseISO(holidayEnd(h)), parseISO(h.date)) + 1;
}

/** Holidays sorted by first day */
export function sortHolidays<T extends HolidayLike>(holidays: T[]): T[] {
  return [...holidays].sort((a, b) => a.date.localeCompare(b.date) || holidayEnd(a).localeCompare(holidayEnd(b)));
}
