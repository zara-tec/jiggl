import { parseISO } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";
import { selectRunningEntry, useStore, type BootstrapPayload } from "./store";
import { buildSeed } from "./seed";
import { EPOCH, rateAt } from "./rates";
import { offerTotals } from "./offers";
import type { TimeEntry } from "./types";
import { SETTINGS } from "@/test/fixtures";

function bootstrap(): BootstrapPayload {
  const seed = buildSeed(new Date("2026-03-16T12:00:00.000Z"));
  return {
    session: { accountId: "acc_1", accountEmail: "ada@example.com", memberId: seed.currentUserId, workspaceId: "ws_1", workspaceName: "Test", workspaces: [{ id: "ws_1", name: "Test", role: "admin" }] },
    data: {
      settings: SETTINGS,
      users: seed.users,
      clients: seed.clients,
      tags: seed.tags,
      projects: seed.projects,
      sprints: seed.sprints,
      issues: seed.issues,
      timeEntries: seed.timeEntries,
      offers: seed.offers,
      offerBaselines: seed.offerBaselines,
      allocations: seed.allocations,
      holidays: seed.holidays,
      timeOffs: seed.timeOffs,
    },
  };
}

const state = () => useStore.getState();
const issue = (id: string) => state().issues.find((i) => i.id === id)!;
const offer = (id: string) => state().offers.find((o) => o.id === id)!;
const project = (id: string) => state().projects.find((p) => p.id === id)!;
const firstProject = () => state().projects[0];

beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
  state().applyBootstrap(bootstrap());
});

describe("applyBootstrap", () => {
  it("loads the workspace and marks the store as bootstrapped", () => {
    const s = state();
    expect(s.bootstrapped).toBe(true);
    expect(s.applyingRemote).toBe(false);
    expect(s.currentUserId).toBe("u_alex");
    expect(s.session?.workspaceId).toBe("ws_1");
    expect(s.projects.length).toBeGreaterThan(0);
    expect(s.settings).toMatchObject(SETTINGS);
  });
});

describe("referential stability (the sync diffs collections by identity)", () => {
  it("updating one work item leaves everything else untouched", () => {
    const before = state();
    const target = before.issues[0];
    before.updateIssue(target.id, { summary: "Renamed" });
    const after = state();
    expect(after.issues).not.toBe(before.issues);
    expect(issue(target.id).summary).toBe("Renamed");
    for (const i of after.issues) if (i.id !== target.id) expect(i).toBe(before.issues.find((x) => x.id === i.id));
    expect(after.projects).toBe(before.projects);
    expect(after.timeEntries).toBe(before.timeEntries);
    expect(after.offers).toBe(before.offers);
    expect(after.users).toBe(before.users);
    expect(after.settings).toBe(before.settings);
  });

  it("editing the running timer only touches that entry", () => {
    const running = state().startTimer({ description: "Focus" });
    const before = state().timeEntries;
    state().updateRunning({ description: "Deep focus" });
    const after = state().timeEntries;
    for (const t of after) if (t.id !== running.id) expect(t).toBe(before.find((x) => x.id === t.id));
    expect(after.find((t) => t.id === running.id)?.description).toBe("Deep focus");
  });

  it("deleting a tag only rewrites the entries that used it", () => {
    const tag = state().tags[0];
    const before = state().timeEntries;
    state().deleteTag(tag.id);
    const after = state().timeEntries;
    for (const t of after) {
      const old = before.find((x) => x.id === t.id)!;
      if (old.tagIds.includes(tag.id)) expect(t.tagIds).not.toContain(tag.id);
      else expect(t).toBe(old);
    }
  });
});

