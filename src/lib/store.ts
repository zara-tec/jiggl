"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import { formatISO } from "date-fns";
import type {
  Allocation,
  BaselineKind,
  Client,
  Comment,
  ForecastActivity,
  Holiday,
  ID,
  TimeOff,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueType,
  Offer,
  OfferBaseline,
  OfferLine,
  OfferStatus,
  Project,
  Sprint,
  Tag,
  TimeEntry,
  User,
  WorkspaceSettings,
} from "./types";
import { applyRate } from "./rates";
import { captureBaseline } from "./forecast";
import { scheduleLines } from "./schedule";
import { forecastMembers } from "./forecast";
import { withTeamMembers } from "./team";

const nowIso = () => formatISO(new Date());

export interface CreateIssueInput {
  projectId: ID;
  type: IssueType;
  summary: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: ID;
  labels?: string[];
  sprintId?: ID;
  parentId?: ID;
  storyPoints?: number;
  originalEstimate?: number;
  dueDate?: string;
}

export interface TimerDraft {
  description: string;
  projectId?: ID;
  issueId?: ID;
  tagIds: ID[];
  billable: boolean;
}

export interface SessionInfo {
  accountId: string;
  accountEmail: string;
  memberId: string;
  workspaceId: string;
  workspaceName: string;
  workspaces: { id: string; name: string; role: string }[];
}

export interface BootstrapPayload {
  session: SessionInfo;
  data: {
    settings: WorkspaceSettings;
    users: User[];
    clients: Client[];
    tags: Tag[];
    projects: Project[];
    sprints: Sprint[];
    issues: Issue[];
    timeEntries: TimeEntry[];
    offers: Offer[];
    offerBaselines: OfferBaseline[];
    allocations: Allocation[];
    holidays: Holiday[];
    timeOffs: TimeOff[];
  };
}

export interface UIState {
  sidebarCollapsed: boolean;
  recentIssueIds: ID[];
  recentProjectIds: ID[];
  starredIssueIds: ID[];
  createIssueOpen: boolean;
  createIssueDefaults?: Partial<CreateIssueInput>;
  timerDraft: TimerDraft;
  timerMode: "timer" | "manual";
  /** Unit of the cells in the forecast matrix */
  forecastUnit: "hours" | "days";
  /** Optional columns currently shown, per table ("offerLines", "forecast") */
  tableColumns: Record<string, string[]>;
}

export interface AppState {
  /** True once the workspace has been loaded from the server */
  bootstrapped: boolean;
  /** True while a remote payload is being applied (sync must not echo it back) */
  applyingRemote: boolean;
  session: SessionInfo | null;
  settings: WorkspaceSettings;
  users: User[];
  currentUserId: ID;
  clients: Client[];
  tags: Tag[];
  projects: Project[];
  sprints: Sprint[];
  issues: Issue[];
  timeEntries: TimeEntry[];
  offers: Offer[];
  offerBaselines: OfferBaseline[];
  allocations: Allocation[];
  holidays: Holiday[];
  timeOffs: TimeOff[];
  ui: UIState;

  // ui
  toggleSidebar: () => void;
  openCreateIssue: (defaults?: Partial<CreateIssueInput>) => void;
  closeCreateIssue: () => void;
  touchRecentIssue: (id: ID) => void;
  touchRecentProject: (id: ID) => void;
  toggleStarIssue: (id: ID) => void;
  setTimerDraft: (patch: Partial<TimerDraft>) => void;
  setTimerMode: (mode: "timer" | "manual") => void;
  setForecastUnit: (unit: "hours" | "days") => void;
  toggleTableColumn: (table: string, column: string) => void;

  // projects
  createProject: (input: Omit<Project, "id" | "issueCounter" | "offerCounter" | "createdAt">) => Project;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  toggleStarProject: (id: ID) => void;
  deleteProject: (id: ID) => void;

  // issues
  createIssue: (input: CreateIssueInput) => Issue;
  updateIssue: (id: ID, patch: Partial<Issue>) => void;
  deleteIssue: (id: ID) => void;
  reorderIssue: (id: ID, target: { status?: IssueStatus; sprintId?: ID | null; beforeId?: ID | null; afterId?: ID | null }) => void;
  addComment: (issueId: ID, body: string) => void;
  deleteComment: (issueId: ID, commentId: ID) => void;

  // sprints
  createSprint: (projectId: ID) => Sprint;
  updateSprint: (id: ID, patch: Partial<Sprint>) => void;
  startSprint: (id: ID, data: { name: string; goal?: string; startDate: string; endDate: string }) => void;
  completeSprint: (id: ID, moveTo: ID | "backlog" | "new") => void;
  deleteSprint: (id: ID) => void;

