import { clsx, type ClassValue } from "clsx";
import {
  differenceInSeconds,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isToday,
  isYesterday,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
} from "date-fns";
import type { TimeEntry } from "./types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts.length > 1 ? parts[parts.length - 1][0] : "").toUpperCase();
}

/** Seconds -> "H:MM:SS" (clock style) */
export function formatDurationClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Seconds -> "2h 30m" (short style) */
export function formatDurationShort(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Seconds -> decimal hours "2.50 h" */
export function formatHoursDecimal(totalSeconds: number) {
  return (totalSeconds / 3600).toFixed(2);
}

/** Parse "1h 30m", "1:30", "90m", "1.5h", "2" (hours) into seconds */
export function parseDuration(input: string): number | undefined {
  const str = input.trim().toLowerCase();
  if (!str) return undefined;
  const clock = str.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0);
  }
  let total = 0;
  let matched = false;
  const re = /(\d+(?:[.,]\d+)?)\s*(w|d|h|m|s)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    if (!m[0].trim()) continue;
    matched = true;
    const n = parseFloat(m[1].replace(",", "."));
    switch (m[2]) {
      case "w":
        total += n * 5 * 8 * 3600;
        break;
      case "d":
        total += n * 8 * 3600;
        break;
      case "m":
        total += n * 60;
        break;
      case "s":
        total += n;
        break;
      default:
        total += n * 3600;
    }
  }
  return matched ? Math.round(total) : undefined;
}

export function entryDuration(entry: TimeEntry, now: Date = new Date()) {
  const start = parseISO(entry.start);
  const stop = entry.stop ? parseISO(entry.stop) : now;
  return Math.max(0, differenceInSeconds(stop, start));
}

export function formatTime(iso: string) {
  return format(parseISO(iso), "HH:mm");
}

export function formatDate(iso: string | undefined, pattern = "d MMM yyyy") {
  if (!iso) return "";
  return format(parseISO(iso), pattern);
}

export function formatDayLabel(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, d MMM");
}

export function relativeTime(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
}

export function dayKey(iso: string) {
  return format(parseISO(iso), "yyyy-MM-dd");
}

export function weekRange(date: Date) {
  return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
}

export function inRange(iso: string, start: Date, end: Date) {
  const d = parseISO(iso);
  return d >= startOfDay(start) && d <= endOfDay(end);
}

export function sameDay(isoA: string, b: Date) {
  return isSameDay(parseISO(isoA), b);
}

export function daysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  let cur = startOfDay(start);
  const last = startOfDay(end);
  while (cur <= last) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

export function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function hashColor(seed: string, palette: string[]) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
