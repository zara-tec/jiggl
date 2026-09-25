import type { ForecastActivity, ID, Issue, Offer, OfferBaseline, OfferLine, Pricing, Project, TimeEntry, User, WorkspaceSettings } from "./types";
import { lineAmount } from "./offers";
import { billingRateFor, costRateFor, today } from "./rates";
import { entryDuration } from "./utils";

/**
 * Forecast: who will work on each offer line, for how long, and what that
 * costs. Effort lives in the activities of a line (userId -> hours); this
 * module values it with a rate book and compares it with the sold side and
 * with frozen baselines.
 */

/** Rates per member used to value a forecast (cost and billing per hour) */
export interface RateBook {
  cost: Record<ID, number>;
  billing: Record<ID, number>;
}

/** Rates in force on a date for every member, with the project overrides applied */
export function rateBook(users: User[], project: Project | undefined, dateIso: string = today()): RateBook {
  const cost: Record<ID, number> = {};
  const billing: Record<ID, number> = {};
  for (const u of users) {
    cost[u.id] = costRateFor(u, project, dateIso);
    billing[u.id] = billingRateFor(u, project, dateIso);
  }
  return { cost, billing };
}

/** The rate book frozen inside a baseline */
export function baselineRates(b: OfferBaseline): RateBook {
  return { cost: b.costRates ?? {}, billing: b.billingRates ?? {} };
}

export function activityHours(a: Pick<ForecastActivity, "effort">) {
  return Object.values(a.effort ?? {}).reduce((s, h) => s + (h || 0), 0);
}

export function lineActivities(line: OfferLine): ForecastActivity[] {
  return [...(line.activities ?? [])].sort((a, b) => a.order - b.order);
}

/** Members with any forecast effort in these lines */
export function forecastMembers(lines: OfferLine[]): ID[] {
  const ids = new Set<ID>();
  for (const l of lines) for (const a of l.activities ?? []) for (const [uid, h] of Object.entries(a.effort ?? {})) if (h) ids.add(uid);
  return [...ids];
}

export interface MemberEffort {
  hours: number;
  unsoldHours: number;
  cost: number;
  /** sold hours x billing rate */
  billing: number;
}

export interface LineForecast {
  lineId: ID;
  name: string;
  order: number;
  hours: number;
  unsoldHours: number;
  cost: number;
  unsoldCost: number;
  billing: number;
  soldHours: number;
  soldAmount: number;
  /** forecast hours per member */
  byUser: Record<ID, number>;
}

export interface OfferForecast {
  hours: number;
  unsoldHours: number;
  cost: number;
  unsoldCost: number;
  /** sold hours x member billing rates: the revenue a T&M order would produce */
  billing: number;
  soldHours: number;
  /** after discount */
  soldAmount: number;
  /** fixed price: sold amount; T&M: billing */
  revenue: number;
  margin: number;
  marginPct: number;
  byUser: Record<ID, MemberEffort>;
  lines: LineForecast[];
}

const blank = (): MemberEffort => ({ hours: 0, unsoldHours: 0, cost: 0, billing: 0 });

export function lineForecast(line: OfferLine, rates: RateBook): LineForecast {
  const out: LineForecast = { lineId: line.id, name: line.description || `Line ${line.order}`, order: line.order, hours: 0, unsoldHours: 0, cost: 0, unsoldCost: 0, billing: 0, soldHours: line.hours || 0, soldAmount: lineAmount(line), byUser: {} };
  for (const a of line.activities ?? []) {
    for (const [uid, raw] of Object.entries(a.effort ?? {})) {
      const h = raw || 0;
      if (!h) continue;
      const cost = h * (rates.cost[uid] ?? 0);
      out.hours += h;
      out.cost += cost;
      out.byUser[uid] = (out.byUser[uid] ?? 0) + h;
      if (a.unsold) {
        out.unsoldHours += h;
        out.unsoldCost += cost;
      } else {
        out.billing += h * (rates.billing[uid] ?? 0);
      }
    }
  }
  return out;
}

export interface ForecastSource {
  lines: OfferLine[];
  discountPct?: number;
}

