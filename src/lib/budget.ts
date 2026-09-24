import { addDays, differenceInCalendarDays, eachWeekOfInterval, format, max as maxDate, min as minDate, parseISO, startOfDay, startOfWeek, subWeeks } from "date-fns";
import type { ID, Issue, Offer, OfferLine, Project, TimeEntry, User, WorkspaceSettings } from "./types";
import { OPEN_OFFER_STATUSES, lineAmount, offerTotals } from "./offers";
import { billingRateFor, costRateFor } from "./rates";
import { entryDuration } from "./utils";

export interface Money {
  seconds: number;
  /** hours x billing rate (all hours, what the consumed effort is worth at selling price) */
  value: number;
  /** hours x cost rate */
  cost: number;
}

export interface LineBudget {
  id: string;
  offerId: ID;
  offerNumber: string;
  issueId?: ID;
  issueKey?: string;
  name: string;
  soldHours: number;
  soldAmount: number;
  consumed: Money;
  entries: number;
}

export type Health = "none" | "ok" | "warn" | "over";

export interface ProjectBudget {
  sold: { hours: number; amount: number; orders: number };
  consumed: Money;
  lines: LineBudget[];
  unattributed: Money & { entries: number };
  pipeline: { amount: number; hours: number; offers: number };
  /** Average consumed hours per week over the last 4 weeks */
  burnPerWeek: number;
  /** Estimated date when sold hours run out at the current burn rate */
  runOut?: Date;
  health: Health;
  pctHours: number;
  pctAmount: number;
}

export function healthOf(pct: number, hasBudget: boolean): Health {
  if (!hasBudget) return "none";
  if (pct > 100) return "over";
  if (pct >= 80) return "warn";
  return "ok";
}

export const HEALTH_META: Record<Health, { name: string; color: string; appearance: "default" | "success" | "moved" | "removed" }> = {
  none: { name: "No budget", color: "var(--ds-chart-gray)", appearance: "default" },
  ok: { name: "On track", color: "var(--ds-chart-green)", appearance: "success" },
  warn: { name: "At risk", color: "var(--ds-chart-yellow)", appearance: "moved" },
  over: { name: "Over budget", color: "var(--ds-chart-red)", appearance: "removed" },
};

/** Walk up the parent chain to the top-most ancestor (the epic for stories/subtasks). */
function rootIssue(issue: Issue | undefined, byId: Map<ID, Issue>): Issue | undefined {
  let cur = issue;
  let guard = 0;
  while (cur?.parentId && guard++ < 10) {
    const p = byId.get(cur.parentId);
    if (!p) break;
    cur = p;
  }
  return cur;
}