describe("work items", () => {
  it("createIssue numbers the key from the project counter", () => {
    const p = firstProject();
    const counter = p.issueCounter;
    const otherRanks = state().issues.map((i) => i.rank);
    const created = state().createIssue({ projectId: p.id, type: "task", summary: "  New task  " });
    expect(created.key).toBe(`${p.key}-${counter + 1}`);
    expect(created.summary).toBe("New task");
    expect(created).toMatchObject({ status: "todo", priority: "medium", reporterId: "u_alex", watchers: ["u_alex"], labels: [], comments: [] });
    expect(created.rank).toBeGreaterThan(Math.max(...otherRanks));
    expect(project(p.id).issueCounter).toBe(counter + 1);
    expect(state().issues.at(-1)).toBe(created);
  });

  it("createIssue throws for an unknown project", () => {
    expect(() => state().createIssue({ projectId: "nope", type: "task", summary: "x" })).toThrow();
  });

  it("updateIssue stamps resolvedAt when done and clears it when reopened", () => {
    const created = state().createIssue({ projectId: firstProject().id, type: "task", summary: "x" });
    state().updateIssue(created.id, { status: "done" });
    expect(issue(created.id).resolvedAt).toBeTruthy();
    state().updateIssue(created.id, { status: "todo" });
    expect(issue(created.id).resolvedAt).toBeUndefined();
  });

  it("deleteIssue removes children and detaches time entries", () => {
    const pid = firstProject().id;
    const parent = state().createIssue({ projectId: pid, type: "epic", summary: "parent" });
    const child = state().createIssue({ projectId: pid, type: "story", summary: "child", parentId: parent.id });
    const entry = state().addTimeEntry({ description: "work", projectId: pid, issueId: parent.id, tagIds: [], billable: true, start: "2026-03-10T09:00:00.000Z", stop: "2026-03-10T10:00:00.000Z" });
    state().deleteIssue(parent.id);
    expect(state().issues.some((i) => i.id === parent.id || i.id === child.id)).toBe(false);
    expect(state().timeEntries.find((t) => t.id === entry.id)?.issueId).toBeUndefined();
  });

  it("reorderIssue places the item between its neighbours", () => {
    const pid = firstProject().id;
    const a = state().createIssue({ projectId: pid, type: "task", summary: "a" });
    const b = state().createIssue({ projectId: pid, type: "task", summary: "b" });
    const c = state().createIssue({ projectId: pid, type: "task", summary: "c" });
    state().reorderIssue(c.id, { beforeId: b.id });
    expect(issue(c.id).rank).toBeGreaterThan(issue(a.id).rank);
    expect(issue(c.id).rank).toBeLessThan(issue(b.id).rank);
    state().reorderIssue(a.id, { afterId: b.id, status: "inprogress" });
    expect(issue(a.id).rank).toBeGreaterThan(issue(b.id).rank);
    expect(issue(a.id).status).toBe("inprogress");
  });

  it("comments are added by the current user and can be removed", () => {
    const created = state().createIssue({ projectId: firstProject().id, type: "task", summary: "x" });
    state().addComment(created.id, "Looks good");
    expect(issue(created.id).comments).toHaveLength(1);
    expect(issue(created.id).comments[0]).toMatchObject({ authorId: "u_alex", body: "Looks good" });
    state().deleteComment(created.id, issue(created.id).comments[0].id);
    expect(issue(created.id).comments).toEqual([]);
  });
});

describe("sprints", () => {
  it("completeSprint closes it and carries unfinished items to a new sprint", () => {
    const p = firstProject();
    const sprint = state().createSprint(p.id);
    expect(sprint.name).toMatch(new RegExp(`^${p.key} Sprint \\d+$`));
    const open = state().createIssue({ projectId: p.id, type: "task", summary: "open", sprintId: sprint.id });
    const done = state().createIssue({ projectId: p.id, type: "task", summary: "done", sprintId: sprint.id, status: "done" });
    state().completeSprint(sprint.id, "new");
    expect(state().sprints.find((s) => s.id === sprint.id)?.state).toBe("closed");
    const next = state().sprints.filter((s) => s.projectId === p.id).sort((x, y) => y.order - x.order)[0];
    expect(next.id).not.toBe(sprint.id);
    expect(next.state).toBe("future");
    expect(issue(open.id).sprintId).toBe(next.id);
    expect(issue(done.id).sprintId).toBe(sprint.id);
  });

  it("completeSprint to the backlog clears the sprint of open items", () => {
    const p = firstProject();
    const sprint = state().createSprint(p.id);
    const open = state().createIssue({ projectId: p.id, type: "task", summary: "open", sprintId: sprint.id });
    state().completeSprint(sprint.id, "backlog");
    expect(issue(open.id).sprintId).toBeUndefined();
  });
});