/** Value the forecast of an offer (or of a baseline) with a rate book */
export function offerForecast(source: ForecastSource, rates: RateBook, pricing: Pricing = "fixed"): OfferForecast {
  const lines = [...source.lines].sort((a, b) => a.order - b.order).map((l) => lineForecast(l, rates));
  const byUser: Record<ID, MemberEffort> = {};
  for (const l of source.lines) {
    for (const a of l.activities ?? []) {
      for (const [uid, raw] of Object.entries(a.effort ?? {})) {
        const h = raw || 0;
        if (!h) continue;
        const m = (byUser[uid] ??= blank());
        m.hours += h;
        m.cost += h * (rates.cost[uid] ?? 0);
        if (a.unsold) m.unsoldHours += h;
        else m.billing += h * (rates.billing[uid] ?? 0);
      }
    }
  }
  const subtotal = lines.reduce((s, l) => s + l.soldAmount, 0);
  const soldAmount = subtotal - subtotal * ((source.discountPct ?? 0) / 100);
  const hours = lines.reduce((s, l) => s + l.hours, 0);
  const cost = lines.reduce((s, l) => s + l.cost, 0);
  const billing = lines.reduce((s, l) => s + l.billing, 0);
  const revenue = pricing === "tm" ? billing : soldAmount;
  const margin = revenue - cost;
  return {
    hours,
    unsoldHours: lines.reduce((s, l) => s + l.unsoldHours, 0),
    cost,
    unsoldCost: lines.reduce((s, l) => s + l.unsoldCost, 0),
    billing,
    soldHours: lines.reduce((s, l) => s + l.soldHours, 0),
    soldAmount,
    revenue,
    margin,
    marginPct: revenue ? Math.round((margin / revenue) * 100) : 0,
    byUser,
    lines,
  };
}

/** Forecast of the live offer at today's rates */
export function currentForecast(offer: Offer, users: User[], project: Project | undefined, dateIso: string = today()): OfferForecast {
  return offerForecast(offer, rateBook(users, project, dateIso), project?.pricing);
}

/** Forecast frozen in a baseline, valued with the rates of that moment */
export function baselineForecast(b: OfferBaseline, pricing: Pricing = "fixed"): OfferForecast {
  return offerForecast(b, baselineRates(b), pricing);
}

/** Deep copy of the lines for a snapshot (activities included) */
function cloneLines(lines: OfferLine[]): OfferLine[] {
  return lines.map((l) => (l.activities ? { ...l, activities: l.activities.map((a) => ({ ...a, effort: { ...(a.effort ?? {}) } })) } : { ...l }));
}

/** Everything a baseline stores, except its id */
export function captureBaseline(
  offer: Offer,
  args: { users: User[]; project: Project | undefined; name: string; kind: OfferBaseline["kind"]; note?: string; createdBy: ID; now: string },
): Omit<OfferBaseline, "id"> {
  const rates = rateBook(args.users, args.project, args.now.slice(0, 10));
  return {
    offerId: offer.id,
    projectId: offer.projectId,
    name: args.name,
    note: args.note,
    kind: args.kind,
    createdAt: args.now,
    createdBy: args.createdBy,
    discountPct: offer.discountPct,
    lines: cloneLines(offer.lines),
    costRates: rates.cost,
    billingRates: rates.billing,
  };
}

/* ---------------- Comparison with a baseline ---------------- */

export type DeltaStatus = "same" | "changed" | "added" | "removed";

export interface LineDelta {
  lineId: ID;
  name: string;
  status: DeltaStatus;
  before?: LineForecast;
  after?: LineForecast;
  hours: number;
  cost: number;
  soldHours: number;
  soldAmount: number;
}

export interface MemberDelta {
  userId: ID;
  before?: MemberEffort;
  after?: MemberEffort;
  hours: number;
  cost: number;
}