  // time
  startTimer: (draft?: Partial<TimerDraft>) => TimeEntry;
  stopTimer: () => void;
  discardTimer: () => void;
  updateRunning: (patch: Partial<TimeEntry>) => void;
  addTimeEntry: (entry: Omit<TimeEntry, "id" | "userId"> & { userId?: ID }) => TimeEntry;
  updateTimeEntry: (id: ID, patch: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: ID) => void;
  continueEntry: (id: ID) => void;

  // clients / tags / users
  createClient: (name: string) => Client;
  updateClient: (id: ID, patch: Partial<Client>) => void;
  deleteClient: (id: ID) => void;
  createTag: (name: string) => Tag;
  deleteTag: (id: ID) => void;
  /** Add a member; `id` is given when the server created the row first (invite with a welcome password) */
  addUser: (input: Omit<User, "id"> & { id?: ID }) => User;
  updateUser: (id: ID, patch: Partial<User>) => void;
  /** Drop a member the server has just removed, with the references that do not block removal (teams, rate overrides, watchers) */
  removeUser: (id: ID) => void;
  /** Explicit team of a project (the lead is always in); undefined opens the project to everyone */
  setProjectTeam: (projectId: ID, memberIds: ID[] | undefined) => void;
  addProjectMember: (projectId: ID, userId: ID) => void;
  removeProjectMember: (projectId: ID, userId: ID) => void;

  // offers
  createOffer: (projectId: ID, input?: Partial<Pick<Offer, "title" | "ownerId" | "validUntil">>) => Offer;
  updateOffer: (id: ID, patch: Partial<Offer>) => void;
  deleteOffer: (id: ID) => void;
  setOfferStatus: (id: ID, status: OfferStatus) => void;
  addOfferLine: (offerId: ID, input?: Partial<OfferLine>) => OfferLine;
  updateOfferLine: (offerId: ID, lineId: ID, patch: Partial<OfferLine>) => void;
  removeOfferLine: (offerId: ID, lineId: ID) => void;
  moveOfferLine: (offerId: ID, lineId: ID, toIndex: number) => void;
  /** Convert an accepted offer into work items (or create the items of lines added to an order). Returns the created issues. */
  convertOffer: (offerId: ID, mapping: { lineId: ID; issueType: "epic" | "story" | "task"; assigneeId?: ID; include: boolean }[]) => Issue[];

  // forecast (activities under a line, effort per member) and baselines
  addForecastActivity: (offerId: ID, lineId: ID, input?: Partial<ForecastActivity>) => ForecastActivity;
  updateForecastActivity: (offerId: ID, lineId: ID, activityId: ID, patch: Partial<ForecastActivity>) => void;
  removeForecastActivity: (offerId: ID, lineId: ID, activityId: ID) => void;
  /** Set the forecast hours of a member on an activity; 0 removes the member from it */
  setForecastEffort: (offerId: ID, lineId: ID, activityId: ID, userId: ID, hours: number) => void;
  /** Freeze the offer (lines, forecast, rates) as a named baseline */
  createBaseline: (offerId: ID, input: { name: string; note?: string; kind?: BaselineKind }) => OfferBaseline | undefined;
  deleteBaseline: (id: ID) => void;

  // allocations, holidays, time off
  addAllocation: (input: Omit<Allocation, "id">) => Allocation;
  updateAllocation: (id: ID, patch: Partial<Allocation>) => void;
  removeAllocation: (id: ID) => void;
  addHoliday: (input: Omit<Holiday, "id">) => void;
  removeHoliday: (id: ID) => void;
  addTimeOff: (input: Omit<TimeOff, "id">) => void;
  removeTimeOff: (id: ID) => void;
  /** Turn a virtual (allocated) entry into a real, editable one for that day */
  materializeEntry: (entry: TimeEntry) => TimeEntry;

  // settings & rates
  updateSettings: (patch: Partial<WorkspaceSettings>) => void;
  setUserCostRate: (userId: ID, rate: number, applyFrom: string) => void;
  setProjectBillingRate: (projectId: ID, rate: number, applyFrom: string) => void;
  setMemberRate: (projectId: ID, userId: ID, kind: "cost" | "billing", rate: number, applyFrom: string) => void;
  resetMemberRate: (projectId: ID, userId: ID, kind: "cost" | "billing") => void;

  /** Load (or reload) the current workspace from the server. Returns the HTTP status. */
  loadWorkspace: () => Promise<number>;
  applyBootstrap: (payload: BootstrapPayload) => void;
  /** Replace the workspace content with the demo dataset (server side), then reload */
  resetDemo: () => Promise<void>;
}