describe("timer", () => {
  it("startTimer stops the running entry first", () => {
    const first = state().startTimer({ description: "A" });
    expect(selectRunningEntry(state())?.id).toBe(first.id);
    const second = state().startTimer({ description: "B" });
    expect(state().timeEntries.find((t) => t.id === first.id)?.stop).toBeTruthy();
    expect(selectRunningEntry(state())?.id).toBe(second.id);
    state().stopTimer();
    expect(selectRunningEntry(state())).toBeUndefined();
  });

  it("discardTimer drops the running entry and continueEntry copies one", () => {
    const running = state().startTimer({ description: "Scratch" });
    state().discardTimer();
    expect(state().timeEntries.some((t) => t.id === running.id)).toBe(false);
    const pid = firstProject().id;
    const src = state().addTimeEntry({ description: "Yesterday", projectId: pid, tagIds: [], billable: true, start: "2026-03-10T09:00:00.000Z", stop: "2026-03-10T10:00:00.000Z" });
    state().continueEntry(src.id);
    const now = selectRunningEntry(state());
    expect(now?.id).not.toBe(src.id);
    expect(now).toMatchObject({ description: "Yesterday", projectId: pid, billable: true });
  });

  it("materializeEntry turns a virtual entry into a stored one", () => {
    const pid = firstProject().id;
    const virtual: TimeEntry = { id: "va_x_2026-03-02", userId: "u_alex", description: "Allocation 50%", projectId: pid, tagIds: [], billable: true, start: "2026-03-02T09:00:00.000Z", stop: "2026-03-02T13:00:00.000Z", virtual: true, allocationId: "x", percent: 50 };
    const real = state().materializeEntry(virtual);
    expect(real.id).not.toBe(virtual.id);
    expect(real.virtual).toBeUndefined();
    expect(real.allocationId).toBeUndefined();
    expect(real.percent).toBeUndefined();
    expect(real).toMatchObject({ userId: "u_alex", description: "Allocation 50%", projectId: pid, start: virtual.start, stop: virtual.stop });
    expect(state().timeEntries).toContain(real);
  });
});

