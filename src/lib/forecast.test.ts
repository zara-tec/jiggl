import { describe, expect, it } from "vitest";
import { activityHours, baselineForecast, captureBaseline, compareForecasts, currentForecast, forecastMembers, formatEffort, fromUnit, lineForecast, offerForecast, rateBook, toUnit, trackedByLine, type RateBook } from "./forecast";
import { SETTINGS, makeActivity, makeBaseline, makeEntry, makeIssue, makeLine, makeOffer, makeProject, makeUser } from "@/test/fixtures";

const rates: RateBook = { cost: { u1: 50, u2: 40 }, billing: { u1: 100, u2: 100 } };

const design = makeActivity({ id: "design", effort: { u1: 10, u2: 6 } });
const build = makeActivity({ id: "build", effort: { u2: 20 }, order: 2 });
const extra = makeActivity({ id: "extra", effort: { u1: 4 }, unsold: true, order: 3 });
const lineA = makeLine({ id: "a", qty: 30, unitPrice: 100, hours: 30, activities: [design, build, extra] });
const lineB = makeLine({ id: "b", qty: 1, unit: "flat", unitPrice: 500, hours: 5, order: 2 });

describe("effort maths", () => {
  it("activityHours sums the members, ignoring empty values", () => {
    expect(activityHours(design)).toBe(16);
    expect(activityHours(makeActivity({ id: "x", effort: { u1: 0, u2: undefined as unknown as number } }))).toBe(0);
    expect(activityHours({ effort: undefined as unknown as Record<string, number> })).toBe(0);
  });

  it("forecastMembers lists the people with any effort, once", () => {
    expect(forecastMembers([lineA, lineB]).sort()).toEqual(["u1", "u2"]);
    expect(forecastMembers([makeLine({ id: "e", activities: [makeActivity({ id: "z", effort: { u9: 0 } })] })])).toEqual([]);
  });

  it("lineForecast values the hours with the rate book and keeps unsold work apart", () => {
    const f = lineForecast(lineA, rates);
    expect(f.hours).toBe(40);
    expect(f.unsoldHours).toBe(4);
    expect(f.cost).toBe(10 * 50 + 26 * 40 + 4 * 50);
    expect(f.unsoldCost).toBe(200);
    // billing counts the sold activities only
    expect(f.billing).toBe((10 + 26) * 100);
    expect(f.byUser).toEqual({ u1: 14, u2: 26 });
    expect(f.soldHours).toBe(30);
    expect(f.soldAmount).toBe(3000);
    expect(lineForecast(lineB, rates)).toMatchObject({ hours: 0, cost: 0, byUser: {}, soldHours: 5, soldAmount: 500 });
  });

  it("offerForecast applies the discount to the sold amount and computes the expected margin", () => {
    const f = offerForecast({ lines: [lineB, lineA], discountPct: 10 }, rates, "fixed");
    expect(f.lines.map((l) => l.lineId)).toEqual(["a", "b"]);
    expect(f.hours).toBe(40);
    expect(f.soldHours).toBe(35);
    expect(f.soldAmount).toBe(3150);
    expect(f.cost).toBe(1740);
    expect(f.revenue).toBe(3150);
    expect(f.margin).toBe(1410);
    expect(f.marginPct).toBe(45);
    expect(f.byUser.u1).toEqual({ hours: 14, unsoldHours: 4, cost: 700, billing: 1000 });
    expect(f.byUser.u2).toEqual({ hours: 26, unsoldHours: 0, cost: 1040, billing: 2600 });
  });

  it("a time & material offer expects the billing of the sold hours as revenue", () => {
    const f = offerForecast({ lines: [lineA] }, rates, "tm");
    expect(f.revenue).toBe(3600);
    expect(f.margin).toBe(3600 - 1740);
    expect(offerForecast({ lines: [] }, rates, "tm")).toMatchObject({ hours: 0, revenue: 0, margin: 0, marginPct: 0, byUser: {}, lines: [] });
  });
});

