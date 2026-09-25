import { addHours, parseISO } from "date-fns";
import type { Allocation, ForecastActivity, Issue, Offer, OfferBaseline, OfferLine, Project, TimeEntry, User, WorkspaceSettings } from "@/lib/types";

/** Builders for unit tests: sensible defaults, override what the test cares about. */

export const SETTINGS: WorkspaceSettings = { name: "Test workspace", currency: "EUR", hoursPerDay: 8, workDays: [1, 2, 3, 4, 5], dayStart: "09:00" };

export function makeUser(patch: Partial<User> = {}): User {
  return { id: "u1", name: "Ada Lovelace", email: "ada@example.com", color: "#0C66E4", role: "member", costRates: [{ from: "2024-01-01", rate: 50 }], ...patch };
}

export function makeProject(patch: Partial<Project> = {}): Project {
  return {
    id: "p1",
    key: "P",
    name: "Project",
    type: "software",
    leadId: "u1",
    color: "#0b83d9",
    billable: true,
    pricing: "fixed",
    timeMode: "timesheet",
    status: "active",
    billingRates: [{ from: "2024-01-01", rate: 100 }],
    memberRates: {},
    issueCounter: 0,
    offerCounter: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...patch,
  };
}

export function makeIssue(patch: Partial<Issue> & { id: string }): Issue {
  return {
    key: `P-${patch.id}`,
    projectId: "p1",
    type: "task",
    summary: patch.id,
    status: "todo",
    priority: "medium",
    reporterId: "u1",
    labels: [],
    rank: 1,
    comments: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    watchers: [],
    ...patch,
  };
}

/** A stopped entry lasting `hours` from `start` (ISO). Omit `hours` for a running one. */
export function makeEntry(patch: Partial<TimeEntry> & { id: string; start: string; hours?: number }): TimeEntry {
  const { hours, ...rest } = patch;
  return {
    userId: "u1",
    description: patch.id,
    projectId: "p1",
    tagIds: [],
    billable: true,
    stop: hours === undefined ? undefined : addHours(parseISO(patch.start), hours).toISOString(),
    ...rest,
  };
}

export function makeLine(patch: Partial<OfferLine> & { id: string }): OfferLine {
  return { description: patch.id, qty: 1, unit: "hours", unitPrice: 100, hours: 1, issueType: "epic", order: 1, ...patch };
}

export function makeOffer(patch: Partial<Offer> & { id: string }): Offer {
  return {
    projectId: "p1",
    number: `P-O${patch.id}`,
    title: patch.id,
    status: "draft",
    ownerId: "u1",
    issueDate: "2026-01-01",
    lines: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

export function makeActivity(patch: Partial<ForecastActivity> & { id: string }): ForecastActivity {
  return { name: patch.id, effort: {}, order: 1, ...patch };
}

export function makeBaseline(patch: Partial<OfferBaseline> & { id: string }): OfferBaseline {
  return { offerId: "o1", projectId: "p1", name: patch.id, kind: "manual", createdAt: "2026-01-15T00:00:00.000Z", createdBy: "u1", lines: [], costRates: {}, billingRates: {}, ...patch };
}

export function makeAllocation(patch: Partial<Allocation> & { id: string }): Allocation {
  return { projectId: "p1", userId: "u1", percent: 50, from: "2026-03-02", ...patch };
}