describe("offers", () => {
  it("createOffer numbers from the project counter and starts as a draft", () => {
    const p = firstProject();
    const counter = p.offerCounter;
    const created = state().createOffer(p.id, { title: "  Quote  " });
    expect(created).toMatchObject({ number: `${p.key}-O${counter + 1}`, title: "Quote", status: "draft", ownerId: "u_alex", lines: [] });
    expect(project(p.id).offerCounter).toBe(counter + 1);
    expect(state().createOffer(p.id).title).toBe("Untitled offer");
  });

  it("lines can be added, edited, moved and removed with a compact order", () => {
    const o = state().createOffer(firstProject().id);
    const l1 = state().addOfferLine(o.id, { description: "One" });
    const l2 = state().addOfferLine(o.id, { description: "Two" });
    const l3 = state().addOfferLine(o.id, { description: "Three" });
    expect([l1.order, l2.order, l3.order]).toEqual([1, 2, 3]);
    expect(l1).toMatchObject({ unit: "days", qty: 1, hours: SETTINGS.hoursPerDay, issueType: "epic" });
    state().moveOfferLine(o.id, l3.id, 0);
    const orderOf = (id: string) => offer(o.id).lines.find((l) => l.id === id)?.order;
    expect([orderOf(l3.id), orderOf(l1.id), orderOf(l2.id)]).toEqual([1, 2, 3]);
    state().removeOfferLine(o.id, l1.id);
    expect(offer(o.id).lines.map((l) => [l.id, l.order])).toEqual([
      [l3.id, 1],
      [l2.id, 2],
    ]);
    state().updateOfferLine(o.id, l2.id, { qty: 3, unitPrice: 100 });
    expect(offerTotals(offer(o.id)).total).toBe(300);
  });

  it("convertOffer creates the work items, links the lines and activates a prospect", () => {
    const p = state().createProject({ key: "NEW", name: "New", type: "software", leadId: "u_alex", color: "#000000", billable: true, pricing: "fixed", timeMode: "timesheet", status: "prospect", billingRates: [], memberRates: {} });
    const o = state().createOffer(p.id, { title: "Quote" });
    const l1 = state().addOfferLine(o.id, { description: "Design", hours: 16, plannedStart: "2026-04-01", plannedEnd: "2026-04-10" });
    const l2 = state().addOfferLine(o.id, { description: "Build", hours: 40 });
    state().setOfferStatus(o.id, "accepted");
    expect(offer(o.id).acceptedAt).toBeTruthy();

    const created = state().convertOffer(o.id, [
      { lineId: l1.id, issueType: "epic", assigneeId: "u_giulia", include: true },
      { lineId: l2.id, issueType: "story", include: false },
    ]);
    expect(created).toHaveLength(1);
    const epic = issue(created[0].id);
    expect(epic).toMatchObject({ key: "NEW-1", type: "epic", summary: "Design", assigneeId: "u_giulia", originalEstimate: 16 * 3600, offerId: o.id, offerLineId: l1.id });
    expect(epic.labels).toContain(o.number);
    expect(parseISO(epic.startDate!).getTime()).toBe(new Date("2026-04-01").getTime());
    expect(parseISO(epic.dueDate!).getTime()).toBe(new Date("2026-04-10").getTime());

    const after = offer(o.id);
    expect(after.status).toBe("ordered");
    expect(after.orderedAt).toBeTruthy();
    expect(after.lines.find((l) => l.id === l1.id)?.issueId).toBe(epic.id);
    expect(after.lines.find((l) => l.id === l2.id)?.issueId).toBeUndefined();
    expect(project(p.id).status).toBe("active");

    // a line that already has a work item is never converted twice
    expect(state().convertOffer(o.id, [{ lineId: l1.id, issueType: "task", include: true }])).toEqual([]);
  });

  it("deleteOffer unlinks its work items", () => {
    const p = firstProject();
    const o = state().createOffer(p.id);
    const l1 = state().addOfferLine(o.id, { description: "Design" });
    const [created] = state().convertOffer(o.id, [{ lineId: l1.id, issueType: "task", include: true }]);
    state().deleteOffer(o.id);
    expect(state().offers.some((x) => x.id === o.id)).toBe(false);
    expect(issue(created.id).offerId).toBeUndefined();
    expect(issue(created.id).offerLineId).toBeUndefined();
  });
});

describe("projects, clients and tags", () => {
  it("deleteProject cascades to its content and detaches time entries", () => {
    const p = state().projects.find((x) => x.key === "JIG")!;
    const entriesBefore = state().timeEntries;
    const onProject = entriesBefore.filter((t) => t.projectId === p.id);
    expect(onProject.length).toBeGreaterThan(0);
    expect(state().offers.some((o) => o.projectId === p.id)).toBe(true);
    state().deleteProject(p.id);
    const s = state();
    expect(s.projects.some((x) => x.id === p.id)).toBe(false);
    expect(s.issues.some((i) => i.projectId === p.id)).toBe(false);
    expect(s.sprints.some((x) => x.projectId === p.id)).toBe(false);
    expect(s.offers.some((o) => o.projectId === p.id)).toBe(false);
    expect(s.allocations.some((a) => a.projectId === p.id)).toBe(false);
    expect(s.timeEntries).toHaveLength(entriesBefore.length);
    for (const t of onProject) expect(s.timeEntries.find((x) => x.id === t.id)).toMatchObject({ projectId: undefined, issueId: undefined });
  });

  it("deleteClient detaches its projects", () => {
    const client = state().clients[0];
    const linked = state().projects.filter((p) => p.clientId === client.id);
    expect(linked.length).toBeGreaterThan(0);
    state().deleteClient(client.id);
    expect(state().clients.some((c) => c.id === client.id)).toBe(false);
    for (const p of linked) expect(project(p.id).clientId).toBeUndefined();
  });

  it("addHoliday replaces a holiday on the same date", () => {
    state().addHoliday({ date: "2026-12-25", name: "Christmas" });
    state().addHoliday({ date: "2026-12-25", name: "Natale" });
    expect(state().holidays.filter((h) => h.date === "2026-12-25").map((h) => h.name)).toEqual(["Natale"]);
  });
});