describe("rate book", () => {
  const users = [makeUser({ id: "u1", costRates: [{ from: "2024-01-01", rate: 50 }, { from: "2026-07-01", rate: 60 }] }), makeUser({ id: "u2", costRates: [{ from: "2024-01-01", rate: 40 }] })];
  const project = makeProject({ billingRates: [{ from: "2024-01-01", rate: 100 }], memberRates: { u2: { cost: [{ from: "2024-01-01", rate: 45 }], billing: [{ from: "2024-01-01", rate: 120 }] } } });

  it("resolves the rates in force on a date with the project overrides", () => {
    expect(rateBook(users, project, "2026-03-01")).toEqual({ cost: { u1: 50, u2: 45 }, billing: { u1: 100, u2: 120 } });
    expect(rateBook(users, project, "2026-08-01").cost.u1).toBe(60);
    expect(rateBook(users, undefined, "2026-03-01")).toEqual({ cost: { u1: 50, u2: 40 }, billing: { u1: 0, u2: 0 } });
  });

  it("currentForecast uses today's rates and the project pricing", () => {
    const offer = makeOffer({ id: "o", lines: [lineA] });
    expect(currentForecast(offer, users, project, "2026-08-01").cost).toBe(10 * 60 + 26 * 45 + 4 * 60);
    expect(currentForecast(offer, users, { ...project, pricing: "tm" }, "2026-03-01").revenue).toBe(10 * 100 + 26 * 120);
  });
});

describe("baselines", () => {
  const users = [makeUser({ id: "u1", costRates: [{ from: "2024-01-01", rate: 50 }, { from: "2026-07-01", rate: 60 }] }), makeUser({ id: "u2", costRates: [{ from: "2024-01-01", rate: 40 }] })];
  const project = makeProject();
  const offer = makeOffer({ id: "o", discountPct: 5, lines: [lineA, lineB] });

  it("captureBaseline freezes the lines, activities and the rates of that moment", () => {
    const b = captureBaseline(offer, { users, project, name: "Order", kind: "order", createdBy: "u1", now: "2026-03-10T10:00:00.000Z" });
    expect(b).toMatchObject({ offerId: "o", projectId: "p1", name: "Order", kind: "order", createdBy: "u1", createdAt: "2026-03-10T10:00:00.000Z", discountPct: 5 });
    expect(b.costRates).toEqual({ u1: 50, u2: 40 });
    expect(b.billingRates).toEqual({ u1: 100, u2: 100 });
    expect(b.lines).toEqual(offer.lines);
    // a deep copy: editing the live offer later must not touch the snapshot
    expect(b.lines[0]).not.toBe(offer.lines[0]);
    expect(b.lines[0].activities![0]).not.toBe(offer.lines[0].activities![0]);
    expect(b.lines[0].activities![0].effort).not.toBe(offer.lines[0].activities![0].effort);
    expect(b.lines[1].activities).toBeUndefined();
  });

  it("baselineForecast values the snapshot with its own rates, whatever the rates are now", () => {
    const b = makeBaseline({ id: "b", lines: [lineA], costRates: { u1: 30, u2: 30 }, billingRates: { u1: 90, u2: 90 } });
    const f = baselineForecast(b, "fixed");
    expect(f.hours).toBe(40);
    expect(f.cost).toBe(40 * 30);
    expect(f.billing).toBe(36 * 90);
    expect(baselineForecast(makeBaseline({ id: "empty" })).hours).toBe(0);
  });

  it("compareForecasts reports moved effort, cost drift, unsold work and added or removed lines", () => {
    const before = offerForecast({ lines: [makeLine({ id: "a", hours: 30, qty: 30, unitPrice: 100, activities: [makeActivity({ id: "d", effort: { u1: 10, u2: 26 } })] }), makeLine({ id: "gone", order: 2, hours: 8, qty: 8, unitPrice: 100 })] }, { cost: { u1: 50, u2: 40 }, billing: { u1: 100, u2: 100 } });
    const after = offerForecast({ lines: [lineA, makeLine({ id: "new", order: 3, hours: 0, qty: 0, unitPrice: 0, activities: [makeActivity({ id: "n", effort: { u1: 5 } })] })] }, { cost: { u1: 55, u2: 40 }, billing: { u1: 100, u2: 100 } });
    const d = compareForecasts(before, after);
    expect(d.lines.map((l) => [l.lineId, l.status])).toEqual([
      ["a", "changed"],
      ["gone", "removed"],
      ["new", "added"],
    ]);
    const a = d.lines[0];
    expect(a.hours).toBe(4);
    expect(a.cost).toBe(10 * 55 + 26 * 40 + 4 * 55 - (10 * 50 + 26 * 40));
    expect(a.soldHours).toBe(0);
    expect(d.lines[1]).toMatchObject({ hours: 0, soldHours: -8, soldAmount: -800, after: undefined });
    expect(d.lines[2]).toMatchObject({ hours: 5, before: undefined });
    expect(d.members.find((m) => m.userId === "u1")).toMatchObject({ hours: 9, cost: 19 * 55 - 10 * 50 });
    expect(d.members.find((m) => m.userId === "u2")).toMatchObject({ hours: 0, cost: 0 });
    expect(d.hours).toBe(9);
    expect(d.unsoldHours).toBe(4);
    expect(d.revenue).toBe(3000 - 3800);
    expect(d.margin).toBe(after.margin - before.margin);
  });

  it("a line whose members changed at equal hours and cost is still reported as changed", () => {
    const line = (effort: Record<string, number>) => makeLine({ id: "a", hours: 10, activities: [makeActivity({ id: "x", effort })] });
    const same: RateBook = { cost: { u1: 50, u2: 50 }, billing: { u1: 0, u2: 0 } };
    const d = compareForecasts(offerForecast({ lines: [line({ u1: 10 })] }, same), offerForecast({ lines: [line({ u2: 10 })] }, same));
    expect(d.lines[0].status).toBe("changed");
    expect(d.hours).toBe(0);
    expect(compareForecasts(offerForecast({ lines: [line({ u1: 10 })] }, same), offerForecast({ lines: [line({ u1: 10 })] }, same)).lines[0].status).toBe("same");
  });
});

