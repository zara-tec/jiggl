import type { Allocation, ID, Issue, Offer, OfferBaseline, OfferLine, Project, TimeEntry, TimeOff, User } from "./types";

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

/* ---------------- Workspace members: deactivation and removal ---------------- */

/**
 * A deactivated member keeps their history (hours, work items, forecast) but
 * cannot open the workspace and is not offered for new work. Removing is for
 * members nobody refers to, typically people added by mistake.
 */
export function isActive(user: Pick<User, "deactivatedAt"> | undefined): boolean {
  return !!user && !user.deactivatedAt;
}

/** The members that can be picked for new work; `keep` (the current value of a field) stays listed */
export function pickable<U extends Pick<User, "id" | "deactivatedAt">>(users: U[], keep?: ID | null): U[] {
  return users.every((u) => !u.deactivatedAt) ? users : users.filter((u) => !u.deactivatedAt || u.id === keep);
}

export interface MemberUsage {
  key: string;
  label: string;
  count: number;
}

export interface UsageData {
  timeEntries: TimeEntry[];
  issues: Issue[];
  allocations: Allocation[];
  timeOffs: TimeOff[];
  projects: Project[];
  offers: Offer[];
  offerBaselines: OfferBaseline[];
}

/**
 * What refers to a member. Removing them is allowed only when this is empty;
 * otherwise they are deactivated. Project teams, rate overrides and watchers
 * do not count: removing the member cleans them up.
 */
export function memberUsage(userId: ID, d: UsageData): MemberUsage[] {
  const planned = (lines: OfferLine[]) => lines.some((l) => (l.activities ?? []).some((a) => (a.effort?.[userId] ?? 0) > 0));
  const counts: [string, string, number][] = [
    ["entries", "time entries", d.timeEntries.filter((e) => e.userId === userId && !e.virtual).length],
    ["assigned", "assigned work items", d.issues.filter((i) => i.assigneeId === userId).length],
    ["reported", "reported work items", d.issues.filter((i) => i.reporterId === userId).length],
    ["comments", "comments", d.issues.reduce((n, i) => n + (i.comments ?? []).filter((c) => c.authorId === userId).length, 0)],
    ["allocations", "allocations", d.allocations.filter((a) => a.userId === userId).length],
    ["timeOffs", "time off", d.timeOffs.filter((t) => t.userId === userId).length],
    ["lead", "projects led", d.projects.filter((p) => p.leadId === userId).length],
    ["offers", "offers owned", d.offers.filter((o) => o.ownerId === userId).length],
    ["forecast", "offers with forecast effort", d.offers.filter((o) => planned(o.lines)).length],
    ["baselines", "baselines", d.offerBaselines.filter((b) => b.createdBy === userId || planned(b.lines)).length],
  ];
  return counts.filter(([, , n]) => n > 0).map(([key, label, count]) => ({ key, label, count }));
}

/** "12 time entries, 3 assigned work items" */
export function describeUsage(usage: MemberUsage[]): string {
  return usage.map((u) => `${u.count} ${u.label}`).join(", ");
}