describe("rates", () => {
  it("setUserCostRate applies from a date and keeps the history", () => {
    state().setUserCostRate("u_alex", 80, "2026-01-01");
    const u = state().users.find((x) => x.id === "u_alex")!;
    expect(rateAt(u.costRates, "2025-12-31")).toBe(50);
    expect(rateAt(u.costRates, "2026-02-01")).toBe(80);
  });

  it("member overrides can be set and reset per project", () => {
    const p = firstProject();
    state().setMemberRate(p.id, "u_alex", "billing", 150, EPOCH);
    expect(project(p.id).memberRates.u_alex.billing).toEqual([{ from: EPOCH, rate: 150 }]);
    state().setProjectBillingRate(p.id, 90, EPOCH);
    expect(rateAt(project(p.id).billingRates, "2026-01-01")).toBe(90);
    state().resetMemberRate(p.id, "u_alex", "billing");
    expect(project(p.id).memberRates.u_alex.billing).toBeUndefined();
  });
});

describe("ui", () => {
  it("recent projects keep the newest six, most recent first", () => {
    for (let i = 0; i < 8; i++) state().touchRecentProject(`p${i}`);
    state().touchRecentProject("p3");
    expect(state().ui.recentProjectIds).toEqual(["p3", "p7", "p6", "p5", "p4", "p2"]);
  });

  it("starring toggles", () => {
    state().toggleStarIssue("i1");
    expect(state().ui.starredIssueIds).toEqual(["i1"]);
    state().toggleStarIssue("i1");
    expect(state().ui.starredIssueIds).toEqual([]);
  });
});