describe("trackedByLine", () => {
  const epic = makeIssue({ id: "e1", type: "epic" });
  const story = makeIssue({ id: "s1", parentId: "e1" });
  const sub = makeIssue({ id: "t1", parentId: "s1" });
  const loose = makeIssue({ id: "x1" });
  const offer = makeOffer({ id: "o", lines: [makeLine({ id: "a", issueId: "e1" }), makeLine({ id: "b", order: 2 })] });
  const now = new Date("2026-03-16T12:00:00.000Z");

  it("adds up the tracked seconds per member on the line's work item and its descendants", () => {
    const entries = [
      makeEntry({ id: "1", start: "2026-03-10T09:00:00.000Z", hours: 2, issueId: "e1", userId: "u1" }),
      makeEntry({ id: "2", start: "2026-03-10T09:00:00.000Z", hours: 1, issueId: "s1", userId: "u2" }),
      makeEntry({ id: "3", start: "2026-03-10T09:00:00.000Z", hours: 0.5, issueId: "t1", userId: "u1" }),
      makeEntry({ id: "4", start: "2026-03-10T09:00:00.000Z", hours: 3, issueId: "x1", userId: "u1" }),
      makeEntry({ id: "5", start: "2026-03-10T09:00:00.000Z", hours: 3, userId: "u1" }),
      makeEntry({ id: "6", start: "2026-03-10T09:00:00.000Z", hours: 3, issueId: "e1", userId: "u1", projectId: "other" }),
    ];
    expect(trackedByLine(offer, [epic, story, sub, loose], entries, now)).toEqual({ a: { u1: 2.5 * 3600, u2: 3600 } });
    expect(trackedByLine(makeOffer({ id: "none" }), [epic], entries, now)).toEqual({});
  });
});

describe("units", () => {
  it("converts hours to the display unit and back", () => {
    expect(toUnit(12, "hours", SETTINGS)).toBe(12);
    expect(toUnit(12, "days", SETTINGS)).toBe(1.5);
    expect(fromUnit(1.5, "days", SETTINGS)).toBe(12);
    expect(fromUnit(3, "hours", { hoursPerDay: 0 })).toBe(3);
    expect(toUnit(16, "days", { hoursPerDay: 0 })).toBe(2);
  });

  it("formatEffort is compact and can be signed", () => {
    expect(formatEffort(12, "hours", SETTINGS)).toBe("12h");
    expect(formatEffort(12, "days", SETTINGS)).toBe("1.5d");
    expect(formatEffort(0, "hours", SETTINGS)).toBe("");
    expect(formatEffort(0, "hours", SETTINGS, { zero: "—" })).toBe("—");
    expect(formatEffort(4, "hours", SETTINGS, { signed: true })).toBe("+4h");
    expect(formatEffort(-4, "hours", SETTINGS, { signed: true })).toBe("-4h");
    expect(formatEffort(1.234, "hours", SETTINGS)).toBe("1.2h");
  });
});