const defaultSettings = (): WorkspaceSettings => ({ name: "Jiggl demo", currency: "EUR", hoursPerDay: 8, workDays: [1, 2, 3, 4, 5], dayStart: "09:00" });

const defaultUI = (): UIState => ({
  sidebarCollapsed: false,
  recentIssueIds: [],
  recentProjectIds: [],
  starredIssueIds: [],
  createIssueOpen: false,
  createIssueDefaults: undefined,
  timerDraft: { description: "", tagIds: [], billable: false },
  timerMode: "timer",
  forecastUnit: "hours",
  tableColumns: {},
});

function pushRecent(list: ID[], id: ID, max = 12) {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Lines with the dates of dependent lines recomputed from their predecessors (same array when nothing moves) */
function scheduled(s: Pick<AppState, "settings" | "holidays">, lines: Offer["lines"]): Offer["lines"] {
  return scheduleLines(lines, { cal: { workDays: s.settings.workDays, holidays: s.holidays }, hoursPerDay: s.settings.hoursPerDay });
}

/** Offers with the activities of one line replaced; other offers and lines keep their identity */
function withActivities(s: Pick<AppState, "offers">, offerId: ID, lineId: ID, fn: (activities: ForecastActivity[]) => ForecastActivity[]): Offer[] {
  return s.offers.map((o) => (o.id === offerId ? { ...o, updatedAt: nowIso(), lines: o.lines.map((l) => (l.id === lineId ? { ...l, activities: fn(l.activities ?? []) } : l)) } : o));
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      bootstrapped: false,
      applyingRemote: false,
      session: null,
      settings: defaultSettings(),
      users: [],
      currentUserId: "",
      clients: [],
      tags: [],
      projects: [],
      sprints: [],
      issues: [],
      timeEntries: [],
      offers: [],
      offerBaselines: [],
      allocations: [],
      holidays: [],
      timeOffs: [],
      ui: defaultUI(),

      /* ---------------- UI ---------------- */
      toggleSidebar: () => set((s) => ({ ui: { ...s.ui, sidebarCollapsed: !s.ui.sidebarCollapsed } })),
      openCreateIssue: (defaults) => set((s) => ({ ui: { ...s.ui, createIssueOpen: true, createIssueDefaults: defaults } })),
      closeCreateIssue: () => set((s) => ({ ui: { ...s.ui, createIssueOpen: false, createIssueDefaults: undefined } })),
      touchRecentIssue: (id) => set((s) => ({ ui: { ...s.ui, recentIssueIds: pushRecent(s.ui.recentIssueIds, id) } })),
      touchRecentProject: (id) => set((s) => ({ ui: { ...s.ui, recentProjectIds: pushRecent(s.ui.recentProjectIds, id, 6) } })),
      toggleStarIssue: (id) =>
        set((s) => ({
          ui: {
            ...s.ui,
            starredIssueIds: s.ui.starredIssueIds.includes(id)
              ? s.ui.starredIssueIds.filter((x) => x !== id)
              : [...s.ui.starredIssueIds, id],
          },
        })),
      setTimerDraft: (patch) => set((s) => ({ ui: { ...s.ui, timerDraft: { ...s.ui.timerDraft, ...patch } } })),
      setTimerMode: (mode) => set((s) => ({ ui: { ...s.ui, timerMode: mode } })),
      setForecastUnit: (unit) => set((s) => ({ ui: { ...s.ui, forecastUnit: unit } })),
      toggleTableColumn: (table, column) =>
        set((s) => {
          const cur = s.ui.tableColumns?.[table] ?? [];
          return { ui: { ...s.ui, tableColumns: { ...(s.ui.tableColumns ?? {}), [table]: cur.includes(column) ? cur.filter((c) => c !== column) : [...cur, column] } } };
        }),

      /* ---------------- Projects ---------------- */
      createProject: (input) => {
        const project: Project = { ...input, id: nanoid(8), issueCounter: 0, offerCounter: 0, createdAt: nowIso() };
        set((s) => ({ projects: [...s.projects, project] }));
        return project;
      },
      updateProject: (id, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      toggleStarProject: (id) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, starred: !p.starred } : p)) })),
      deleteProject: (id) =>
        set((s) => ({
          offers: s.offers.filter((o) => o.projectId !== id),
          offerBaselines: s.offerBaselines.filter((b) => b.projectId !== id),
          allocations: s.allocations.filter((a) => a.projectId !== id),
          projects: s.projects.filter((p) => p.id !== id),
          issues: s.issues.filter((i) => i.projectId !== id),
          sprints: s.sprints.filter((sp) => sp.projectId !== id),
          timeEntries: s.timeEntries.map((t) => (t.projectId === id ? { ...t, projectId: undefined, issueId: undefined } : t)),
        })),

      /* ---------------- Issues ---------------- */
      createIssue: (input) => {
        const s = get();
        const project = s.projects.find((p) => p.id === input.projectId);
        if (!project) throw new Error("Project not found");
        const num = project.issueCounter + 1;
        const maxRank = s.issues.reduce((m, i) => Math.max(m, i.rank), 0);
        const issue: Issue = {
          id: nanoid(8),
          key: `${project.key}-${num}`,
          projectId: input.projectId,
          type: input.type,
          summary: input.summary.trim(),
          description: input.description,
          status: input.status ?? "todo",
          priority: input.priority ?? "medium",
          assigneeId: input.assigneeId,
          reporterId: s.currentUserId,
          labels: input.labels ?? [],
          sprintId: input.sprintId,
          parentId: input.parentId,
          storyPoints: input.storyPoints,
          originalEstimate: input.originalEstimate,
          dueDate: input.dueDate,
          rank: maxRank + 1,
          comments: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
          watchers: [s.currentUserId],
        };
        set((st) => ({
          issues: [...st.issues, issue],
          projects: st.projects.map((p) => (p.id === project.id ? { ...p, issueCounter: num } : p)),
        }));
        return issue;
      },
      updateIssue: (id, patch) =>
        set((s) => ({
          issues: s.issues.map((i) => {
            if (i.id !== id) return i;
            const next = { ...i, ...patch, updatedAt: nowIso() };
            if (patch.status === "done" && i.status !== "done") next.resolvedAt = nowIso();
            if (patch.status && patch.status !== "done") next.resolvedAt = undefined;
            return next;
          }),
        })),
      deleteIssue: (id) =>
        set((s) => ({
          issues: s.issues.filter((i) => i.id !== id && i.parentId !== id),
          timeEntries: s.timeEntries.map((t) => (t.issueId === id ? { ...t, issueId: undefined } : t)),
        })),
      reorderIssue: (id, target) =>
        set((s) => {
          const issue = s.issues.find((i) => i.id === id);
          if (!issue) return {};
          let rank = issue.rank;
          const sorted = [...s.issues].sort((a, b) => a.rank - b.rank);
          if (target.beforeId) {
            const before = sorted.find((i) => i.id === target.beforeId);
            if (before) {
              const idx = sorted.indexOf(before);
              const prev = sorted[idx - 1];
              rank = prev ? (prev.rank + before.rank) / 2 : before.rank - 1;
            }
          } else if (target.afterId) {
            const after = sorted.find((i) => i.id === target.afterId);
            if (after) {
              const idx = sorted.indexOf(after);
              const next = sorted[idx + 1];
              rank = next ? (after.rank + next.rank) / 2 : after.rank + 1;
            }
          } else if (target.afterId === null || target.beforeId === null) {
            rank = sorted[sorted.length - 1].rank + 1;
          }
          return {
            issues: s.issues.map((i) =>
              i.id === id
                ? {
                    ...i,
                    rank,
                    status: target.status ?? i.status,
                    sprintId: target.sprintId === undefined ? i.sprintId : target.sprintId ?? undefined,
                    updatedAt: nowIso(),
                    resolvedAt: target.status === "done" ? i.resolvedAt ?? nowIso() : target.status ? undefined : i.resolvedAt,
                  }
                : i,
            ),
          };
        }),
      addComment: (issueId, body) =>
        set((s) => {
          const comment: Comment = { id: nanoid(8), authorId: s.currentUserId, body, createdAt: nowIso() };
          return {
            issues: s.issues.map((i) => (i.id === issueId ? { ...i, comments: [...i.comments, comment], updatedAt: nowIso() } : i)),
          };
        }),
      deleteComment: (issueId, commentId) =>
        set((s) => ({
          issues: s.issues.map((i) => (i.id === issueId ? { ...i, comments: i.comments.filter((c) => c.id !== commentId) } : i)),
        })),

      /* ---------------- Sprints ---------------- */
      createSprint: (projectId) => {
        const s = get();
        const project = s.projects.find((p) => p.id === projectId)!;
        const existing = s.sprints.filter((sp) => sp.projectId === projectId);
        const order = existing.reduce((m, sp) => Math.max(m, sp.order), 0) + 1;
        const sprint: Sprint = { id: nanoid(8), projectId, name: `${project.key} Sprint ${order}`, state: "future", order };
        set((st) => ({ sprints: [...st.sprints, sprint] }));
        return sprint;
      },
      updateSprint: (id, patch) => set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)) })),
      startSprint: (id, data) =>
        set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? { ...sp, ...data, state: "active" } : sp)) })),
      completeSprint: (id, moveTo) =>
        set((s) => {
          const sprint = s.sprints.find((sp) => sp.id === id);
          if (!sprint) return {};
          let sprints = s.sprints.map((sp) => (sp.id === id ? { ...sp, state: "closed" as const } : sp));
          let targetSprintId: ID | undefined;
          if (moveTo === "new") {
            const order = s.sprints.filter((sp) => sp.projectId === sprint.projectId).reduce((m, sp) => Math.max(m, sp.order), 0) + 1;
            const project = s.projects.find((p) => p.id === sprint.projectId)!;
            const ns: Sprint = { id: nanoid(8), projectId: sprint.projectId, name: `${project.key} Sprint ${order}`, state: "future", order };
            sprints = [...sprints, ns];
            targetSprintId = ns.id;
          } else if (moveTo !== "backlog") {
            targetSprintId = moveTo;
          }
          return {
            sprints,
            issues: s.issues.map((i) => (i.sprintId === id && i.status !== "done" ? { ...i, sprintId: targetSprintId } : i)),
          };
        }),
      deleteSprint: (id) =>
        set((s) => ({
          sprints: s.sprints.filter((sp) => sp.id !== id),
          issues: s.issues.map((i) => (i.sprintId === id ? { ...i, sprintId: undefined } : i)),
        })),

      /* ---------------- Time ---------------- */
      startTimer: (draft) => {
        const s = get();
        // stop any running entry first
        const running = s.timeEntries.find((t) => t.userId === s.currentUserId && !t.stop);
        const d = { ...s.ui.timerDraft, ...draft };
        const entry: TimeEntry = {
          id: nanoid(8),
          userId: s.currentUserId,
          description: d.description ?? "",
          projectId: d.projectId,
          issueId: d.issueId,
          tagIds: d.tagIds ?? [],
          billable: d.billable ?? false,
          start: nowIso(),
        };
        set((st) => ({
          timeEntries: [
            ...st.timeEntries.map((t) => (running && t.id === running.id ? { ...t, stop: nowIso() } : t)),
            entry,
          ],
          ui: { ...st.ui, timerDraft: { description: "", tagIds: [], billable: false } },
        }));
        return entry;
      },
      stopTimer: () =>
        set((s) => ({
          timeEntries: s.timeEntries.map((t) => (t.userId === s.currentUserId && !t.stop ? { ...t, stop: nowIso() } : t)),
        })),
      discardTimer: () =>
        set((s) => ({ timeEntries: s.timeEntries.filter((t) => !(t.userId === s.currentUserId && !t.stop)) })),
      updateRunning: (patch) =>
        set((s) => ({
          timeEntries: s.timeEntries.map((t) => (t.userId === s.currentUserId && !t.stop ? { ...t, ...patch } : t)),
        })),
      addTimeEntry: (entry) => {
        const s = get();
        const te: TimeEntry = { ...entry, id: nanoid(8), userId: entry.userId ?? s.currentUserId };
        set((st) => ({ timeEntries: [...st.timeEntries, te] }));
        return te;
      },
      updateTimeEntry: (id, patch) => set((s) => ({ timeEntries: s.timeEntries.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTimeEntry: (id) => set((s) => ({ timeEntries: s.timeEntries.filter((t) => t.id !== id) })),
      continueEntry: (id) => {
        const s = get();
        const src = s.timeEntries.find((t) => t.id === id);
        if (!src) return;
        get().startTimer({
          description: src.description,
          projectId: src.projectId,
          issueId: src.issueId,
          tagIds: src.tagIds,
          billable: src.billable,
        });
      },

      /* ---------------- Clients / tags / users ---------------- */
      createClient: (name) => {
        const client: Client = { id: nanoid(8), name: name.trim() };
        set((s) => ({ clients: [...s.clients, client] }));
        return client;
      },
      updateClient: (id, patch) => set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          projects: s.projects.map((p) => (p.clientId === id ? { ...p, clientId: undefined } : p)),
        })),
      createTag: (name) => {
        const tag: Tag = { id: nanoid(8), name: name.trim() };
        set((s) => ({ tags: [...s.tags, tag] }));
        return tag;
      },
      deleteTag: (id) =>
        set((s) => ({
          tags: s.tags.filter((t) => t.id !== id),
          timeEntries: s.timeEntries.map((t) => (t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t)),
        })),
      addUser: (input) => {
        const { id, ...rest } = input;
        const user: User = { ...rest, id: id ?? nanoid(8) };
        set((s) => ({ users: [...s.users.filter((u) => u.id !== user.id), user] }));
        return user;
      },
      setProjectTeam: (projectId, memberIds) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? { ...p, memberIds: memberIds ? memberIds.filter((x, i, a) => x !== p.leadId && a.indexOf(x) === i) : undefined } : p)) })),
      addProjectMember: (projectId, userId) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? withTeamMembers({ ...p, memberIds: p.memberIds ?? [] }, [userId]) : p)) })),
      removeProjectMember: (projectId, userId) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === projectId && p.memberIds?.includes(userId) ? { ...p, memberIds: p.memberIds.filter((x) => x !== userId) } : p)) })),
      updateUser: (id, patch) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      removeUser: (id) =>
        set((s) => ({
          users: s.users.filter((u) => u.id !== id),
          projects: s.projects.map((p) => {
            if (!p.memberIds?.includes(id) && !(id in (p.memberRates ?? {}))) return p;
            const memberRates = { ...p.memberRates };
            delete memberRates[id];
            return { ...p, memberIds: p.memberIds?.filter((x) => x !== id), memberRates };
          }),
          issues: s.issues.map((i) => (i.watchers.includes(id) ? { ...i, watchers: i.watchers.filter((w) => w !== id) } : i)),
        })),

      /* ---------------- Offers ---------------- */
      createOffer: (projectId, input) => {
        const s = get();
        const project = s.projects.find((p) => p.id === projectId)!;
        const n = (project.offerCounter ?? 0) + 1;
        const offer: Offer = {
          id: nanoid(8),
          projectId,
          number: `${project.key}-O${n}`,
          title: input?.title?.trim() || "Untitled offer",
          status: "draft",
          ownerId: input?.ownerId ?? s.currentUserId,
          issueDate: nowIso().slice(0, 10),
          validUntil: input?.validUntil,
          lines: [],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set((st) => ({ offers: [...st.offers, offer], projects: st.projects.map((p) => (p.id === projectId ? { ...p, offerCounter: n } : p)) }));
        return offer;
      },
      updateOffer: (id, patch) => set((s) => ({ offers: s.offers.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: nowIso() } : o)) })),
      deleteOffer: (id) =>
        set((s) => ({
          offers: s.offers.filter((o) => o.id !== id),
          offerBaselines: s.offerBaselines.filter((b) => b.offerId !== id),
          issues: s.issues.map((i) => (i.offerId === id ? { ...i, offerId: undefined, offerLineId: undefined } : i)),
        })),
      setOfferStatus: (id, status) =>
        set((s) => ({
          offers: s.offers.map((o) => {
            if (o.id !== id) return o;
            const stamp = status === "sent" ? { sentAt: nowIso() } : status === "accepted" ? { acceptedAt: nowIso() } : status === "ordered" ? { orderedAt: nowIso() } : {};
            return { ...o, status, ...stamp, updatedAt: nowIso() };
          }),
        })),
      addOfferLine: (offerId, input) => {
        const s = get();
        const offer = s.offers.find((o) => o.id === offerId)!;
        const line: OfferLine = {
          id: nanoid(8),
          description: "",
          qty: 1,
          unit: "days",
          unitPrice: 0,
          hours: s.settings.hoursPerDay,
          issueType: "epic",
          order: offer.lines.length + 1,
          ...input,
        };
        set((st) => ({ offers: st.offers.map((o) => (o.id === offerId ? { ...o, lines: scheduled(st, [...o.lines, line]), updatedAt: nowIso() } : o)) }));
        return line;
      },
      updateOfferLine: (offerId, lineId, patch) =>
        set((s) => ({
          offers: s.offers.map((o) => (o.id === offerId ? { ...o, lines: scheduled(s, o.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l))), updatedAt: nowIso() } : o)),
        })),
      removeOfferLine: (offerId, lineId) =>
        set((s) => ({
          offers: s.offers.map((o) =>
            o.id === offerId
              ? { ...o, lines: o.lines.filter((l) => l.id !== lineId).map((l, i) => ({ ...l, order: i + 1, ...(l.predecessorId === lineId ? { predecessorId: undefined } : {}) })), updatedAt: nowIso() }
              : o,
          ),
        })),
      moveOfferLine: (offerId, lineId, toIndex) =>
        set((s) => ({
          offers: s.offers.map((o) => {
            if (o.id !== offerId) return o;
            const sorted = [...o.lines].sort((a, b) => a.order - b.order);
            const from = sorted.findIndex((l) => l.id === lineId);
            if (from < 0) return o;
            const [moved] = sorted.splice(from, 1);
            sorted.splice(Math.max(0, Math.min(toIndex, sorted.length)), 0, moved);
            return { ...o, lines: sorted.map((l, i) => ({ ...l, order: i + 1 })), updatedAt: nowIso() };
          }),
        })),
      convertOffer: (offerId, mapping) => {
        const s = get();
        const offer = s.offers.find((o) => o.id === offerId);
        if (!offer) return [];
        const created: Issue[] = [];
        const lineIssue: Record<ID, ID> = {};
        for (const m of mapping) {
          if (!m.include) continue;
          const line = offer.lines.find((l) => l.id === m.lineId);
          if (!line || line.issueId) continue;
          const issue = get().createIssue({
            projectId: offer.projectId,
            type: m.issueType,
            summary: line.description || `Line ${line.order}`,
            description: line.details,
            assigneeId: m.assigneeId,
            labels: [offer.number],
            originalEstimate: line.hours ? Math.round(line.hours * 3600) : undefined,
            dueDate: line.plannedEnd ? formatISO(new Date(line.plannedEnd)) : undefined,
          });
          lineIssue[line.id] = issue.id;
          created.push(issue);
        }
        set((st) => ({
          issues: st.issues.map((i) => {
            const lineId = Object.keys(lineIssue).find((k) => lineIssue[k] === i.id);
            if (!lineId) return i;
            const line = offer.lines.find((l) => l.id === lineId)!;
            return { ...i, offerId: offer.id, offerLineId: lineId, startDate: line.plannedStart ? formatISO(new Date(line.plannedStart)) : i.startDate };
          }),
          offers: st.offers.map((o) => (o.id === offerId ? { ...o, status: "ordered" as const, orderedAt: o.orderedAt ?? nowIso(), updatedAt: nowIso(), lines: o.lines.map((l) => (lineIssue[l.id] ? { ...l, issueId: lineIssue[l.id] } : l)) } : o)),
          projects: st.projects.map((p) => {
            if (p.id !== offer.projectId) return p;
            const active = p.status === "prospect" ? { ...p, status: "active" as const } : p;
            return withTeamMembers(active, forecastMembers(offer.lines));
          }),
        }));
        // the order baseline: what was sold and planned when the client committed
        if (!get().offerBaselines.some((b) => b.offerId === offerId && b.kind === "order")) {
          get().createBaseline(offerId, { name: "Order", kind: "order", note: "Taken when the offer became an order" });
        }
        return created;
      },

      /* ---------------- Forecast & baselines ---------------- */
      addForecastActivity: (offerId, lineId, input) => {
        const line = get().offers.find((o) => o.id === offerId)?.lines.find((l) => l.id === lineId);
        const activity: ForecastActivity = { id: nanoid(8), name: "", effort: {}, order: (line?.activities?.length ?? 0) + 1, ...input };
        set((s) => ({ offers: withActivities(s, offerId, lineId, (acts) => [...acts, activity]) }));
        return activity;
      },
      updateForecastActivity: (offerId, lineId, activityId, patch) =>
        set((s) => ({ offers: withActivities(s, offerId, lineId, (acts) => acts.map((a) => (a.id === activityId ? { ...a, ...patch } : a))) })),
      removeForecastActivity: (offerId, lineId, activityId) =>
        set((s) => ({ offers: withActivities(s, offerId, lineId, (acts) => acts.filter((a) => a.id !== activityId).map((a, i) => ({ ...a, order: i + 1 }))) })),
      setForecastEffort: (offerId, lineId, activityId, userId, hours) =>
        set((s) => ({
          offers: withActivities(s, offerId, lineId, (acts) =>
            acts.map((a) => {
              if (a.id !== activityId) return a;
              const effort = { ...(a.effort ?? {}) };
              if (!hours || hours <= 0 || Number.isNaN(hours)) delete effort[userId];
              else effort[userId] = hours;
              return { ...a, effort };
            }),
          ),
        })),
      createBaseline: (offerId, input) => {
        const s = get();
        const offer = s.offers.find((o) => o.id === offerId);
        if (!offer) return undefined;
        const project = s.projects.find((p) => p.id === offer.projectId);
        const baseline: OfferBaseline = {
          id: nanoid(8),
          ...captureBaseline(offer, { users: s.users, project, name: input.name.trim() || "Baseline", kind: input.kind ?? "manual", note: input.note?.trim() || undefined, createdBy: s.currentUserId, now: nowIso() }),
        };
        set((st) => ({ offerBaselines: [...st.offerBaselines, baseline] }));
        return baseline;
      },
      deleteBaseline: (id) => set((s) => ({ offerBaselines: s.offerBaselines.filter((b) => b.id !== id) })),

      /* ---------------- Allocations, holidays, time off ---------------- */
      addAllocation: (input) => {
        const a: Allocation = { ...input, id: nanoid(8) };
        set((s) => ({ allocations: [...s.allocations, a] }));
        return a;
      },
      updateAllocation: (id, patch) => set((s) => ({ allocations: s.allocations.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAllocation: (id) => set((s) => ({ allocations: s.allocations.filter((a) => a.id !== id) })),
      addHoliday: (input) => set((s) => ({ holidays: [...s.holidays.filter((h) => h.date !== input.date || (h.to ?? h.date) !== (input.to ?? input.date)), { ...input, id: nanoid(8) }] })),
      removeHoliday: (id) => set((s) => ({ holidays: s.holidays.filter((h) => h.id !== id) })),
      addTimeOff: (input) => set((s) => ({ timeOffs: [...s.timeOffs, { ...input, id: nanoid(8) }] })),
      removeTimeOff: (id) => set((s) => ({ timeOffs: s.timeOffs.filter((t) => t.id !== id) })),
      materializeEntry: (entry) => {
        const { id: _id, virtual: _v, allocationId: _a, percent: _p, ...rest } = entry;
        void _id; void _v; void _a; void _p;
        return get().addTimeEntry({ ...rest, userId: entry.userId });
      },

      /* ---------------- Settings & rates ---------------- */
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setUserCostRate: (userId, rate, applyFrom) =>
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? { ...u, costRates: applyRate(u.costRates, rate, applyFrom) } : u)) })),
      setProjectBillingRate: (projectId, rate, applyFrom) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? { ...p, billingRates: applyRate(p.billingRates, rate, applyFrom) } : p)) })),
      setMemberRate: (projectId, userId, kind, rate, applyFrom) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const mr = p.memberRates?.[userId] ?? {};
            return { ...p, memberRates: { ...(p.memberRates ?? {}), [userId]: { ...mr, [kind]: applyRate(mr[kind], rate, applyFrom) } } };
          }),
        })),
      resetMemberRate: (projectId, userId, kind) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const mr = { ...(p.memberRates?.[userId] ?? {}) };
            delete mr[kind];
            return { ...p, memberRates: { ...(p.memberRates ?? {}), [userId]: mr } };
          }),
        })),

      loadWorkspace: async () => {
        const res = await fetch("/api/bootstrap", { cache: "no-store" });
        if (!res.ok) return res.status;
        const payload = (await res.json()) as BootstrapPayload;
        get().applyBootstrap(payload);
        return 200;
      },
      applyBootstrap: (payload) => {
        const d = payload.data;
        set({
          applyingRemote: true,
          session: payload.session,
          currentUserId: payload.session.memberId,
          settings: { ...defaultSettings(), ...d.settings },
          users: d.users,
          clients: d.clients,
          tags: d.tags,
          projects: d.projects,
          sprints: d.sprints,
          issues: d.issues,
          timeEntries: d.timeEntries,
          offers: d.offers,
          offerBaselines: d.offerBaselines ?? [],
          allocations: d.allocations,
          holidays: d.holidays,
          timeOffs: d.timeOffs,
          bootstrapped: true,
        });
        set({ applyingRemote: false });
      },
      resetDemo: async () => {
        const res = await fetch("/api/workspace/reset-demo", { method: "POST" });
        if (!res.ok) throw new Error(`Reset failed (${res.status})`);
        await get().loadWorkspace();
      },
    }),
    {
      name: "jiggl-ui",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ ui: { ...s.ui, createIssueOpen: false, createIssueDefaults: undefined } }),
      merge: (persisted, current) => ({ ...current, ui: { ...current.ui, ...((persisted as Partial<AppState> | undefined)?.ui ?? {}) } }),
    },
  ),
);

/* ---------------- Selectors ---------------- */

export const selectRunningEntry = (s: AppState) => s.timeEntries.find((t) => t.userId === s.currentUserId && !t.stop);
export const selectCurrentUser = (s: AppState) => s.users.find((u) => u.id === s.currentUserId)!;
export const selectProjectByKey = (key: string) => (s: AppState) => s.projects.find((p) => p.key.toLowerCase() === key.toLowerCase());
export const selectIssueByKey = (key: string) => (s: AppState) => s.issues.find((i) => i.key.toLowerCase() === key.toLowerCase());
