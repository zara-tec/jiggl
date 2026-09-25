import { describe, expect, it, vi } from "vitest";
import { buildSeed } from "@/lib/seed";

// No database in unit tests: the mapping helpers only need the Prisma DMMF.
vi.mock("./db", () => ({ prisma: {} }));

const { COLLECTIONS, DEFAULT_SETTINGS, fromRow, isCollection, toRow } = await import("./workspace");

describe("collection mapping", () => {
  it("knows a Prisma model for every client collection", () => {
    for (const c of COLLECTIONS) expect(() => toRow(c, { id: "x" })).not.toThrow();
  });

  it("isCollection", () => {
    expect(isCollection("issues")).toBe(true);
    expect(isCollection("accounts")).toBe(false);
    expect(isCollection("")).toBe(false);
  });

  it("DEFAULT_SETTINGS is a complete workspace configuration", () => {
    expect(DEFAULT_SETTINGS).toEqual({ name: "My workspace", currency: "EUR", hoursPerDay: 8, workDays: [1, 2, 3, 4, 5], dayStart: "09:00" });
  });
});

describe("toRow", () => {
  it("nulls optional columns, fills required ones and drops unknown or bookkeeping keys", () => {
    const row = toRow("issues", {
      id: "i1",
      key: "P-1",
      projectId: "p1",
      type: "task",
      summary: "Summary",
      status: "todo",
      priority: "medium",
      reporterId: "u1",
      rank: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      extra: "nope",
      workspaceId: "hack",
      syncedAt: "hack",
    });
    expect(row).not.toHaveProperty("extra");
    expect(row).not.toHaveProperty("workspaceId");
    expect(row).not.toHaveProperty("syncedAt");
    expect(row.parentId).toBeNull();
    expect(row.assigneeId).toBeNull();
    expect(row.labels).toEqual([]);
    expect(row.comments).toEqual([]);
    expect(row.watchers).toEqual([]);
    expect(row.summary).toBe("Summary");
  });

  it("fills required scalars with neutral values", () => {
    const row = toRow("timeEntries", { id: "t1" });
    expect(row).toMatchObject({ id: "t1", userId: "", description: "", tagIds: [], billable: false, start: "", projectId: null, stop: null });
  });
});

describe("fromRow", () => {
  it("removes nulls and bookkeeping", () => {
    const out = fromRow("issues", { workspaceId: "w", syncedAt: new Date(), id: "i1", summary: "s", parentId: null, labels: ["a"] });
    expect(out).toEqual({ id: "i1", summary: "s", labels: ["a"] });
  });

  it("round-trips every entity of the demo dataset without losing fields", () => {
    const seed = buildSeed(new Date("2026-03-16T12:00:00.000Z"));
    for (const c of COLLECTIONS) {
      const list = seed[c] as unknown as Record<string, unknown>[];
      expect(list.length).toBeGreaterThan(0);
      for (const entity of list) expect(fromRow(c, toRow(c, entity))).toEqual(entity);
    }
  });
});

describe("server-managed fields", () => {
  it("the sync cannot write a member's deactivation, but the client reads it", () => {
    const row = toRow("users", { id: "u1", name: "Ada", email: "ada@example.com", color: "#000", role: "member", costRates: [], deactivatedAt: "2026-09-01T00:00:00.000Z" });
    expect(row).not.toHaveProperty("deactivatedAt");
    expect(fromRow("users", { workspaceId: "w", id: "u1", deactivatedAt: "2026-09-01T00:00:00.000Z", syncedAt: new Date() })).toMatchObject({ deactivatedAt: "2026-09-01T00:00:00.000Z" });
  });
});
