import { describe, expect, it } from "vitest";
import { describeUsage, inTeam, isActive, isTeamOpen, memberUsage, pickable, projectTeam, teamIds, withTeamMembers } from "./team";
import { makeActivity, makeBaseline, makeEntry, makeIssue, makeLine, makeOffer, makeProject, makeUser } from "@/test/fixtures";

const users = [makeUser({ id: "u1" }), makeUser({ id: "u2" }), makeUser({ id: "u3" })];

describe("project teams", () => {
  it("a project without memberIds is open to everyone", () => {
    const p = makeProject({ leadId: "u1" });
    expect(isTeamOpen(p)).toBe(true);
    expect(teamIds(p)).toBeUndefined();
    expect(inTeam(p, "u3")).toBe(true);
    expect(projectTeam(p, users)).toBe(users);
    expect(withTeamMembers(p, ["u3"])).toBe(p);
  });

  it("an explicit team always includes the lead, first", () => {
    const p = makeProject({ leadId: "u2", memberIds: ["u3"] });
    expect(isTeamOpen(p)).toBe(false);
    expect(teamIds(p)).toEqual(["u2", "u3"]);
    expect(inTeam(p, "u1")).toBe(false);
    expect(inTeam(p, "u2")).toBe(true);
    expect(projectTeam(p, users).map((u) => u.id)).toEqual(["u2", "u3"]);
    expect(teamIds(makeProject({ leadId: "u1", memberIds: ["u3", "u1"] }))).toEqual(["u1", "u3"]);
    expect(projectTeam(makeProject({ leadId: "u1", memberIds: [] }), users).map((u) => u.id)).toEqual(["u1"]);
  });

  it("withTeamMembers adds the missing people only", () => {
    const p = makeProject({ leadId: "u1", memberIds: ["u2"] });
    expect(withTeamMembers(p, ["u2", "u1"])).toBe(p);
    expect(withTeamMembers(p, ["u3", "u2"]).memberIds).toEqual(["u2", "u3"]);
  });
});

describe("workspace members: deactivation and removal", () => {
  const off = makeUser({ id: "u2", deactivatedAt: "2026-09-01T10:00:00.000Z" });
  const people = [makeUser({ id: "u1" }), off, makeUser({ id: "u3" })];

  it("isActive and pickable leave deactivated members out of new work", () => {
    expect(isActive(people[0])).toBe(true);
    expect(isActive(off)).toBe(false);
    expect(isActive(undefined)).toBe(false);
    expect(pickable(people).map((u) => u.id)).toEqual(["u1", "u3"]);
    expect(pickable(people, "u2").map((u) => u.id)).toEqual(["u1", "u2", "u3"]);
    // nobody deactivated: the same array, so memoised option lists stay stable
    expect(pickable(users)).toBe(users);
  });

  const empty = { timeEntries: [], issues: [], allocations: [], timeOffs: [], projects: [], offers: [], offerBaselines: [] };

  it("a member nothing refers to can be removed (teams and rate overrides do not count)", () => {
    expect(memberUsage("u9", { ...empty, projects: [makeProject({ leadId: "u1", memberIds: ["u9"], memberRates: { u9: { cost: [] } } })] })).toEqual([]);
  });

  it("lists what blocks the removal, ignoring virtual entries", () => {
    const usage = memberUsage("u2", {
      ...empty,
      timeEntries: [makeEntry({ id: "t1", userId: "u2", start: "2026-09-01T09:00:00.000Z" }), makeEntry({ id: "t2", userId: "u2", start: "2026-09-02T09:00:00.000Z", virtual: true })],
      issues: [makeIssue({ id: "i1", assigneeId: "u2", reporterId: "u1", comments: [{ id: "c1", authorId: "u2", body: "hi", createdAt: "2026-09-01T09:00:00.000Z" }] })],
      projects: [makeProject({ leadId: "u2" })],
      offers: [makeOffer({ id: "o1", ownerId: "u1", lines: [makeLine({ id: "l1", activities: [makeActivity({ id: "a1", effort: { u2: 8 } })] })] })],
    });
    expect(usage.map((u) => u.key)).toEqual(["entries", "assigned", "comments", "lead", "forecast"]);
    expect(describeUsage(usage)).toBe("1 time entries, 1 assigned work items, 1 comments, 1 projects led, 1 offers with forecast effort");
  });

  it("baselines count when the member created them or is planned in them", () => {
    const planned = makeBaseline({ id: "b1", createdBy: "u1", lines: [makeLine({ id: "l1", activities: [makeActivity({ id: "a1", effort: { u2: 4 } })] })] });
    expect(memberUsage("u2", { ...empty, offerBaselines: [planned] }).map((u) => u.key)).toEqual(["baselines"]);
    expect(memberUsage("u3", { ...empty, offerBaselines: [planned] })).toEqual([]);
  });
});
