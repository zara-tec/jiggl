import { describe, expect, it } from "vitest";
import { HOLIDAY_KINDS, holidayDays, holidayEnd, isHoliday, sortHolidays } from "./holidays";

const list = [
  { date: "2026-12-25", name: "Christmas" },
  { date: "2026-08-10", to: "2026-08-21", name: "Summer closure", kind: "closure" as const },
  { date: "2026-05-01", to: "2026-04-01", name: "Broken range" },
];

describe("holidays", () => {
  it("isHoliday covers single days and inclusive ranges", () => {
    expect(isHoliday("2026-12-25", list)).toBe(true);
    expect(isHoliday("2026-12-26", list)).toBe(false);
    expect(isHoliday("2026-08-10", list)).toBe(true);
    expect(isHoliday("2026-08-15", list)).toBe(true);
    expect(isHoliday("2026-08-21", list)).toBe(true);
    expect(isHoliday("2026-08-22", list)).toBe(false);
    expect(isHoliday("2026-08-09", list)).toBe(false);
    expect(isHoliday("2026-01-01", [])).toBe(false);
  });

  it("a range ending before it starts counts as its first day only", () => {
    expect(isHoliday("2026-05-01", list)).toBe(true);
    expect(isHoliday("2026-04-15", list)).toBe(false);
    expect(holidayEnd(list[2])).toBe("2026-05-01");
    expect(holidayDays(list[2])).toBe(1);
  });

  it("holidayDays and holidayEnd", () => {
    expect(holidayDays(list[0])).toBe(1);
    expect(holidayDays(list[1])).toBe(12);
    expect(holidayEnd(list[1])).toBe("2026-08-21");
  });

  it("sortHolidays orders by first day", () => {
    expect(sortHolidays(list).map((h) => h.date)).toEqual(["2026-05-01", "2026-08-10", "2026-12-25"]);
  });

  it("kinds are holiday and closure", () => {
    expect(HOLIDAY_KINDS.map((k) => k.id)).toEqual(["holiday", "closure"]);
  });
});
