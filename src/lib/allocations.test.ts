import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import { allocatedPercent, allocationActive, buildAllocationEntries, earliestAllocation, isOff, isWorkingDay, VIRTUAL_PREFIX } from "./allocations";
import { entryDuration } from "./utils";
import { SETTINGS, makeAllocation, makeEntry, makeProject } from "@/test/fixtures";

// Monday 2 March 2026 -> Sunday 8 March 2026, local time
const week = { from: new Date(2026, 2, 2), to: new Date(2026, 2, 8) };
const a1 = makeAllocation({ id: "a1", percent: 50 });
const base = { ...week, allocations: [a1], projects: [makeProject()], settings: SETTINGS, holidays: [], timeOffs: [], realEntries: [] };

describe("calendar helpers", () => {
  it("isWorkingDay honours work days and holidays", () => {
    expect(isWorkingDay(new Date(2026, 2, 2), SETTINGS, [])).toBe(true);
    expect(isWorkingDay(new Date(2026, 2, 7), SETTINGS, [])).toBe(false); // Saturday
    expect(isWorkingDay(new Date(2026, 2, 2), SETTINGS, [{ id: "h", date: "2026-03-02", name: "Holiday" }])).toBe(false);
  });

  it("isOff is inclusive of both ends", () => {
    const offs = [{ id: "t", userId: "u1", from: "2026-03-05", to: "2026-03-06", kind: "vacation" as const }];
    expect(isOff("u1", new Date(2026, 2, 5), offs)).toBe(true);
    expect(isOff("u1", new Date(2026, 2, 6), offs)).toBe(true);
    expect(isOff("u1", new Date(2026, 2, 4), offs)).toBe(false);
    expect(isOff("u2", new Date(2026, 2, 5), offs)).toBe(false);
  });

  it("allocationActive respects from and the optional to", () => {
    expect(allocationActive(a1, new Date(2026, 2, 1))).toBe(false);
    expect(allocationActive(a1, new Date(2026, 2, 2))).toBe(true);
    expect(allocationActive(makeAllocation({ id: "b", to: "2026-03-03" }), new Date(2026, 2, 3))).toBe(true);
    expect(allocationActive(makeAllocation({ id: "b", to: "2026-03-03" }), new Date(2026, 2, 4))).toBe(false);
  });

  it("allocatedPercent sums the active allocations of a user", () => {
    const a2 = makeAllocation({ id: "a2", projectId: "p2", percent: 25 });
    const other = makeAllocation({ id: "a3", userId: "u2", percent: 100 });
    expect(allocatedPercent("u1", new Date(2026, 2, 3), [a1, a2, other])).toBe(75);
    expect(allocatedPercent("u1", new Date(2026, 2, 1), [a1, a2, other])).toBe(0);
  });

  it("earliestAllocation", () => {
    expect(earliestAllocation([])).toBeUndefined();
    expect(earliestAllocation([makeAllocation({ id: "x", from: "2026-03-09" }), a1])).toEqual(parseISO("2026-03-02"));
  });
});

describe("buildAllocationEntries", () => {
  it("creates one virtual entry per working day sized by the percentage", () => {
    const out = buildAllocationEntries(base);
    expect(out).toHaveLength(5);
    const first = out[0];
    expect(first.id).toBe(`${VIRTUAL_PREFIX}a1_2026-03-02`);
    expect(first).toMatchObject({ userId: "u1", projectId: "p1", virtual: true, allocationId: "a1", percent: 50, billable: true, tagIds: [] });
    expect(first.description).toBe("Allocation 50%");
    expect(parseISO(first.start).getHours()).toBe(9);
    expect(entryDuration(first)).toBe(4 * 3600);
    expect(out.map((e) => e.start.slice(0, 10))).toEqual(["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"]);
  });

  it("skips holidays, time off and days with a real entry on the same project", () => {
    expect(buildAllocationEntries({ ...base, holidays: [{ id: "h", date: "2026-03-04", name: "Holiday" }] })).toHaveLength(4);
    expect(buildAllocationEntries({ ...base, timeOffs: [{ id: "t", userId: "u1", from: "2026-03-05", to: "2026-03-06", kind: "sick" }] })).toHaveLength(3);
    const real = makeEntry({ id: "r", start: "2026-03-03T10:00:00.000Z", hours: 1 });
    const out = buildAllocationEntries({ ...base, realEntries: [real] });
    expect(out.map((e) => e.start.slice(0, 10))).not.toContain("2026-03-03");
    // a real entry on another project does not replace the allocation
    expect(buildAllocationEntries({ ...base, realEntries: [{ ...real, projectId: "p2" }] })).toHaveLength(5);
  });

  it("ignores archived or unknown projects, inactive dates and empty percentages", () => {
    expect(buildAllocationEntries({ ...base, projects: [makeProject({ archived: true })] })).toEqual([]);
    expect(buildAllocationEntries({ ...base, projects: [] })).toEqual([]);
    expect(buildAllocationEntries({ ...base, allocations: [makeAllocation({ id: "b", to: "2026-03-03" })] })).toHaveLength(2);
    expect(buildAllocationEntries({ ...base, allocations: [makeAllocation({ id: "z", percent: 0 })] })).toEqual([]);
    expect(buildAllocationEntries({ ...base, allocations: [] })).toEqual([]);
  });

  it("stacks the allocations of a user so the blocks do not overlap", () => {
    const a2 = makeAllocation({ id: "a2", projectId: "p2", percent: 25, note: "Support" });
    const out = buildAllocationEntries({ ...base, allocations: [a1, a2], projects: [makeProject(), makeProject({ id: "p2", billable: false })] });
    expect(out).toHaveLength(10);
    const monday = out.filter((e) => e.start.startsWith("2026-03-02"));
    expect(monday.map((e) => e.allocationId)).toEqual(["a1", "a2"]);
    expect(monday[1].start).toBe(monday[0].stop);
    expect(entryDuration(monday[1])).toBe(2 * 3600);
    expect(monday[1]).toMatchObject({ description: "Support", billable: false });
  });
});