describe("forecast and baselines", () => {
  it("activities are added, edited, valued and removed under a line", () => {
    const p = firstProject();
    const o = state().createOffer(p.id);
    const l = state().addOfferLine(o.id, { description: "Build", hours: 40 });
    const a = state().addForecastActivity(o.id, l.id, { name: "API" });
    const b = state().addForecastActivity(o.id, l.id);
    const acts = () => offer(o.id).lines[0].activities!;
    expect(acts().map((x) => [x.id, x.order])).toEqual([
      [a.id, 1],
      [b.id, 2],
    ]);
    state().setForecastEffort(o.id, l.id, a.id, "u_marco", 16);
    state().setForecastEffort(o.id, l.id, a.id, "u_sara", 8);
    state().setForecastEffort(o.id, l.id, a.id, "u_sara", 0);
    expect(acts()[0].effort).toEqual({ u_marco: 16 });
    state().updateForecastActivity(o.id, l.id, b.id, { name: "Tests", unsold: true });
    expect(acts()[1]).toMatchObject({ name: "Tests", unsold: true });
    state().removeForecastActivity(o.id, l.id, a.id);
    expect(acts()).toEqual([expect.objectContaining({ id: b.id, order: 1 })]);
  });

  it("editing the forecast keeps the other offers, lines and the baselines referentially equal", () => {
    const before = state();
    const o = before.offers.find((x) => x.id === "o_jig_1")!;
    const line = o.lines[0];
    before.setForecastEffort(o.id, line.id, line.activities![0].id, "u_alex", 99);
    const after = state();
    for (const x of after.offers) if (x.id !== o.id) expect(x).toBe(before.offers.find((y) => y.id === x.id));
    for (const l of offer(o.id).lines) if (l.id !== line.id) expect(l).toBe(o.lines.find((y) => y.id === l.id));
    expect(offer(o.id).lines[0].activities![0].effort.u_alex).toBe(99);
    expect(after.offerBaselines).toBe(before.offerBaselines);
    expect(after.issues).toBe(before.issues);
  });

  it("createBaseline freezes the offer with the rates in force and convertOffer takes the order baseline once", () => {
    const p = firstProject();
    const o = state().createOffer(p.id, { title: "Quote" });
    const l = state().addOfferLine(o.id, { description: "Design", hours: 16 });
    const a = state().addForecastActivity(o.id, l.id, { name: "Wireframes" });
    state().setForecastEffort(o.id, l.id, a.id, "u_marco", 16);
    const manual = state().createBaseline(o.id, { name: "  Sent  ", note: " why " })!;
    expect(manual).toMatchObject({ offerId: o.id, projectId: p.id, name: "Sent", note: "why", kind: "manual", createdBy: "u_alex" });
    expect(manual.costRates.u_marco).toBe(45);
    expect(manual.lines[0].activities![0].effort).toEqual({ u_marco: 16 });
    // the live offer moves on, the snapshot does not
    state().setForecastEffort(o.id, l.id, a.id, "u_marco", 40);
    expect(state().offerBaselines.find((b) => b.id === manual.id)!.lines[0].activities![0].effort).toEqual({ u_marco: 16 });
    expect(state().createBaseline("nope", { name: "x" })).toBeUndefined();

    state().setOfferStatus(o.id, "accepted");
    state().convertOffer(o.id, [{ lineId: l.id, issueType: "epic", include: true }]);
    const orderBaselines = () => state().offerBaselines.filter((b) => b.offerId === o.id && b.kind === "order");
    expect(orderBaselines()).toHaveLength(1);
    expect(orderBaselines()[0]).toMatchObject({ name: "Order", createdBy: "u_alex" });
    const orderedAt = offer(o.id).orderedAt;
    expect(orderedAt).toBeTruthy();

    // a line added to the order gets its work item later, without a second order baseline or a new order date
    const l2 = state().addOfferLine(o.id, { description: "Extra scope" });
    expect(offer(o.id).status).toBe("ordered");
    state().convertOffer(o.id, [{ lineId: l2.id, issueType: "task", include: true }]);
    expect(orderBaselines()).toHaveLength(1);
    expect(offer(o.id).orderedAt).toBe(orderedAt);
    expect(offer(o.id).lines.every((x) => x.issueId)).toBe(true);

    state().deleteOffer(o.id);
    expect(state().offerBaselines.some((b) => b.offerId === o.id)).toBe(false);
  });

  it("deleteBaseline and deleteProject drop the baselines", () => {
    const b = state().offerBaselines[0];
    expect(b).toBeDefined();
    state().deleteBaseline(b.id);
    expect(state().offerBaselines.some((x) => x.id === b.id)).toBe(false);
    const pid = state().offerBaselines[0].projectId;
    state().deleteProject(pid);
    expect(state().offerBaselines.some((x) => x.projectId === pid)).toBe(false);
  });

  it("the forecast unit is a persisted UI preference", () => {
    expect(state().ui.forecastUnit).toBe("hours");
    state().setForecastUnit("days");
    expect(state().ui.forecastUnit).toBe("days");
  });
});

