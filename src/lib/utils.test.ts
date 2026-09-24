import { describe, expect, it } from "vitest";
import { daysBetween, entryDuration, formatDurationClock, formatDurationShort, formatHoursDecimal, hashColor, initials, parseDuration, pct, sum } from "./utils";
import { makeEntry } from "@/test/fixtures";

describe("parseDuration", () => {
  it.each([
    ["1h 30m", 5400],
    ["1:30", 5400],
    ["1:30:15", 5415],
    ["90m", 5400],
    ["1.5h", 5400],
    ["1,5h", 5400],
    ["2", 7200],
    ["1d", 8 * 3600],
    ["1w", 40 * 3600],
    ["45s", 45],
    ["  2H  ", 7200],
  ])("parses %j", (input, seconds) => {
    expect(parseDuration(input)).toBe(seconds);
  });

  it("returns undefined for empty or unparsable input", () => {
    expect(parseDuration("")).toBeUndefined();
    expect(parseDuration("   ")).toBeUndefined();
    expect(parseDuration("abc")).toBeUndefined();
  });
});

describe("duration formatting", () => {
  it("formats clock style", () => {
    expect(formatDurationClock(3661)).toBe("1:01:01");
    expect(formatDurationClock(59)).toBe("0:00:59");
    expect(formatDurationClock(-5)).toBe("0:00:00");
  });

  it("formats short style", () => {
    expect(formatDurationShort(0)).toBe("0m");
    expect(formatDurationShort(1800)).toBe("30m");
    expect(formatDurationShort(3600)).toBe("1h");
    expect(formatDurationShort(5400)).toBe("1h 30m");
  });

  it("formats decimal hours", () => {
    expect(formatHoursDecimal(9000)).toBe("2.50");
  });
});

describe("entryDuration", () => {
  it("uses the stop time when present", () => {
    const e = makeEntry({ id: "e", start: "2026-01-05T10:00:00.000Z", hours: 1.5 });
    expect(entryDuration(e)).toBe(5400);
  });

  it("uses `now` for a running entry", () => {
    const e = makeEntry({ id: "e", start: "2026-01-05T10:00:00.000Z" });
    expect(entryDuration(e, new Date("2026-01-05T12:00:00.000Z"))).toBe(7200);
  });

  it("never goes negative", () => {
    const e = makeEntry({ id: "e", start: "2026-01-05T10:00:00.000Z", stop: "2026-01-05T09:00:00.000Z" });
    expect(entryDuration(e)).toBe(0);
  });
});

describe("small helpers", () => {
  it("initials take the first and last name", () => {
    expect(initials("Alex Moretti")).toBe("AM");
    expect(initials("Cher")).toBe("C");
    expect(initials("  Jean Paul Sartre ")).toBe("JS");
  });

  it("pct rounds and survives a zero total", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(2, 3)).toBe(67);
    expect(pct(1, 0)).toBe(0);
  });

  it("sum", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });

  it("hashColor is stable and stays inside the palette", () => {
    const palette = ["a", "b", "c"];
    expect(hashColor("p_jig", palette)).toBe(hashColor("p_jig", palette));
    expect(palette).toContain(hashColor("anything", palette));
  });

  it("daysBetween is inclusive and empty when reversed", () => {
    const days = daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 3));
    expect(days.map((d) => d.getDate())).toEqual([1, 2, 3]);
    expect(daysBetween(new Date(2026, 0, 3), new Date(2026, 0, 1))).toEqual([]);
  });
});
