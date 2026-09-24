import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";

const now = new Date("2026-03-16T12:00:00.000Z");
const seed = buildSeed(now);

const idsOf = (list: { id: string }[]) => new Set(list.map((x) => x.id));
const users = idsOf(seed.users);
const clients = idsOf(seed.clients);
const tags = idsOf(seed.tags);
const projects = idsOf(seed.projects);
const issueById = new Map(seed.issues.map((i) => [i.id, i]));
const sprintById = new Map(seed.sprints.map((s) => [s.id, s]));
const projectById = new Map(seed.projects.map((p) => [p.id, p]));

describe("demo seed", () => {
  it("is deterministic for a given date", () => {
    expect(JSON.stringify(buildSeed(now))).toBe(JSON.stringify(seed));
  });

  it("has the owner placeholder as the current user", () => {
    expect(seed.currentUserId).toBe("u_alex");
    expect(users.has("u_alex")).toBe(true);
    for (const u of seed.users) expect(u.costRates.length).toBeGreaterThan(0);
  });

  it("has unique ids, keys and numbers", () => {
    const collections = [seed.users, seed.clients, seed.tags, seed.projects, seed.sprints, seed.issues, seed.timeEntries, seed.offers, seed.allocations, seed.holidays, seed.timeOffs];
    for (const list of collections) expect(idsOf(list).size).toBe(list.length);
    expect(new Set(seed.issues.map((i) => i.key)).size).toBe(seed.issues.length);
    expect(new Set(seed.offers.map((o) => o.number)).size).toBe(seed.offers.length);
    expect(new Set(seed.projects.map((p) => p.key)).size).toBe(seed.projects.length);
  });

  it("projects reference existing people and clients and keep their counters ahead of the keys", () => {
    for (const p of seed.projects) {
      expect(users.has(p.leadId)).toBe(true);
      if (p.clientId) expect(clients.has(p.clientId)).toBe(true);
      const issueNumbers = seed.issues.filter((i) => i.projectId === p.id).map((i) => Number(i.key.slice(p.key.length + 1)));
      for (const n of issueNumbers) expect(Number.isInteger(n) && n > 0).toBe(true);
      expect(p.issueCounter).toBeGreaterThanOrEqual(Math.max(0, ...issueNumbers));
      const offerNumbers = seed.offers.filter((o) => o.projectId === p.id).map((o) => Number(o.number.slice(p.key.length + 2)));
      expect(p.offerCounter).toBeGreaterThanOrEqual(Math.max(0, ...offerNumbers));
      for (const uid of Object.keys(p.memberRates)) expect(users.has(uid)).toBe(true);
    }
  });

  it("sprints belong to projects", () => {
    for (const s of seed.sprints) expect(projects.has(s.projectId)).toBe(true);
  });

  it("work items reference existing projects, parents, sprints and people", () => {
    for (const i of seed.issues) {
      const project = projectById.get(i.projectId);
      expect(project).toBeDefined();
      expect(i.key.startsWith(`${project!.key}-`)).toBe(true);
      if (i.parentId) expect(issueById.get(i.parentId)?.projectId).toBe(i.projectId);
      if (i.sprintId) expect(sprintById.get(i.sprintId)?.projectId).toBe(i.projectId);
      if (i.assigneeId) expect(users.has(i.assigneeId)).toBe(true);
      expect(users.has(i.reporterId)).toBe(true);
      for (const w of i.watchers) expect(users.has(w)).toBe(true);
      for (const c of i.comments) expect(users.has(c.authorId)).toBe(true);
    }
  });

  it("time entries reference existing people, projects, work items and tags", () => {
    const running = new Map<string, number>();
    for (const e of seed.timeEntries) {
      expect(users.has(e.userId)).toBe(true);
      if (e.projectId) expect(projects.has(e.projectId)).toBe(true);
      if (e.issueId) expect(issueById.get(e.issueId)?.projectId).toBe(e.projectId);
      for (const t of e.tagIds) expect(tags.has(t)).toBe(true);
      if (e.stop) expect(new Date(e.stop).getTime()).toBeGreaterThanOrEqual(new Date(e.start).getTime());
      else running.set(e.userId, (running.get(e.userId) ?? 0) + 1);
      expect(e.virtual).toBeUndefined();
    }
    for (const count of running.values()) expect(count).toBeLessThanOrEqual(1);
  });

  it("offers belong to projects and orders are linked to their work items", () => {
    for (const o of seed.offers) {
      expect(projects.has(o.projectId)).toBe(true);
      expect(users.has(o.ownerId)).toBe(true);
      expect(idsOf(o.lines).size).toBe(o.lines.length);
      expect([...o.lines].map((l) => l.order).sort((a, b) => a - b)).toEqual(o.lines.map((_, i) => i + 1));
      // an order may keep lines that were not converted; the converted ones point at their work items
      if (o.status === "ordered") expect(o.lines.some((l) => l.issueId)).toBe(true);
      for (const l of o.lines) {
        if (l.issueId) {
          const issue = issueById.get(l.issueId);
          expect(issue?.projectId).toBe(o.projectId);
          expect(issue?.offerId).toBe(o.id);
          expect(issue?.offerLineId).toBe(l.id);
        }
      }
    }
    for (const i of seed.issues) {
      if (!i.offerId) continue;
      const offer = seed.offers.find((o) => o.id === i.offerId);
      expect(offer?.lines.some((l) => l.id === i.offerLineId && l.issueId === i.id)).toBe(true);
    }
  });

  it("allocations, time off and holidays are consistent", () => {
    for (const a of seed.allocations) {
      expect(users.has(a.userId)).toBe(true);
      expect(projects.has(a.projectId)).toBe(true);
      if (a.issueId) expect(issueById.get(a.issueId)?.projectId).toBe(a.projectId);
      expect(a.percent).toBeGreaterThan(0);
      expect(a.percent).toBeLessThanOrEqual(100);
      if (a.to) expect(a.to >= a.from).toBe(true);
    }
    for (const t of seed.timeOffs) {
      expect(users.has(t.userId)).toBe(true);
      expect(t.to >= t.from).toBe(true);
    }
    for (const h of seed.holidays) expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