describe("line dependencies", () => {
  it("a line after another gets its dates from it, follows it when it moves and is freed when it is removed", () => {
    const p = firstProject();
    const o = state().createOffer(p.id);
    const a = state().addOfferLine(o.id, { description: "Design", hours: 16, plannedStart: "2026-04-01", plannedEnd: "2026-04-03" });
    const b = state().addOfferLine(o.id, { description: "Build", hours: 40 });
    const lineOf = (id: string) => offer(o.id).lines.find((l) => l.id === id)!;
    state().updateOfferLine(o.id, b.id, { predecessorId: a.id });
    // 6 April 2026 is a holiday of the demo workspace: the line starts on the 7th, 40h = 5 working days
    expect(lineOf(b.id)).toMatchObject({ plannedStart: "2026-04-07", plannedEnd: "2026-04-13" });
    // the predecessor moves: the dependent keeps its 5 working days
    state().updateOfferLine(o.id, a.id, { plannedEnd: "2026-04-08" });
    expect(lineOf(b.id)).toMatchObject({ plannedStart: "2026-04-09", plannedEnd: "2026-04-15" });
    // a lag of two working days
    state().updateOfferLine(o.id, b.id, { lagDays: 2 });
    expect(lineOf(b.id).plannedStart).toBe("2026-04-13");
    // untouched offers keep their identity
    const before = state();
    state().updateOfferLine(o.id, a.id, { description: "Design v2" });
    for (const x of state().offers) if (x.id !== o.id) expect(x).toBe(before.offers.find((y) => y.id === x.id));
    state().removeOfferLine(o.id, a.id);
    expect(lineOf(b.id).predecessorId).toBeUndefined();
    expect(lineOf(b.id).plannedStart).toBe("2026-04-13");
  });

  it("holidays of the workspace are skipped", () => {
    const p = firstProject();
    const o = state().createOffer(p.id);
    state().addHoliday({ date: "2026-04-06", name: "Easter Monday" });
    const a = state().addOfferLine(o.id, { hours: 8, plannedStart: "2026-04-02", plannedEnd: "2026-04-03" });
    const b = state().addOfferLine(o.id, { hours: 8, predecessorId: a.id });
    expect(offer(o.id).lines.find((l) => l.id === b.id)).toMatchObject({ plannedStart: "2026-04-07", plannedEnd: "2026-04-07" });
  });

  it("optional table columns are toggled per table", () => {
    state().toggleTableColumn("offerLines", "details");
    state().toggleTableColumn("forecast", "note");
    expect(state().ui.tableColumns).toEqual({ offerLines: ["details"], forecast: ["note"] });
    state().toggleTableColumn("offerLines", "details");
    expect(state().ui.tableColumns.offerLines).toEqual([]);
  });
});

