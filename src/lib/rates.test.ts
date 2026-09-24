import { describe, expect, it } from "vitest";
import { EPOCH, applyRate, billingRateFor, costRateFor, formatDays, formatMoney, marginPct, rateAt, valueEntries } from "./rates";
import { makeEntry, makeProject, makeUser } from "@/test/fixtures";

const periods = [
  { from: "2024-01-01", rate: 50 },
  { from: "2026-07-01", rate: 55 },
];

describe("rateAt", () => {
  it("is undefined without periods or before the first one", () => {
    expect(rateAt(undefined, "2026-01-01")).toBeUndefined();
    expect(rateAt([], "2026-01-01")).toBeUndefined();
    expect(rateAt(periods, "2023-12-31")).toBeUndefined();
  });

  it("picks the latest period starting on or before the date", () => {
    expect(rateAt(periods, "2024-01-01")).toBe(50);
    expect(rateAt(periods, "2026-06-30")).toBe(50);
    expect(rateAt(periods, "2026-07-01")).toBe(55);
    expect(rateAt(periods, "2027-01-01")).toBe(55);
  });

  it("accepts full ISO date-times and any period order", () => {
    expect(rateAt(periods, "2026-07-01T09:00:00+02:00")).toBe(55);
    expect(rateAt([...periods].reverse(), "2026-08-01")).toBe(55);
  });
});

describe("applyRate", () => {
  it("rewrites the whole history from the epoch", () => {
    expect(applyRate(periods, 60, EPOCH)).toEqual([{ from: EPOCH, rate: 60 }]);
  });

  it("replaces periods starting on or after the date and keeps earlier ones", () => {
    expect(applyRate(periods, 60, "2026-07-01")).toEqual([
      { from: "2024-01-01", rate: 50 },
      { from: "2026-07-01", rate: 60 },
    ]);
    expect(applyRate(periods, 60, "2025-01-01")).toEqual([
      { from: "2024-01-01", rate: 50 },
      { from: "2025-01-01", rate: 60 },
    ]);
  });

  it("starts a history from nothing", () => {
    expect(applyRate(undefined, 40, "2026-01-01")).toEqual([{ from: "2026-01-01", rate: 40 }]);
  });
});

describe("rate resolution", () => {
  const user = makeUser(); // cost 50 since 2024
  const project = makeProject({
    billingRates: [{ from: "2024-01-01", rate: 100 }],
    memberRates: { u1: { cost: [{ from: "2025-01-01", rate: 70 }], billing: [{ from: "2025-01-01", rate: 120 }] } },
  });

  it("uses the project override when it is in force, the default otherwise", () => {
    expect(costRateFor(user, project, "2024-06-01")).toBe(50);
    expect(costRateFor(user, project, "2025-06-01")).toBe(70);
    expect(billingRateFor(user, project, "2024-06-01")).toBe(100);
    expect(billingRateFor(user, project, "2025-06-01")).toBe(120);
  });

  it("falls back to 0 without a user or project", () => {
    expect(costRateFor(undefined, project, "2025-06-01")).toBe(0);
    expect(billingRateFor(user, undefined, "2025-06-01")).toBe(0);
    expect(billingRateFor(user, makeProject({ billingRates: [] }), "2025-06-01")).toBe(0);
  });
});

describe("valueEntries", () => {
  const users = [makeUser()];
  const projects = [makeProject({ memberRates: { u1: { cost: [{ from: "2025-01-01", rate: 70 }], billing: [{ from: "2025-01-01", rate: 120 }] } } })];

  it("sums seconds, cost on all hours and revenue on billable hours", () => {
    const entries = [
      makeEntry({ id: "a", start: "2025-06-01T09:00:00.000Z", hours: 2, billable: true }),
      makeEntry({ id: "b", start: "2025-06-01T12:00:00.000Z", hours: 1, billable: false }),
    ];
    expect(valueEntries(entries, users, projects)).toEqual({ seconds: 10800, billableSeconds: 7200, cost: 210, revenue: 240 });
  });

  it("values a running entry up to `now`", () => {
    const entries = [makeEntry({ id: "r", start: "2025-06-01T10:00:00.000Z" })];
    const v = valueEntries(entries, users, projects, new Date("2025-06-01T10:30:00.000Z"));
    expect(v.seconds).toBe(1800);
    expect(v.revenue).toBeCloseTo(60);
  });
});

describe("formatting", () => {
  it("marginPct", () => {
    expect(marginPct(240, 210)).toBe(13);
    expect(marginPct(0, 10)).toBe(0);
    expect(marginPct(100, 150)).toBe(-50);
  });

  it("formatDays", () => {
    expect(formatDays(8 * 3600, { hoursPerDay: 8 })).toBe("1 d");
    expect(formatDays(12 * 3600, { hoursPerDay: 8 })).toBe("1.5 d");
    expect(formatDays(4 * 3600, { hoursPerDay: 0 })).toBe("0.5 d");
  });

  it("formatMoney", () => {
    expect(formatMoney(1234.5)).toBe("€1,235");
    expect(formatMoney(99.99, "USD", 2)).toBe("US$99.99");
  });
});
