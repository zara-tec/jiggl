import { addDays, subDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { burnSeries, computeProjectBudget, healthOf } from "./budget";
import { SETTINGS, makeActivity, makeBaseline, makeEntry, makeIssue, makeLine, makeOffer, makeProject, makeUser } from "@/test/fixtures";

const now = new Date("2026-03-16T12:00:00.000Z"); // a Monday
const daysAgo = (n: number) => subDays(now, n).toISOString();

const users = [makeUser()]; // cost 50/h
const project = makeProject(); // fixed price, billing 100/h
const issues = [
  makeIssue({ id: "e1", key: "P-1", type: "epic" }),
  makeIssue({ id: "s1", key: "P-2", type: "story", parentId: "e1" }),
  makeIssue({ id: "st1", key: "P-3", type: "subtask", parentId: "s1" }),
  makeIssue({ id: "e2", key: "P-4", type: "epic" }),
  makeIssue({ id: "t9", key: "P-5" }),
];
const order = makeOffer({
  id: "o1",
  number: "P-O1",
  status: "ordered",
  lines: [
    makeLine({ id: "l1", description: "Time tracking", qty: 10, unitPrice: 100, hours: 10, issueId: "e1", order: 1, plannedStart: "2026-02-02", plannedEnd: "2026-02-13" }),
    makeLine({ id: "l2", description: "Boards", qty: 2, unit: "days", unitPrice: 800, hours: 16, issueId: "e2", order: 2 }),
  ],
});
const offers = [
  order,
  makeOffer({ id: "o2", status: "sent", lines: [makeLine({ id: "l3", qty: 5, unitPrice: 100, hours: 5 })] }),
  makeOffer({ id: "o3", status: "rejected", lines: [makeLine({ id: "l4", qty: 99, unitPrice: 999, hours: 99 })] }),
  makeOffer({ id: "o4", projectId: "p2", status: "ordered", lines: [makeLine({ id: "l5", qty: 99, unitPrice: 999, hours: 99 })] }),
];
const entries = [
  makeEntry({ id: "a", start: daysAgo(1), hours: 2, issueId: "st1" }), // subtask -> story -> epic e1
  makeEntry({ id: "b", start: daysAgo(2), hours: 3, issueId: "e1" }),
  makeEntry({ id: "c", start: daysAgo(3), hours: 1, issueId: "t9" }), // not sold
  makeEntry({ id: "d", start: daysAgo(4), hours: 1 }), // no work item
  makeEntry({ id: "e", start: daysAgo(5), hours: 4, issueId: "e2" }),
  makeEntry({ id: "f", start: daysAgo(40), hours: 8, issueId: "e1" }), // outside the burn window
  makeEntry({ id: "g", start: daysAgo(1), hours: 5, projectId: "p2" }), // another project
];

const compute = (p = project) => computeProjectBudget({ project: p, offers, issues, entries, users, projects: [p], settings: SETTINGS, now });

describe("healthOf", () => {
  it.each([
    [50, true, "ok"],
    [79, true, "ok"],
    [80, true, "warn"],
    [100, true, "warn"],
    [101, true, "over"],
    [0, false, "none"],
    [500, false, "none"],
  ])("%i%% with budget=%s is %s", (pctValue, hasBudget, health) => {
    expect(healthOf(pctValue, hasBudget)).toBe(health);
  });
});

describe("computeProjectBudget", () => {
  const budget = compute();

  it("sums what was sold from orders only", () => {
    expect(budget.sold).toEqual({ hours: 26, amount: 2600, orders: 1 });
    expect(budget.pipeline).toEqual({ amount: 500, hours: 5, offers: 1 });
  });

  it("values consumed hours at billing and cost rates", () => {
    expect(budget.consumed).toEqual({ seconds: 19 * 3600, value: 1900, cost: 950 });
  });

  it("attributes hours to the order line through the parent chain", () => {
    expect(budget.lines.map((l) => l.id)).toEqual(["l1", "l2"]);
    const [l1, l2] = budget.lines;
    expect(l1).toMatchObject({ offerNumber: "P-O1", issueKey: "P-1", name: "Time tracking", soldHours: 10, soldAmount: 1000, entries: 3 });
    expect(l1.consumed).toEqual({ seconds: 13 * 3600, value: 1300, cost: 650 });
    expect(l2).toMatchObject({ issueKey: "P-4", soldHours: 16, soldAmount: 1600, entries: 1 });
    expect(l2.consumed.seconds).toBe(4 * 3600);
  });

  it("keeps hours outside any line as unattributed", () => {
    expect(budget.unattributed).toEqual({ seconds: 2 * 3600, value: 200, cost: 100, entries: 2 });
  });

  it("computes progress, burn rate and run-out", () => {
    expect(budget.pctHours).toBe(73);
    expect(budget.pctAmount).toBe(73);
    expect(budget.health).toBe("ok");
    expect(budget.burnPerWeek).toBeCloseTo(11 / 4);
    // 7 hours left at 2.75 h/week -> 17.8 days, rounded
    expect(budget.runOut).toEqual(addDays(now, 18));
  });

  it("health follows amount for fixed price and hours for time & material", () => {
    const pricey = { billingRates: [{ from: "2024-01-01", rate: 200 }] };
    expect(compute(makeProject({ pricing: "fixed", ...pricey })).health).toBe("over");
    expect(compute(makeProject({ pricing: "tm", ...pricey })).health).toBe("ok");
  });

  it("has no budget without orders and no run-out without recent activity", () => {
    const empty = computeProjectBudget({ project, offers: [], issues, entries: [], users, projects: [project], settings: SETTINGS, now });
    expect(empty.health).toBe("none");
    expect(empty.lines).toEqual([]);
    expect(empty.pctHours).toBe(0);
    expect(empty.burnPerWeek).toBe(0);
    expect(empty.runOut).toBeUndefined();

    const stale = computeProjectBudget({ project, offers, issues, entries: entries.filter((e) => e.id === "f"), users, projects: [project], settings: SETTINGS, now });
    expect(stale.burnPerWeek).toBe(0);
    expect(stale.runOut).toBeUndefined();
  });
});

describe("burnSeries", () => {
  it("is empty without entries and lines", () => {
    expect(burnSeries({ project, offers: [], entries: [], now })).toEqual([]);
  });

  it("builds one point per week from the earliest date to now", () => {
    const series = burnSeries({ project, offers, entries, now });
    expect(series).toHaveLength(7);
    expect(series.map((p) => p.label)).toEqual(["2 Feb", "9 Feb", "16 Feb", "23 Feb", "2 Mar", "9 Mar", "16 Mar"]);
    expect(new Set(series.map((p) => p.id)).size).toBe(7);
    for (const p of series) expect(p.sold).toBe(26);
  });

  it("accumulates consumed hours and ramps planned hours linearly", () => {
    const series = burnSeries({ project, offers, entries, now });
    expect(series[0].consumed).toBe(8);
    expect(series[series.length - 1].consumed).toBe(19);
    const consumed = series.map((p) => p.consumed);
    for (let i = 1; i < consumed.length; i++) expect(consumed[i]).toBeGreaterThanOrEqual(consumed[i - 1]);
    // l1 is planned 2 Feb -> 13 Feb (12 days): 7/12 of 10 h after the first week, all of it later on
    expect(series[0].planned).toBe(5.8);
    expect(series[series.length - 1].planned).toBe(10);
  });

  it("has no planned line when no order line has dates", () => {
    const undated = makeOffer({ id: "u", status: "ordered", lines: [makeLine({ id: "x", hours: 8 })] });
    const series = burnSeries({ project, offers: [undated], entries: entries.slice(0, 1), now });
    for (const p of series) expect(p.planned).toBeNull();
  });
});

describe("forecast at completion", () => {
  const planned = makeOffer({
    id: "of",
    status: "ordered",
    lines: [makeLine({ id: "lf", qty: 10, unitPrice: 100, hours: 10, activities: [makeActivity({ id: "a", effort: { u1: 12 } }), makeActivity({ id: "x", effort: { u1: 2 }, unsold: true, order: 2 })] })],
  });
  const atOrder = makeBaseline({ id: "b", offerId: "of", kind: "order", lines: [makeLine({ id: "lf", qty: 10, unitPrice: 100, hours: 10, activities: [makeActivity({ id: "a", effort: { u1: 10 } })] })], costRates: { u1: 40 }, billingRates: { u1: 100 } });

  it("values the orders' forecast at the rates in force and remembers the plan frozen at order", () => {
    const b = computeProjectBudget({ project, offers: [planned], issues: [], entries: [], users, projects: [project], settings: SETTINGS, baselines: [atOrder], now });
    expect(b.forecast).toEqual({ hours: 14, cost: 700, unsoldHours: 2, unsoldCost: 100, revenue: 1000, margin: 300, atOrder: { hours: 10, cost: 400, margin: 600 } });
  });

  it("has no order reference when one of the orders lacks its baseline, and ignores open offers", () => {
    const b = computeProjectBudget({ project, offers: [planned, ...offers], issues, entries: [], users, projects: [project], settings: SETTINGS, baselines: [atOrder], now });
    expect(b.forecast.atOrder).toBeUndefined();
    expect(b.forecast.hours).toBe(14);
    expect(computeProjectBudget({ project, offers, issues, entries: [], users, projects: [project], settings: SETTINGS, now }).forecast).toEqual({ hours: 0, cost: 0, unsoldHours: 0, unsoldCost: 0, revenue: 2600, margin: 2600 });
  });
});