export interface ForecastDelta {
  before: OfferForecast;
  after: OfferForecast;
  lines: LineDelta[];
  members: MemberDelta[];
  hours: number;
  cost: number;
  revenue: number;
  margin: number;
  unsoldHours: number;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

export function compareForecasts(before: OfferForecast, after: OfferForecast): ForecastDelta {
  const ids = [...new Set([...before.lines.map((l) => l.lineId), ...after.lines.map((l) => l.lineId)])];
  const lines: LineDelta[] = ids.map((id) => {
    const b = before.lines.find((l) => l.lineId === id);
    const a = after.lines.find((l) => l.lineId === id);
    const hours = (a?.hours ?? 0) - (b?.hours ?? 0);
    const cost = (a?.cost ?? 0) - (b?.cost ?? 0);
    const soldHours = (a?.soldHours ?? 0) - (b?.soldHours ?? 0);
    const soldAmount = (a?.soldAmount ?? 0) - (b?.soldAmount ?? 0);
    const usersChanged = b && a && [...new Set([...Object.keys(b.byUser), ...Object.keys(a.byUser)])].some((u) => !near(b.byUser[u] ?? 0, a.byUser[u] ?? 0));
    const status: DeltaStatus = !b ? "added" : !a ? "removed" : near(hours, 0) && near(cost, 0) && near(soldHours, 0) && near(soldAmount, 0) && !usersChanged ? "same" : "changed";
    return { lineId: id, name: (a ?? b)!.name, status, before: b, after: a, hours, cost, soldHours, soldAmount };
  });
  const memberIds = [...new Set([...Object.keys(before.byUser), ...Object.keys(after.byUser)])];
  const members: MemberDelta[] = memberIds.map((userId) => {
    const b = before.byUser[userId];
    const a = after.byUser[userId];
    return { userId, before: b, after: a, hours: (a?.hours ?? 0) - (b?.hours ?? 0), cost: (a?.cost ?? 0) - (b?.cost ?? 0) };
  });
  const order = (l: LineDelta) => (l.after ?? l.before)!.order;
  lines.sort((x, y) => order(x) - order(y));
  return {
    before,
    after,
    lines,
    members,
    hours: after.hours - before.hours,
    cost: after.cost - before.cost,
    revenue: after.revenue - before.revenue,
    margin: after.margin - before.margin,
    unsoldHours: after.unsoldHours - before.unsoldHours,
  };
}

/* ---------------- Tracked time against the forecast ---------------- */

/** Tracked seconds per member on each line's work item and its descendants (lineId -> userId -> seconds) */
export function trackedByLine(offer: Offer, issues: Issue[], entries: TimeEntry[], now: Date = new Date()): Record<ID, Record<ID, number>> {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const lineOfIssue = new Map<ID, ID>();
  for (const l of offer.lines) if (l.issueId) lineOfIssue.set(l.issueId, l.id);
  const out: Record<ID, Record<ID, number>> = {};
  if (lineOfIssue.size === 0) return out;
  for (const e of entries) {
    if (!e.issueId || e.projectId !== offer.projectId) continue;
    let cur = byId.get(e.issueId);
    let guard = 0;
    let lineId: ID | undefined;
    while (cur && guard++ < 10) {
      lineId = lineOfIssue.get(cur.id);
      if (lineId) break;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    if (!lineId) continue;
    const line = (out[lineId] ??= {});
    line[e.userId] = (line[e.userId] ?? 0) + entryDuration(e, now);
  }
  return out;
}

/* ---------------- Units ---------------- */

export type EffortUnit = "hours" | "days";

export function toUnit(hours: number, unit: EffortUnit, settings: Pick<WorkspaceSettings, "hoursPerDay">) {
  return unit === "days" ? hours / (settings.hoursPerDay || 8) : hours;
}

export function fromUnit(value: number, unit: EffortUnit, settings: Pick<WorkspaceSettings, "hoursPerDay">) {
  return unit === "days" ? value * (settings.hoursPerDay || 8) : value;
}

/** "12h", "1.5d"; empty string for zero */
export function formatEffort(hours: number, unit: EffortUnit, settings: Pick<WorkspaceSettings, "hoursPerDay">, opts?: { zero?: string; signed?: boolean }) {
  if (!hours) return opts?.zero ?? "";
  const v = toUnit(hours, unit, settings);
  const n = Math.round(v * 10) / 10;
  const sign = opts?.signed && n > 0 ? "+" : "";
  return `${sign}${Number.isInteger(n) ? n : n.toFixed(1)}${unit === "days" ? "d" : "h"}`;
}