describe("project teams and members", () => {
  it("a project is open until a team is chosen; the lead is never listed twice nor removed", () => {
    const p = firstProject();
    expect(p.memberIds ?? undefined).toBeDefined(); // the demo client projects have explicit teams
    const open = state().createProject({ key: "OPN", name: "Open", type: "software", leadId: "u_alex", color: "#000", billable: true, pricing: "fixed", timeMode: "timesheet", status: "active", billingRates: [], memberRates: {} });
    expect(project(open.id).memberIds).toBeUndefined();
    state().addProjectMember(open.id, "u_sara");
    expect(project(open.id).memberIds).toEqual(["u_sara"]);
    state().setProjectTeam(open.id, ["u_alex", "u_marco", "u_marco"]);
    expect(project(open.id).memberIds).toEqual(["u_marco"]);
    state().removeProjectMember(open.id, "u_alex");
    state().removeProjectMember(open.id, "u_marco");
    expect(project(open.id).memberIds).toEqual([]);
    state().setProjectTeam(open.id, undefined);
    expect(project(open.id).memberIds).toBeUndefined();
  });

  it("converting an offer adds the planned people to an explicit team, and leaves an open project open", () => {
    const p = state().createProject({ key: "TM", name: "Team", type: "software", leadId: "u_alex", color: "#000", billable: true, pricing: "fixed", timeMode: "timesheet", status: "prospect", billingRates: [], memberRates: {} });
    state().setProjectTeam(p.id, ["u_giulia"]);
    const o = state().createOffer(p.id);
    const l = state().addOfferLine(o.id, { description: "Build", hours: 8 });
    const a = state().addForecastActivity(o.id, l.id, { name: "Dev" });
    state().setForecastEffort(o.id, l.id, a.id, "u_luca", 8);
    state().setForecastEffort(o.id, l.id, a.id, "u_alex", 2);
    state().setOfferStatus(o.id, "accepted");
    state().convertOffer(o.id, [{ lineId: l.id, issueType: "epic", include: true }]);
    expect(project(p.id).memberIds).toEqual(["u_giulia", "u_luca"]);
    expect(project(p.id).status).toBe("active");

    const q = state().createProject({ key: "OP", name: "Open", type: "software", leadId: "u_alex", color: "#000", billable: true, pricing: "fixed", timeMode: "timesheet", status: "active", billingRates: [], memberRates: {} });
    const o2 = state().createOffer(q.id);
    const l2 = state().addOfferLine(o2.id, { description: "Build", hours: 8 });
    const a2 = state().addForecastActivity(o2.id, l2.id);
    state().setForecastEffort(o2.id, l2.id, a2.id, "u_luca", 8);
    state().convertOffer(o2.id, [{ lineId: l2.id, issueType: "epic", include: true }]);
    expect(project(q.id).memberIds).toBeUndefined();
  });

  it("addUser keeps a server-issued id and replaces a member with the same id", () => {
    const u = state().addUser({ id: "srv_1", name: "New", email: "new@example.com", color: "#000", role: "member", costRates: [], linked: true });
    expect(u.id).toBe("srv_1");
    expect(state().users.filter((x) => x.id === "srv_1")).toHaveLength(1);
    state().addUser({ id: "srv_1", name: "Newer", email: "new@example.com", color: "#000", role: "pm", costRates: [] });
    expect(state().users.filter((x) => x.id === "srv_1")).toHaveLength(1);
    expect(state().users.find((x) => x.id === "srv_1")!.name).toBe("Newer");
    expect(state().addUser({ name: "Auto", email: "auto@example.com", color: "#000", role: "member", costRates: [] }).id).toHaveLength(8);
  });

  it("holidays can be ranges and a company closure blocks dependent lines", () => {
    state().addHoliday({ date: "2026-05-04", to: "2026-05-08", name: "Closure", kind: "closure" });
    state().addHoliday({ date: "2026-05-04", to: "2026-05-08", name: "Closure again", kind: "closure" });
    expect(state().holidays.filter((h) => h.date === "2026-05-04")).toHaveLength(1);
    const p = firstProject();
    const o = state().createOffer(p.id);
    const a = state().addOfferLine(o.id, { hours: 8, plannedStart: "2026-04-30", plannedEnd: "2026-04-30" });
    const b = state().addOfferLine(o.id, { hours: 8, predecessorId: a.id });
    expect(offer(o.id).lines.find((l) => l.id === b.id)!.plannedStart).toBe("2026-05-11");
  });
});

describe("removeUser", () => {
  it("drops the member and cleans teams, rate overrides and watchers, touching nothing else", () => {
    const id = "u_elena";
    // make sure every kind of soft reference exists
    const target = state().issues[0];
    state().updateIssue(target.id, { watchers: [...target.watchers, id] });
    const before = { projects: state().projects, issues: state().issues, entries: state().timeEntries };
    expect(before.projects.some((p) => id in (p.memberRates ?? {}))).toBe(true);
    state().removeUser(id);
    expect(state().users.some((u) => u.id === id)).toBe(false);
    for (const p of state().projects) {
      const old = before.projects.find((x) => x.id === p.id)!;
      expect(p.memberIds ?? []).not.toContain(id);
      expect(p.memberRates ?? {}).not.toHaveProperty(id);
      if (!old.memberIds?.includes(id) && !(id in (old.memberRates ?? {}))) expect(p).toBe(old);
    }
    for (const i of state().issues) {
      const old = before.issues.find((x) => x.id === i.id)!;
      if (old.watchers.includes(id)) expect(i.watchers).not.toContain(id);
      else expect(i).toBe(old);
    }
    expect(state().timeEntries).toBe(before.entries);
  });
});
