"use client";

import { useMemo } from "react";
import { addDays } from "date-fns";
import { useStore } from "@/lib/store";
import { buildAllocationEntries, earliestAllocation } from "@/lib/allocations";
import { projectTeam } from "@/lib/team";
import type { ID, Issue, Offer, Project, TimeEntry, User } from "@/lib/types";
import { entryDuration, sum } from "@/lib/utils";

export function useProjectByKey(key: string): Project | undefined {
  return useStore((s) => s.projects.find((p) => p.key.toLowerCase() === key.toLowerCase()));
}

export function useIssueByKey(key: string): Issue | undefined {
  return useStore((s) => s.issues.find((i) => i.key.toLowerCase() === key.toLowerCase()));
}

export function useUser(id?: ID): User | undefined {
  return useStore((s) => (id ? s.users.find((u) => u.id === id) : undefined));
}

export function useProject(id?: ID): Project | undefined {
  return useStore((s) => (id ? s.projects.find((p) => p.id === id) : undefined));
}

export function useIssue(id?: ID): Issue | undefined {
  return useStore((s) => (id ? s.issues.find((i) => i.id === id) : undefined));
}

export function useCurrentUser(): User {
  return useStore((s) => s.users.find((u) => u.id === s.currentUserId) as User);
}

export function useRunningEntry(): TimeEntry | undefined {
  return useStore((s) => s.timeEntries.find((t) => t.userId === s.currentUserId && !t.stop));
}

/**
 * Real time entries plus virtual ones generated from fixed allocations
 * (projects in allocation mode). Past and today by default; the calendar
 * asks for the future as well.
 */
export function useEffectiveEntries(opts?: { includeFuture?: boolean }): TimeEntry[] {
  const real = useStore((s) => s.timeEntries);
  const allocations = useStore((s) => s.allocations);
  const projects = useStore((s) => s.projects);
  const settings = useStore((s) => s.settings);
  const holidays = useStore((s) => s.holidays);
  const timeOffs = useStore((s) => s.timeOffs);
  const includeFuture = !!opts?.includeFuture;
  return useMemo(() => {
    const active = allocations.filter((a) => projects.find((p) => p.id === a.projectId)?.timeMode === "allocation");
    const from = earliestAllocation(active);
    if (!from) return real;
    const to = includeFuture ? addDays(new Date(), 90) : new Date();
    const virt = buildAllocationEntries({ from, to, allocations: active, projects, settings, holidays, timeOffs, realEntries: real });
    return virt.length ? [...real, ...virt] : real;
  }, [real, allocations, projects, settings, holidays, timeOffs, includeFuture]);
}

/** Members who work on the project (everyone when the project has no explicit team) */
export function useProjectTeam(projectId?: ID): User[] {
  const users = useStore((s) => s.users);
  const project = useStore((s) => (projectId ? s.projects.find((p) => p.id === projectId) : undefined));
  return useMemo(() => (project ? projectTeam(project, users) : users), [project, users]);
}

export function useProjectIssues(projectId?: ID) {
  const issues = useStore((s) => s.issues);
  return useMemo(() => issues.filter((i) => i.projectId === projectId).sort((a, b) => a.rank - b.rank), [issues, projectId]);
}

export function useProjectOffers(projectId?: ID) {
  const offers = useStore((s) => s.offers);
  return useMemo(() => offers.filter((o) => o.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [offers, projectId]);
}

export function useOffer(id?: ID): Offer | undefined {
  return useStore((s) => (id ? s.offers.find((o) => o.id === id) : undefined));
}

export function useProjectSprints(projectId?: ID) {
  const sprints = useStore((s) => s.sprints);
  return useMemo(() => sprints.filter((sp) => sp.projectId === projectId).sort((a, b) => a.order - b.order), [sprints, projectId]);
}

/** Total logged seconds per issue id (all users), allocated hours included */
export function useLoggedByIssue() {
  const entries = useEffectiveEntries();
  return useMemo(() => {
    const map = new Map<ID, number>();
    const now = new Date();
    for (const t of entries) {
      if (!t.issueId) continue;
      map.set(t.issueId, (map.get(t.issueId) ?? 0) + entryDuration(t, now));
    }
    return map;
  }, [entries]);
}

export function useIssueEntries(issueId?: ID) {
  const entries = useEffectiveEntries();
  return useMemo(() => entries.filter((t) => t.issueId === issueId).sort((a, b) => b.start.localeCompare(a.start)), [entries, issueId]);
}

export function totalSeconds(entries: TimeEntry[], now = new Date()) {
  return sum(entries.map((e) => entryDuration(e, now)));
}