export function computeProjectBudget(args: {
  project: Project;
  offers: Offer[];
  issues: Issue[];
  entries: TimeEntry[];
  users: User[];
  projects: Project[];
  settings: WorkspaceSettings;
  now?: Date;
}): ProjectBudget {
  const { project, settings } = args;
  const now = args.now ?? new Date();
  const byId = new Map(args.issues.map((i) => [i.id, i]));
  const userMap = new Map(args.users.map((u) => [u.id, u]));
  const orders = args.offers.filter((o) => o.projectId === project.id && o.status === "ordered");
  const open = args.offers.filter((o) => o.projectId === project.id && OPEN_OFFER_STATUSES.includes(o.status));

  const lines: LineBudget[] = [];
  const lineByIssue = new Map<ID, LineBudget>();
  for (const o of orders) {
    for (const l of [...o.lines].sort((a, b) => a.order - b.order)) {
      const issue = l.issueId ? byId.get(l.issueId) : undefined;
      const lb: LineBudget = {
        id: l.id,
        offerId: o.id,
        offerNumber: o.number,
        issueId: l.issueId,
        issueKey: issue?.key,
        name: l.description || `Line ${l.order}`,
        soldHours: l.hours,
        soldAmount: lineAmount(l),
        consumed: { seconds: 0, value: 0, cost: 0 },
        entries: 0,
      };
      lines.push(lb);
      if (l.issueId) lineByIssue.set(l.issueId, lb);
    }
  }

  const consumed: Money = { seconds: 0, value: 0, cost: 0 };
  const unattributed = { seconds: 0, value: 0, cost: 0, entries: 0 };
  const projectEntries = args.entries.filter((e) => e.projectId === project.id);
  for (const e of projectEntries) {
    const secs = entryDuration(e, now);
    const h = secs / 3600;
    const u = userMap.get(e.userId);
    const value = h * billingRateFor(u, project, e.start);
    const cost = h * costRateFor(u, project, e.start);
    consumed.seconds += secs;
    consumed.value += value;
    consumed.cost += cost;
    const root = rootIssue(e.issueId ? byId.get(e.issueId) : undefined, byId);
    const lb = root ? lineByIssue.get(root.id) : undefined;
    if (lb) {
      lb.consumed.seconds += secs;
      lb.consumed.value += value;
      lb.consumed.cost += cost;
      lb.entries += 1;
    } else {
      unattributed.seconds += secs;
      unattributed.value += value;
      unattributed.cost += cost;
      unattributed.entries += 1;
    }
  }

  const soldHours = lines.reduce((a, l) => a + l.soldHours, 0);
  const soldAmount = orders.reduce((a, o) => a + offerTotals(o).total, 0);
  const consumedHours = consumed.seconds / 3600;

  // burn rate: last 4 full weeks
  const since = subWeeks(startOfDay(now), 4);
  const recent = projectEntries.filter((e) => parseISO(e.start) >= since).reduce((a, e) => a + entryDuration(e, now), 0) / 3600;
  const burnPerWeek = recent / 4;
  const remainingHours = soldHours - consumedHours;
  const runOut = burnPerWeek > 0 && remainingHours > 0 ? addDays(now, Math.round((remainingHours / burnPerWeek) * 7)) : undefined;

  const pctHours = soldHours ? Math.round((consumedHours / soldHours) * 100) : 0;
  const pctAmount = soldAmount ? Math.round((consumed.value / soldAmount) * 100) : 0;
  const pipelineHours = open.reduce((a, o) => a + offerTotals(o).hours, 0);

  void settings;
  return {
    sold: { hours: soldHours, amount: soldAmount, orders: orders.length },
    consumed,
    lines,
    unattributed,
    pipeline: { amount: open.reduce((a, o) => a + offerTotals(o).total, 0), hours: pipelineHours, offers: open.length },
    burnPerWeek,
    runOut,
    health: healthOf(project.pricing === "tm" ? pctHours : Math.max(pctHours, pctAmount), soldHours > 0 || soldAmount > 0),
    pctHours,
    pctAmount,
  };
}

export interface BurnPoint {
  id: string;
  label: string;
  consumed: number;
  planned: number | null;
  sold: number;
}

/** Weekly cumulative consumed vs planned (from offer line dates) vs sold hours */
export function burnSeries(args: { project: Project; offers: Offer[]; entries: TimeEntry[]; now?: Date }): BurnPoint[] {
  const now = args.now ?? new Date();
  const orders = args.offers.filter((o) => o.projectId === args.project.id && o.status === "ordered");
  const lines: OfferLine[] = orders.flatMap((o) => o.lines);
  const entries = args.entries.filter((e) => e.projectId === args.project.id);
  if (entries.length === 0 && lines.length === 0) return [];
  const soldHours = lines.reduce((a, l) => a + l.hours, 0);
  const dates: Date[] = [
    ...entries.map((e) => parseISO(e.start)),
    ...lines.flatMap((l) => [l.plannedStart, l.plannedEnd].filter(Boolean).map((d) => parseISO(d!))),
    now,
  ];
  const start = startOfWeek(minDate(dates), { weekStartsOn: 1 });
  const end = startOfWeek(maxDate(dates), { weekStartsOn: 1 });
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
  let cumConsumed = 0;
  return weeks.map((w) => {
    const wEnd = addDays(w, 7);
    const secs = entries.filter((e) => parseISO(e.start) >= w && parseISO(e.start) < wEnd).reduce((a, e) => a + entryDuration(e, now), 0);
    cumConsumed += secs / 3600;
    // planned: linear share of each line between its planned dates up to the end of this week
    let planned = 0;
    let anyPlanned = false;
    for (const l of lines) {
      if (!l.plannedStart || !l.plannedEnd) continue;
      anyPlanned = true;
      const ps = parseISO(l.plannedStart);
      const pe = parseISO(l.plannedEnd);
      const total = Math.max(1, differenceInCalendarDays(pe, ps) + 1);
      const elapsed = Math.min(total, Math.max(0, differenceInCalendarDays(wEnd, ps)));
      planned += (l.hours * elapsed) / total;
    }
    return {
      id: w.toISOString(),
      label: format(w, "d MMM"),
      consumed: w <= now ? Math.round(cumConsumed * 10) / 10 : (null as unknown as number),
      planned: anyPlanned ? Math.round(planned * 10) / 10 : null,
      sold: soldHours,
    };
  });
}
