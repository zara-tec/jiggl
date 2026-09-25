import { addDays, addMinutes, setHours, setMinutes, startOfDay, subDays, formatISO } from "date-fns";
import type {
  Allocation,
  Client,
  Holiday,
  Issue,
  ForecastActivity,
  Offer,
  OfferBaseline,
  OfferLine,
  TimeOff,
  IssuePriority,
  IssueStatus,
  IssueType,
  Project,
  Sprint,
  Tag,
  TimeEntry,
  User,
} from "./types";
import { captureBaseline } from "./forecast";
import { scheduleLines } from "./schedule";

export const SEED_VERSION = 7;

/* Deterministic PRNG so the demo looks the same on every reset */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedData {
  users: User[];
  currentUserId: string;
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
}

export function buildSeed(now: Date = new Date()): SeedData {
  const rnd = mulberry32(42);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const iso = (d: Date) => formatISO(d);
  let idCounter = 1;
  const id = (prefix: string) => `${prefix}_${(idCounter++).toString(36)}`;

  const users: User[] = [
    { id: "u_alex", name: "Alex Moretti", email: "alex@jiggl.app", color: "#0C66E4", role: "admin", costRates: [{ from: "2024-01-01", rate: 50 }, { from: "2026-07-01", rate: 55 }] },
    { id: "u_giulia", name: "Giulia Bianchi", email: "giulia@jiggl.app", color: "#6E5DC6", role: "pm", costRates: [{ from: "2024-01-01", rate: 50 }] },
    { id: "u_marco", name: "Marco Verdi", email: "marco@jiggl.app", color: "#1F845A", role: "member", costRates: [{ from: "2024-01-01", rate: 45 }] },
    { id: "u_sara", name: "Sara Conti", email: "sara@jiggl.app", color: "#C9372C", role: "member", costRates: [{ from: "2024-01-01", rate: 52 }] },
    { id: "u_luca", name: "Luca Ferrari", email: "luca@jiggl.app", color: "#E56910", role: "member", costRates: [{ from: "2024-01-01", rate: 40 }] },
    { id: "u_elena", name: "Elena Russo", email: "elena@jiggl.app", color: "#943D73", role: "pm", costRates: [{ from: "2024-01-01", rate: 65 }] },
  ];

  const clients: Client[] = [
    { id: "c_acme", name: "Acme Corp" },
    { id: "c_globex", name: "Globex" },
    { id: "c_initech", name: "Initech" },
  ];

  const tags: Tag[] = [
    { id: "t_dev", name: "development" },
    { id: "t_design", name: "design" },
    { id: "t_meeting", name: "meeting" },
    { id: "t_research", name: "research" },
    { id: "t_bugfix", name: "bugfix" },
    { id: "t_review", name: "review" },
    { id: "t_admin", name: "admin" },
  ];

  const projects: Project[] = [
    {
      id: "p_jig",
      key: "JIG",
      name: "Jiggl Platform",
      type: "software",
      leadId: "u_alex",
      clientId: "c_acme",
      color: "#0b83d9",
      billable: true,
      pricing: "fixed",
      timeMode: "timesheet",
      status: "active",
      billingRates: [{ from: "2024-01-01", rate: 80 }, { from: "2026-09-01", rate: 85 }],
      memberRates: {},
      issueCounter: 0,
      offerCounter: 0,
      starred: true,
      createdAt: iso(subDays(now, 120)),
    },
    {
      id: "p_mob",
      key: "MOB",
      name: "Mobile App",
      type: "software",
      leadId: "u_giulia",
      clientId: "c_globex",
      color: "#e36a00",
      billable: true,
      pricing: "tm",
      timeMode: "timesheet",
      status: "active",
      billingRates: [{ from: "2024-01-01", rate: 95 }],
      memberRates: { u_elena: { billing: [{ from: "2024-01-01", rate: 120 }] } },
      issueCounter: 0,
      offerCounter: 0,
      starred: true,
      createdAt: iso(subDays(now, 60)),
    },
    {
      id: "p_mkt",
      key: "MKT",
      name: "Marketing Website",
      type: "business",
      leadId: "u_elena",
      clientId: "c_initech",
      color: "#06a893",
      billable: false,
      pricing: "fixed",
      timeMode: "timesheet",
      status: "active",
      billingRates: [{ from: "2024-01-01", rate: 70 }],
      memberRates: {},
      issueCounter: 0,
      offerCounter: 0,
      createdAt: iso(subDays(now, 30)),
    },
    {
      id: "p_int",
      key: "INT",
      name: "Internal Ops",
      type: "business",
      leadId: "u_alex",
      color: "#9e5bd9",
      billable: false,
      pricing: "fixed",
      timeMode: "allocation",
      status: "active",
      billingRates: [],
      memberRates: {},
      issueCounter: 0,
      offerCounter: 0,
      createdAt: iso(subDays(now, 200)),
    },
    {
      id: "p_data",
      key: "DATA",
      name: "Acme Data Platform",
      type: "software",
      leadId: "u_giulia",
      clientId: "c_acme",
      color: "#c7af14",
      billable: true,
      pricing: "fixed",
      timeMode: "timesheet",
      status: "prospect",
      billingRates: [{ from: "2026-01-01", rate: 90 }],
      memberRates: {},
      issueCounter: 0,
      offerCounter: 0,
      createdAt: iso(subDays(now, 6)),
    },
  ];

  const sprints: Sprint[] = [
    {
      id: "s_jig_1",
      projectId: "p_jig",
      name: "JIG Sprint 1",
      goal: "Foundations: auth, projects, basic board",
      state: "closed",
      startDate: iso(subDays(now, 19)),
      endDate: iso(subDays(now, 5)),
      order: 1,
    },
    {
      id: "s_jig_2",
      projectId: "p_jig",
      name: "JIG Sprint 2",
      goal: "Ship the timer and the time reports MVP",
      state: "active",
      startDate: iso(subDays(now, 5)),
      endDate: iso(addDays(now, 9)),
      order: 2,
    },
    { id: "s_jig_3", projectId: "p_jig", name: "JIG Sprint 3", state: "future", order: 3 },
    {
      id: "s_mob_1",
      projectId: "p_mob",
      name: "MOB Sprint 1",
      goal: "Offline tracking and sync",
      state: "active",
      startDate: iso(subDays(now, 3)),
      endDate: iso(addDays(now, 11)),
      order: 1,
    },
    { id: "s_mob_2", projectId: "p_mob", name: "MOB Sprint 2", state: "future", order: 2 },
  ];

  const issues: Issue[] = [];
  const counters: Record<string, number> = {};
  let rank = 0;

  type Spec = {
    p: string;
    type: IssueType;
    summary: string;
    status?: IssueStatus;
    priority?: IssuePriority;
    assignee?: string;
    sprint?: string;
    parent?: string;
    points?: number;
    labels?: string[];
    description?: string;
    due?: number;
    estimate?: number;
    ref?: string;
  };

  const refs: Record<string, string> = {};

  const add = (s: Spec) => {
    const project = projects.find((p) => p.id === s.p)!;
    counters[project.key] = (counters[project.key] ?? 0) + 1;
    const num = counters[project.key];
    const created = subDays(now, Math.floor(rnd() * 25) + 1);
    const status = s.status ?? "todo";
    const issue: Issue = {
      id: id("i"),
      key: `${project.key}-${num}`,
      projectId: s.p,
      type: s.type,
      summary: s.summary,
      description: s.description,
      status,
      priority: s.priority ?? "medium",
      assigneeId: s.assignee,
      reporterId: pick(["u_alex", "u_giulia", "u_elena"]),
      labels: s.labels ?? [],
      sprintId: s.sprint,
      parentId: s.parent ? refs[s.parent] : undefined,
      storyPoints: s.points,
      originalEstimate: s.estimate,
      dueDate: s.due !== undefined ? iso(addDays(startOfDay(now), s.due)) : undefined,
      rank: rank++,
      comments: [],
      createdAt: iso(created),
      updatedAt: iso(subDays(now, Math.floor(rnd() * 5))),
      resolvedAt: status === "done" ? iso(subDays(now, Math.floor(rnd() * 6))) : undefined,
      watchers: ["u_alex"],
    };
    issues.push(issue);
    if (s.ref) refs[s.ref] = issue.id;
    return issue;
  };

  /* ---------- JIG ---------- */
  add({ p: "p_jig", type: "epic", summary: "Time tracking", ref: "e_time", status: "inprogress", assignee: "u_alex", labels: ["mvp"], description: "Everything related to starting, stopping and editing time entries. Timer bar, manual mode and continue from history." });
  add({ p: "p_jig", type: "epic", summary: "Boards & backlog", ref: "e_board", status: "inprogress", assignee: "u_giulia", labels: ["mvp"] });
  add({ p: "p_jig", type: "epic", summary: "Reporting", ref: "e_reports", status: "todo", assignee: "u_marco" });
  add({ p: "p_jig", type: "epic", summary: "Authentication & workspaces", ref: "e_auth", status: "done", assignee: "u_sara" });

  // Sprint 1 (closed)
  add({ p: "p_jig", type: "story", summary: "Sign up with email and password", status: "done", assignee: "u_sara", sprint: "s_jig_1", parent: "e_auth", points: 5, priority: "high", labels: ["backend"] });
  add({ p: "p_jig", type: "story", summary: "Create a workspace and invite members", status: "done", assignee: "u_sara", sprint: "s_jig_1", parent: "e_auth", points: 8 });
  add({ p: "p_jig", type: "task", summary: "Set up CI pipeline and preview deployments", status: "done", assignee: "u_marco", sprint: "s_jig_1", points: 3, labels: ["devops"] });
  add({ p: "p_jig", type: "bug", summary: "Session expires after 5 minutes on Safari", status: "done", assignee: "u_sara", sprint: "s_jig_1", parent: "e_auth", points: 2, priority: "highest" });

  // Sprint 2 (active)
  add({ p: "p_jig", type: "story", summary: "Timer bar: start and stop a timer from any page", ref: "st_timer", status: "inprogress", assignee: "u_alex", sprint: "s_jig_2", parent: "e_time", points: 5, priority: "highest", labels: ["frontend", "mvp"], estimate: 8 * 3600, due: 3,
    description: "As a user I want a persistent timer bar so I can start tracking from anywhere.\n\nAcceptance criteria:\n- Timer keeps running across navigation\n- Description, project and tags editable while running\n- Keyboard shortcut to start/stop" });
  add({ p: "p_jig", type: "subtask", summary: "Persist running timer in local storage", status: "done", assignee: "u_alex", sprint: "s_jig_2", parent: "st_timer", points: 1 });
  add({ p: "p_jig", type: "subtask", summary: "Keyboard shortcut (S) to toggle timer", status: "todo", assignee: "u_alex", sprint: "s_jig_2", parent: "st_timer", points: 1 });
  add({ p: "p_jig", type: "story", summary: "Manual time entry with start/stop or duration", status: "inreview", assignee: "u_giulia", sprint: "s_jig_2", parent: "e_time", points: 3, priority: "high", labels: ["frontend"], estimate: 6 * 3600 });
  add({ p: "p_jig", type: "story", summary: "Continue a previous entry with one click", status: "todo", assignee: "u_giulia", sprint: "s_jig_2", parent: "e_time", points: 2, labels: ["frontend"] });
  add({ p: "p_jig", type: "task", summary: "Log work from the issue detail page", status: "inprogress", assignee: "u_marco", sprint: "s_jig_2", parent: "e_time", points: 3, priority: "high", estimate: 5 * 3600, due: 5 });
  add({ p: "p_jig", type: "bug", summary: "Board card drag drops on the wrong column when scrolled", status: "todo", assignee: "u_luca", sprint: "s_jig_2", parent: "e_board", points: 2, priority: "highest", labels: ["frontend"], due: 1 });
  add({ p: "p_jig", type: "story", summary: "Group by assignee on the board", status: "todo", assignee: "u_luca", sprint: "s_jig_2", parent: "e_board", points: 5, priority: "medium" });
  add({ p: "p_jig", type: "task", summary: "Column limits (WIP) with warning colours", status: "todo", sprint: "s_jig_2", parent: "e_board", points: 3, priority: "low" });
  add({ p: "p_jig", type: "story", summary: "Weekly report with hours per project per day", status: "todo", assignee: "u_marco", sprint: "s_jig_2", parent: "e_reports", points: 5, priority: "medium", labels: ["reports"] });
  add({ p: "p_jig", type: "bug", summary: "Time entries around midnight are split in the wrong day", status: "inprogress", assignee: "u_alex", sprint: "s_jig_2", parent: "e_time", points: 3, priority: "high", labels: ["backend"] });

  // Backlog
  add({ p: "p_jig", type: "story", summary: "Summary report: filter by client, project, member and tag", status: "todo", parent: "e_reports", points: 8, priority: "high", labels: ["reports"] });
  add({ p: "p_jig", type: "story", summary: "Detailed report with CSV and PDF export", status: "todo", parent: "e_reports", points: 5, priority: "medium", labels: ["reports"] });
  add({ p: "p_jig", type: "story", summary: "Billable rates per project and per member", status: "todo", assignee: "u_elena", parent: "e_reports", points: 5, priority: "medium" });
  add({ p: "p_jig", type: "task", summary: "Idle detection in desktop app", status: "todo", parent: "e_time", points: 8, priority: "low" });
  add({ p: "p_jig", type: "story", summary: "Pomodoro mode for the timer", status: "todo", parent: "e_time", points: 3, priority: "lowest" });
  add({ p: "p_jig", type: "story", summary: "Calendar view of tracked time", status: "todo", parent: "e_time", points: 8, priority: "medium", sprint: "s_jig_3" });
  add({ p: "p_jig", type: "task", summary: "Swimlanes by epic on the board", status: "todo", parent: "e_board", points: 5, sprint: "s_jig_3" });
  add({ p: "p_jig", type: "bug", summary: "Sprint goal is truncated in the backlog header", status: "todo", parent: "e_board", points: 1, priority: "low" });
  add({ p: "p_jig", type: "task", summary: "Audit log for workspace admins", status: "todo", parent: "e_auth", points: 5, priority: "low" });
  add({ p: "p_jig", type: "story", summary: "SSO with Google Workspace", status: "todo", parent: "e_auth", points: 8, priority: "medium", labels: ["backend"] });

  /* ---------- MOB ---------- */
  add({ p: "p_mob", type: "epic", summary: "Offline tracking", ref: "e_offline", status: "inprogress", assignee: "u_giulia" });
  add({ p: "p_mob", type: "epic", summary: "Widgets & shortcuts", ref: "e_widgets", status: "todo", assignee: "u_luca" });
  add({ p: "p_mob", type: "story", summary: "Queue entries while offline and sync when online", status: "inprogress", assignee: "u_giulia", sprint: "s_mob_1", parent: "e_offline", points: 8, priority: "highest" });
  add({ p: "p_mob", type: "bug", summary: "Crash when stopping a timer with no network", status: "inreview", assignee: "u_luca", sprint: "s_mob_1", parent: "e_offline", points: 3, priority: "highest", labels: ["ios"] });
  add({ p: "p_mob", type: "task", summary: "Conflict resolution for edited entries", status: "todo", assignee: "u_giulia", sprint: "s_mob_1", parent: "e_offline", points: 5, priority: "high" });
  add({ p: "p_mob", type: "story", summary: "Home screen widget with running timer", status: "todo", assignee: "u_luca", sprint: "s_mob_1", parent: "e_widgets", points: 5, priority: "medium", labels: ["ios", "android"] });
  add({ p: "p_mob", type: "story", summary: "Siri and Google Assistant shortcuts", status: "todo", parent: "e_widgets", points: 8, priority: "low" });
  add({ p: "p_mob", type: "task", summary: "Push notifications for long running timers", status: "done", assignee: "u_luca", sprint: "s_mob_1", points: 2 });
  add({ p: "p_mob", type: "bug", summary: "Dark mode colours are wrong on Android 15", status: "todo", assignee: "u_luca", parent: "e_widgets", points: 1, priority: "medium", labels: ["android"] });

  /* ---------- MKT ---------- */
  add({ p: "p_mkt", type: "task", summary: "Write landing page copy", status: "done", assignee: "u_elena", priority: "high" });
  add({ p: "p_mkt", type: "task", summary: "Design pricing page", status: "inprogress", assignee: "u_elena", priority: "high", due: 2 });
  add({ p: "p_mkt", type: "task", summary: "Set up analytics and conversion events", status: "todo", assignee: "u_marco", priority: "medium" });
  add({ p: "p_mkt", type: "task", summary: "Blog: 'How we merged planning and time tracking'", status: "todo", assignee: "u_elena", priority: "low", due: 7 });
  add({ p: "p_mkt", type: "bug", summary: "Hero image is blurry on retina displays", status: "todo", assignee: "u_sara", priority: "medium" });

  /* ---------- INT ---------- */
  add({ p: "p_int", type: "task", summary: "Quarterly planning workshop", status: "done", assignee: "u_alex" });
  add({ p: "p_int", type: "task", summary: "Renew SaaS subscriptions", status: "todo", assignee: "u_alex", priority: "low", due: 10 });
  add({ p: "p_int", type: "task", summary: "Hiring: frontend engineer interviews", status: "inprogress", assignee: "u_elena", priority: "high" });

  projects.forEach((p) => (p.issueCounter = counters[p.key] ?? 0));

  // A few comments
  const timerStory = issues.find((i) => i.id === refs["st_timer"])!;
  timerStory.comments.push(
    { id: id("c"), authorId: "u_giulia", body: "Should the timer bar also show the project colour? I think it helps scanning.", createdAt: iso(subDays(now, 2)) },
    { id: id("c"), authorId: "u_alex", body: "Yes, let's keep the project colour dot next to the project name and the rest consistent with the work views.", createdAt: iso(subDays(now, 1)) },
  );

  const holidays: Holiday[] = [
    { id: "h1", date: "2026-01-01", name: "New Year's Day" },
    { id: "h2", date: "2026-01-06", name: "Epiphany" },
    { id: "h3", date: "2026-04-06", name: "Easter Monday" },
    { id: "h4", date: "2026-04-25", name: "Liberation Day" },
    { id: "h5", date: "2026-05-01", name: "Labour Day" },
    { id: "h6", date: "2026-06-02", name: "Republic Day" },
    { id: "h7", date: "2026-08-15", name: "Assumption" },
    { id: "h8", date: "2026-11-01", name: "All Saints" },
    { id: "h9", date: "2026-12-08", name: "Immaculate Conception" },
    { id: "h10", date: "2026-12-25", name: "Christmas" },
    { id: "h11", date: "2026-12-26", name: "St. Stephen" },
    { id: "h12", date: "2026-08-10", to: "2026-08-21", name: "Summer closure", kind: "closure" },
    { id: "h13", date: "2026-12-28", to: "2027-01-05", name: "Christmas closure", kind: "closure" },
  ];

  /* ---------- Offers ---------- */
  const offers: Offer[] = [];
  const ymd = (d: Date) => formatISO(d, { representation: "date" });
  let lineCounter = 1;
  const line = (o: Partial<OfferLine> & { description: string; qty: number; unit: OfferLine["unit"]; unitPrice: number; hours: number }, order: number): OfferLine => ({
    id: `ol_${(lineCounter++).toString(36)}`,
    issueType: "epic",
    order,
    ...o,
  });
  // forecast sub-rows: who does what, in hours
  let activityCounter = 1;
  const act = (name: string, effort: Record<string, number>, extra?: Partial<ForecastActivity>): ForecastActivity => ({ id: `fa_${(activityCounter++).toString(36)}`, name, effort, order: 0, ...extra });
  const plan = (...activities: ForecastActivity[]) => activities.map((a, i) => ({ ...a, order: i + 1 }));

  const jigOrder: Offer = {
    id: "o_jig_1",
    projectId: "p_jig",
    number: "JIG-O1",
    title: "Jiggl platform MVP",
    status: "ordered",
    ownerId: "u_alex",
    issueDate: ymd(subDays(now, 45)),
    validUntil: ymd(subDays(now, 15)),
    notes: "Fixed price. Includes onboarding workshop and two months of support.",
    lines: [
      line({ section: "Build", description: "Time tracking", details: "Timer, manual entries, calendar and history.", qty: 120, unit: "hours", unitPrice: 80, hours: 120, plannedStart: ymd(subDays(now, 30)), plannedEnd: ymd(addDays(now, 14)), issueId: refs["e_time"], activities: plan(act("Timer and manual entries", { u_alex: 32, u_marco: 40 }), act("Calendar and history", { u_marco: 24, u_sara: 24 }), act("Idle detection and reminders", { u_sara: 12 }, { unsold: true, note: "Asked by the client after the order; not quoted." })) }, 1),
      line({ section: "Build", description: "Boards & backlog", details: "Kanban board, backlog, sprints.", qty: 80, unit: "hours", unitPrice: 80, hours: 80, plannedStart: ymd(subDays(now, 30)), plannedEnd: ymd(addDays(now, 7)), issueId: refs["e_board"], activities: plan(act("Kanban board", { u_luca: 40 }), act("Backlog and sprints", { u_luca: 32, u_alex: 8 })) }, 2),
      line({ section: "Build", description: "Reporting", details: "Summary, detailed and weekly reports.", qty: 60, unit: "hours", unitPrice: 80, hours: 60, plannedStart: ymd(addDays(now, 7)), plannedEnd: ymd(addDays(now, 35)), issueId: refs["e_reports"], activities: plan(act("Summary and detailed reports", { u_sara: 40 }), act("Weekly report and export", { u_sara: 24 })) }, 3),
      line({ section: "Foundation", description: "Authentication & workspaces", qty: 40, unit: "hours", unitPrice: 80, hours: 40, plannedStart: ymd(subDays(now, 40)), plannedEnd: ymd(subDays(now, 10)), issueId: refs["e_auth"], activities: plan(act("Sessions and passwords", { u_alex: 24 }), act("Workspace switching", { u_alex: 16 })) }, 4),
      line({ section: "Services", description: "Onboarding workshop", qty: 1, unit: "flat", unitPrice: 1500, hours: 8, issueType: "task", activities: plan(act("Workshop", { u_giulia: 8 })) }, 5),
    ],
    createdAt: iso(subDays(now, 45)),
    updatedAt: iso(subDays(now, 28)),
    sentAt: iso(subDays(now, 40)),
    acceptedAt: iso(subDays(now, 30)),
    orderedAt: iso(subDays(now, 28)),
  };
  offers.push(jigOrder);
  offers.push({
    id: "o_jig_2",
    projectId: "p_jig",
    number: "JIG-O2",
    title: "Phase 2: SSO and calendar view",
    status: "sent",
    ownerId: "u_alex",
    issueDate: ymd(subDays(now, 5)),
    validUntil: ymd(addDays(now, 25)),
    lines: [
      line({ description: "SSO with Google Workspace", qty: 5, unit: "days", unitPrice: 640, hours: 40, plannedStart: ymd(addDays(now, 21)), plannedEnd: ymd(addDays(now, 35)), activities: plan(act("Provider integration", { u_alex: 24, u_sara: 16 }), act("Account linking and tests", { u_sara: 8 })) }, 1),
      line({ description: "Calendar view of tracked time", qty: 8, unit: "days", unitPrice: 640, hours: 64, plannedStart: ymd(addDays(now, 28)), plannedEnd: ymd(addDays(now, 49)), predecessorId: "ol_6", lagDays: 2, activities: plan(act("Calendar UI", { u_sara: 40, u_luca: 24 })) }, 2),
    ],
    createdAt: iso(subDays(now, 5)),
    updatedAt: iso(subDays(now, 3)),
    sentAt: iso(subDays(now, 3)),
  });
  offers.push({
    id: "o_mob_1",
    projectId: "p_mob",
    number: "MOB-O1",
    title: "Mobile app: offline tracking and widgets",
    status: "ordered",
    ownerId: "u_giulia",
    issueDate: ymd(subDays(now, 20)),
    notes: "Time & material, ceiling 320 hours.",
    lines: [
      line({ description: "Offline tracking", details: "Queue, sync and conflict resolution.", qty: 200, unit: "hours", unitPrice: 95, hours: 200, plannedStart: ymd(subDays(now, 10)), plannedEnd: ymd(addDays(now, 30)), issueId: refs["e_offline"], activities: plan(act("Sync queue", { u_marco: 80, u_luca: 40 }), act("Conflict resolution", { u_marco: 60 }), act("Device tests", { u_luca: 20 })) }, 1),
      line({ description: "Widgets & shortcuts", qty: 120, unit: "hours", unitPrice: 95, hours: 120, plannedStart: ymd(addDays(now, 14)), plannedEnd: ymd(addDays(now, 45)), issueId: refs["e_widgets"], activities: plan(act("Home screen widgets", { u_luca: 60 }), act("Shortcuts and deep links", { u_luca: 40, u_giulia: 8 })) }, 2),
    ],
    createdAt: iso(subDays(now, 20)),
    updatedAt: iso(subDays(now, 12)),
    sentAt: iso(subDays(now, 18)),
    acceptedAt: iso(subDays(now, 13)),
    orderedAt: iso(subDays(now, 12)),
  });
  offers.push({
    id: "o_data_1",
    projectId: "p_data",
    number: "DATA-O1",
    title: "Data platform discovery and MVP",
    status: "draft",
    ownerId: "u_giulia",
    issueDate: ymd(subDays(now, 2)),
    validUntil: ymd(addDays(now, 28)),
    lines: [
      line({ section: "Discovery", description: "Discovery workshops and architecture", qty: 6, unit: "days", unitPrice: 720, hours: 48, plannedStart: ymd(addDays(now, 14)), plannedEnd: ymd(addDays(now, 28)), activities: plan(act("Workshops", { u_elena: 24, u_giulia: 16 }), act("Architecture note", { u_elena: 8 })) }, 1),
      line({ section: "Build", description: "Ingestion pipelines", qty: 25, unit: "days", unitPrice: 720, hours: 200, plannedStart: ymd(addDays(now, 28)), plannedEnd: ymd(addDays(now, 77)), predecessorId: "ol_a", activities: plan(act("Connectors", { u_marco: 120 }), act("Orchestration and monitoring", { u_luca: 80 })) }, 2),
      line({ section: "Build", description: "Dashboards and self-service reporting", qty: 15, unit: "days", unitPrice: 720, hours: 120, plannedStart: ymd(addDays(now, 63)), plannedEnd: ymd(addDays(now, 98)) }, 3),
      line({ section: "Services", description: "Training", qty: 1, unit: "flat", unitPrice: 2500, hours: 16, issueType: "task" }, 4),
    ],
    createdAt: iso(subDays(now, 2)),
    updatedAt: iso(subDays(now, 1)),
  });
  projects.find((p) => p.id === "p_jig")!.offerCounter = 2;
  projects.find((p) => p.id === "p_mob")!.offerCounter = 1;
  projects.find((p) => p.id === "p_data")!.offerCounter = 1;
  // dependent lines get their dates from their predecessors, like the store does on every edit
  const cal = { workDays: [1, 2, 3, 4, 5], holidays };
  for (const o of offers) o.lines = scheduleLines(o.lines, { cal, hoursPerDay: 8 });

  /* ---------- Baselines: what was planned when the orders were placed ---------- */
  const offerBaselines: OfferBaseline[] = [];
  const projectOf = (o: Offer) => projects.find((p) => p.id === o.projectId);
  const replan = (o: Offer, changes: Record<number, ForecastActivity[]>): Offer => ({ ...o, lines: o.lines.map((l) => (changes[l.order] ? { ...l, activities: changes[l.order] } : l)) });
  // JIG-O1 was planned with Marco on the whole time-tracking line and Luca on reporting; the
  // team changed (Sara took over both, at a higher cost rate) and an unsold activity appeared.
  const jigAsOrdered = replan(jigOrder, {
    1: plan(act("Timer and manual entries", { u_alex: 32, u_marco: 40 }), act("Calendar and history", { u_marco: 48 })),
    3: plan(act("Summary and detailed reports", { u_luca: 36 }), act("Weekly report and export", { u_luca: 24 })),
  });
  offerBaselines.push({ id: "b_jig_1_order", ...captureBaseline(jigAsOrdered, { users, project: projectOf(jigOrder), name: "Order", kind: "order", note: "Taken when the offer became an order", createdBy: "u_alex", now: jigOrder.orderedAt! }) });
  const mobOrder = offers.find((o) => o.id === "o_mob_1")!;
  offerBaselines.push({ id: "b_mob_1_order", ...captureBaseline(mobOrder, { users, project: projectOf(mobOrder), name: "Order", kind: "order", note: "Taken when the offer became an order", createdBy: "u_giulia", now: mobOrder.orderedAt! }) });
  const jigPhase2 = offers.find((o) => o.id === "o_jig_2")!;
  const jigPhase2AsSent = replan(jigPhase2, { 2: plan(act("Calendar UI", { u_sara: 64 })) });
  offerBaselines.push({ id: "b_jig_2_sent", ...captureBaseline(jigPhase2AsSent, { users, project: projectOf(jigPhase2), name: "Sent to client", kind: "manual", note: "Forecast behind the price we quoted", createdBy: "u_alex", now: jigPhase2.sentAt! }) });
  // link converted lines back to their epics
  for (const o of offers) {
    for (const l of o.lines) {
      const issue = l.issueId ? issues.find((i) => i.id === l.issueId) : undefined;
      if (issue) {
        issue.offerId = o.id;
        issue.offerLineId = l.id;
        issue.originalEstimate = l.hours * 3600;
        issue.startDate = l.plannedStart ? iso(new Date(l.plannedStart)) : issue.startDate;
        issue.dueDate = l.plannedEnd ? iso(new Date(l.plannedEnd)) : issue.dueDate;
      }
    }
  }

  /* ---------- Time entries (last 21 days) ---------- */
  const timeEntries: TimeEntry[] = [];
  const descriptions: Record<string, string[]> = {
    dev: ["Implementing", "Refactoring", "Pairing on", "Bug fixing", "Writing tests for", "Code review of"],
    design: ["Wireframes for", "Design review:", "Prototyping"],
    meeting: ["Daily standup", "Sprint planning", "Backlog refinement", "Client sync", "1:1"],
  };

  const memberIssues = (userId: string) => issues.filter((i) => i.assigneeId === userId && i.type !== "epic" && i.projectId !== "p_int");

  for (let dayOffset = 20; dayOffset >= 0; dayOffset--) {
    const day = startOfDay(subDays(now, dayOffset));
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue;

    for (const user of users) {
      const isMe = user.id === "u_alex";
      const count = isMe ? 3 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 3);
      let cursor = setMinutes(setHours(day, 8 + Math.floor(rnd() * 2)), [0, 15, 30, 45][Math.floor(rnd() * 4)]);
      const mine = memberIssues(user.id);

      for (let k = 0; k < count; k++) {
        if (dayOffset === 0 && cursor > now) break;
        const isMeeting = rnd() < 0.2;
        let entry: TimeEntry;
        const durationMin = isMeeting ? [15, 30, 45, 60][Math.floor(rnd() * 4)] : 30 + Math.floor(rnd() * 8) * 15;
        const stop = addMinutes(cursor, durationMin);
        if (dayOffset === 0 && stop > now) break;

        if (isMeeting || mine.length === 0) {
          const projectId = pick(["p_jig", "p_mob", "p_mkt"]);
          entry = {
            id: id("te"),
            userId: user.id,
            description: pick(descriptions.meeting),
            projectId,
            tagIds: ["t_meeting"],
            billable: false,
            start: iso(cursor),
            stop: iso(stop),
          };
        } else {
          const issue = pick(mine);
          const project = projects.find((p) => p.id === issue.projectId)!;
          const verb = issue.type === "bug" ? "Bug fixing" : pick(descriptions.dev);
          entry = {
            id: id("te"),
            userId: user.id,
            description: `${verb} ${issue.summary.charAt(0).toLowerCase()}${issue.summary.slice(1)}`,
            projectId: issue.projectId,
            issueId: issue.id,
            tagIds: issue.type === "bug" ? ["t_bugfix"] : [pick(["t_dev", "t_dev", "t_review", "t_design"])],
            billable: project.billable,
            start: iso(cursor),
            stop: iso(stop),
          };
        }
        timeEntries.push(entry);
        cursor = addMinutes(stop, [0, 5, 15, 30, 60][Math.floor(rnd() * 5)]);
      }
    }
  }

  /* ---------- Allocations, holidays, time off ---------- */
  const allocations: Allocation[] = [
    { id: "al_1", projectId: "p_int", userId: "u_alex", percent: 20, from: "2026-08-01", note: "Internal ops & admin" },
    { id: "al_2", projectId: "p_int", userId: "u_elena", percent: 30, from: "2026-08-01", note: "Hiring & operations" },
    { id: "al_3", projectId: "p_int", userId: "u_marco", percent: 10, from: "2026-09-01", note: "DevOps on-call" },
  ];
  const timeOffs: TimeOff[] = [
    { id: "to_1", userId: "u_marco", from: ymd(addDays(now, 5)), to: ymd(addDays(now, 9)), kind: "vacation", note: "Holidays" },
    { id: "to_2", userId: "u_luca", from: ymd(subDays(now, 1)), to: ymd(subDays(now, 1)), kind: "sick" },
    { id: "to_3", userId: "u_elena", from: ymd(subDays(now, 12)), to: ymd(subDays(now, 10)), kind: "vacation" },
  ];

  // explicit teams for the client projects: the people assigned, allocated or planned there (internal projects stay open)
  for (const pid of ["p_jig", "p_mob", "p_data"]) {
    const p = projects.find((x) => x.id === pid)!;
    const ids = new Set<string>();
    for (const i of issues) if (i.projectId === pid && i.assigneeId) ids.add(i.assigneeId);
    for (const a of allocations) if (a.projectId === pid) ids.add(a.userId);
    for (const o of offers) if (o.projectId === pid) for (const l of o.lines) for (const act of l.activities ?? []) for (const [uid, h] of Object.entries(act.effort)) if (h) ids.add(uid);
    ids.delete(p.leadId);
    p.memberIds = [...ids];
  }

  return {
    users,
    currentUserId: "u_alex",
    clients,
    tags,
    projects,
    sprints,
    issues,
    timeEntries,
    offers,
    offerBaselines,
    allocations,
    holidays,
    timeOffs,
  };
}
