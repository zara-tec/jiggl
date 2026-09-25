import { describe, expect, it } from "vitest";
import { inTeam, isTeamOpen, projectTeam, teamIds, withTeamMembers } from "./team";
import { makeProject, makeUser } from "@/test/fixtures";

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
