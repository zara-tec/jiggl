import type { ID, Project, User } from "./types";

/**
 * Project teams. A project either has an explicit team (`memberIds`, the
 * lead always counts as a member) or is open to everyone in the workspace
 * (no `memberIds`), which is how projects behaved before teams existed.
 */

type TeamProject = Pick<Project, "leadId" | "memberIds">;

export function isTeamOpen(project: TeamProject): boolean {
  return !project.memberIds;
}

/** Ids of the explicit team, lead first; undefined for an open project */
export function teamIds(project: TeamProject): ID[] | undefined {
  if (!project.memberIds) return undefined;
  return [project.leadId, ...project.memberIds.filter((id) => id !== project.leadId)];
}

export function inTeam(project: TeamProject, userId: ID): boolean {
  const ids = teamIds(project);
  return !ids || ids.includes(userId);
}

/** The members who work on the project, in the workspace order (everyone for an open project) */
export function projectTeam<U extends Pick<User, "id">>(project: TeamProject, users: U[]): U[] {
  return isTeamOpen(project) ? users : users.filter((u) => inTeam(project, u.id));
}

/** The explicit team plus these members; an open project stays open (same object) */
export function withTeamMembers<P extends TeamProject>(project: P, ids: ID[]): P {
  if (!project.memberIds) return project;
  const missing = ids.filter((id) => id !== project.leadId && !project.memberIds!.includes(id));
  return missing.length ? { ...project, memberIds: [...project.memberIds, ...missing] } : project;
}
