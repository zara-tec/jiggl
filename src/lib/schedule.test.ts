import { describe, expect, it } from "vitest";
import { addWorkingDays, dependentsOf, isWorkingDay, lineDurationDays, scheduleLines, workingDaysBetween, type WorkCalendar } from "./schedule";
import { makeLine } from "@/test/fixtures";

// March 2026: the 2nd is a Monday; the 9th is declared a holiday
const cal: WorkCalendar = { workDays: [1, 2, 3, 4, 5], holidays: [{ date: "2026-03-09" }, { date: "2026-03-23", to: "2026-03-27" }] };

describe("working days", () => {
  it("knows weekends and holidays", () => {
    expect(isWorkingDay("2026-03-02", cal)).toBe(true);
    expect(isWorkingDay("2026-03-07", cal)).toBe(false);
    expect(isWorkingDay("2026-03-09", cal)).toBe(false);
    expect(isWorkingDay("2026-03-07", { workDays: [], holidays: [] })).toBe(false);
    expect(isWorkingDay("2026-03-07", { workDays: [6], holidays: [] })).toBe(true);
    // a company closure blocks the whole range
    expect(isWorkingDay("2026-03-25", cal)).toBe(false);
    expect(addWorkingDays("2026-03-20", 1, cal)).toBe("2026-03-30");
  });

  it("addWorkingDays skips weekends and holidays, snaps at zero and walks backwards", () => {
    expect(addWorkingDays("2026-03-06", 1, cal)).toBe("2026-03-10"); // Fri -> skip Sat, Sun, holiday Mon
    expect(addWorkingDays("2026-03-02", 4, cal)).toBe("2026-03-06");
    expect(addWorkingDays("2026-03-02", 0, cal)).toBe("2026-03-02");
    expect(addWorkingDays("2026-03-07", 0, cal)).toBe("2026-03-10");
    expect(addWorkingDays("2026-03-10", -1, cal)).toBe("2026-03-06");
  });

  it("workingDaysBetween is inclusive and never below one", () => {
    expect(workingDaysBetween("2026-03-02", "2026-03-06", cal)).toBe(5);
    expect(workingDaysBetween("2026-03-06", "2026-03-10", cal)).toBe(2);
    expect(workingDaysBetween("2026-03-07", "2026-03-08", cal)).toBe(1);
    expect(workingDaysBetween("2026-03-10", "2026-03-02", cal)).toBe(1);
  });

  it("lineDurationDays uses the planned span, else the hours", () => {
    expect(lineDurationDays({ plannedStart: "2026-03-02", plannedEnd: "2026-03-06", hours: 1 }, cal, 8)).toBe(5);
    expect(lineDurationDays({ hours: 20 }, cal, 8)).toBe(3);
    expect(lineDurationDays({ hours: 0 }, cal, 8)).toBe(1);
    expect(lineDurationDays({ plannedStart: "2026-03-02", hours: 16 }, cal, 0)).toBe(2);
  });
});

describe("dependentsOf", () => {
  it("follows the chain of predecessors", () => {
    const lines = [
      { id: "a" },
      { id: "b", predecessorId: "a" },
      { id: "c", predecessorId: "b" },
      { id: "d", predecessorId: "x" },
    ];
    expect([...dependentsOf(lines, "a")].sort()).toEqual(["b", "c"]);
    expect([...dependentsOf(lines, "c")]).toEqual([]);
  });
});

describe("scheduleLines", () => {
  const opts = { cal, hoursPerDay: 8 };
  const a = makeLine({ id: "a", plannedStart: "2026-03-02", plannedEnd: "2026-03-06", hours: 40 });

  it("starts a dependent line the next working day after its predecessor and keeps its duration", () => {
    const b = makeLine({ id: "b", order: 2, predecessorId: "a", plannedStart: "2026-01-05", plannedEnd: "2026-01-07", hours: 24 });
    const out = scheduleLines([a, b], opts);
    expect(out[0]).toBe(a);
    expect(out[1]).toMatchObject({ plannedStart: "2026-03-10", plannedEnd: "2026-03-12" });
  });

  it("derives the duration from the hours when the line has no dates, and applies the lag", () => {
    const b = makeLine({ id: "b", order: 2, predecessorId: "a", hours: 20, lagDays: 2 });
    const out = scheduleLines([a, b], opts);
    expect(out[1]).toMatchObject({ plannedStart: "2026-03-12", plannedEnd: "2026-03-16" });
    const overlap = scheduleLines([a, { ...b, lagDays: -2 }], opts);
    expect(overlap[1]).toMatchObject({ plannedStart: "2026-03-05", plannedEnd: "2026-03-10" });
  });

  it("cascades through a chain in any order", () => {
    const c = makeLine({ id: "c", order: 3, predecessorId: "b", hours: 8 });
    const b = makeLine({ id: "b", order: 2, predecessorId: "a", hours: 8 });
    const out = scheduleLines([c, b, a], opts);
    expect(out.map((l) => [l.id, l.plannedStart, l.plannedEnd])).toEqual([
      ["c", "2026-03-11", "2026-03-11"],
      ["b", "2026-03-10", "2026-03-10"],
      ["a", "2026-03-02", "2026-03-06"],
    ]);
  });

  it("returns the same array when nothing changes and leaves cycles and dangling predecessors alone", () => {
    const b = makeLine({ id: "b", order: 2, predecessorId: "a", plannedStart: "2026-03-10", plannedEnd: "2026-03-12" });
    const lines = [a, b];
    expect(scheduleLines(lines, opts)).toBe(lines);
    const x = makeLine({ id: "x", predecessorId: "y", plannedStart: "2026-03-02", plannedEnd: "2026-03-03" });
    const y = makeLine({ id: "y", order: 2, predecessorId: "x", plannedStart: "2026-03-04", plannedEnd: "2026-03-05" });
    const cycle = [x, y];
    expect(scheduleLines(cycle, opts)).toBe(cycle);
    // a line hanging off a cycle still follows its (cyclic) predecessor's dates
    const z = makeLine({ id: "z", order: 3, predecessorId: "y", hours: 8 });
    expect(scheduleLines([x, y, z], opts)[2]).toMatchObject({ plannedStart: "2026-03-06", plannedEnd: "2026-03-06" });
    const dangling = makeLine({ id: "d", predecessorId: "nope", plannedStart: "2026-03-02" });
    expect(scheduleLines([dangling], opts)[0]).toBe(dangling);
    const noEnd = makeLine({ id: "e", order: 2, predecessorId: "n", hours: 8 });
    expect(scheduleLines([makeLine({ id: "n", plannedStart: "2026-03-02" }), noEnd], opts)[1]).toBe(noEnd);
  });
});
