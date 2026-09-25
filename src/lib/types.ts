export type ID = string;

/** A rate valid from a date (yyyy-MM-dd) until the next period starts */
export interface RatePeriod {
  from: string;
  rate: number;
}

export type UserRole = "admin" | "pm" | "member";

export interface User {
  id: ID;
  name: string;
  email: string;
  /** Background colour for the initials avatar */
  color: string;
  role: UserRole;
  /** Internal cost per hour, with history */
  costRates: RatePeriod[];
  /** Server-side flag: the member is linked to an account and can sign in (never written back) */
  linked?: boolean;
}

export interface WorkspaceSettings {
  name: string;
  currency: "EUR" | "USD" | "GBP";
  hoursPerDay: number;
  /** 0 = Sunday ... 6 = Saturday */
  workDays: number[];
  /** "HH:mm": where allocated blocks start in the calendar */
  dayStart: string;
}

/** A fixed share of a member's working time booked on a project without a timesheet */
export interface Allocation {
  id: ID;
  projectId: ID;
  userId: ID;
  /** 1..100 % of a working day */
  percent: number;
  /** yyyy-MM-dd */
  from: string;
  to?: string;
  /** Optional epic the allocated hours count against */
  issueId?: ID;
  note?: string;
}

export type HolidayKind = "holiday" | "closure";

/** A day, or a range of days, when nobody in the workspace works: a public holiday or a company closure */
export interface Holiday {
  id: ID;
  /** yyyy-MM-dd: the day, or the first day of the range */
  date: string;
  /** yyyy-MM-dd, inclusive: last day of the range (absent = one day) */
  to?: string;
  name: string;
  /** default "holiday" */
  kind?: HolidayKind;
}

export interface TimeOff {
  id: ID;
  userId: ID;
  /** yyyy-MM-dd, inclusive */
  from: string;
  to: string;
  kind: "vacation" | "sick" | "other";
  note?: string;
}

export interface Client {
  id: ID;
  name: string;
  archived?: boolean;
}

export interface Tag {
  id: ID;
  name: string;
}

export type ProjectType = "software" | "business" | "service";
/** fixed = fixed price (revenue is the order amount), tm = time & material (revenue is hours x price) */
export type Pricing = "fixed" | "tm";
/** timesheet = members track hours, allocation = a share of members' time is booked automatically */
export type TimeMode = "timesheet" | "allocation";
export type ProjectStatus = "prospect" | "active" | "closed";

export interface MemberRates {
  cost?: RatePeriod[];
  billing?: RatePeriod[];
}

export interface Project {
  id: ID;
  key: string;
  name: string;
  type: ProjectType;
  leadId: ID;
  clientId?: ID;
  /** Project colour (used for time entries, avatar and charts) */
  color: string;
  billable: boolean;
  pricing: Pricing;
  timeMode: TimeMode;
  status: ProjectStatus;
  /** Default selling price per hour, with history */
  billingRates: RatePeriod[];
  /** Per-member overrides of cost and billing rates */
  memberRates: Record<ID, MemberRates>;
  /** The team: members who work on this project. Absent = everyone in the workspace; the lead is always included. */
  memberIds?: ID[];
  /** Auto-increment counter for issue keys */
  issueCounter: number;
  /** Auto-increment counter for offer numbers (KEY-O1, KEY-O2, ...) */
  offerCounter: number;
  starred?: boolean;
  archived?: boolean;
  createdAt: string;
}

export type IssueType = "epic" | "story" | "task" | "bug" | "subtask";
export type IssueStatus = "todo" | "inprogress" | "inreview" | "done";
export type IssuePriority = "highest" | "high" | "medium" | "low" | "lowest";
export type SprintState = "future" | "active" | "closed";

export interface Sprint {
  id: ID;
  projectId: ID;
  name: string;
  goal?: string;
  state: SprintState;
  startDate?: string;
  endDate?: string;
  /** Ordering in the backlog */
  order: number;
}

export interface Comment {
  id: ID;
  authorId: ID;
  body: string;
  createdAt: string;
}

export interface Issue {
  id: ID;
  key: string;
  projectId: ID;
  type: IssueType;
  summary: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId?: ID;
  reporterId: ID;
  labels: string[];
  sprintId?: ID;
  parentId?: ID;
  storyPoints?: number;
  /** Original estimate in seconds */
  originalEstimate?: number;
  dueDate?: string;
  startDate?: string;
  rank: number;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  watchers: ID[];
  /** Set when the work item was created from an offer line */
  offerId?: ID;
  offerLineId?: ID;
}

/* ---------------- Offers (quotes) and orders ---------------- */

export type OfferStatus = "draft" | "sent" | "accepted" | "ordered" | "rejected" | "expired";
export type OfferUnit = "hours" | "days" | "flat" | "item";
export type OfferLineIssueType = "epic" | "story" | "task";

export interface OfferLine {
  id: ID;
  section?: string;
  description: string;
  details?: string;
  qty: number;
  unit: OfferUnit;
  unitPrice: number;
  /** Estimated effort in hours, independent of how the line is priced */
  hours: number;
  /** yyyy-MM-dd */
  plannedStart?: string;
  plannedEnd?: string;
  /** Finish-to-start dependency: this line starts after that line ends (its start is then computed) */
  predecessorId?: ID;
  /** Working days between the predecessor's end and this line's start (negative = overlap) */
  lagDays?: number;
  /** Work item type created on conversion */
  issueType: OfferLineIssueType;
  /** Work item created on conversion */
  issueId?: ID;
  order: number;
  /** Forecast: the activities this line breaks down into, with effort per member */
  activities?: ForecastActivity[];
}

/**
 * A sub-row of the forecast matrix: one piece of work under an offer line,
 * with the hours each member is expected to spend on it.
 */
export interface ForecastActivity {
  id: ID;
  name: string;
  /** Forecast hours per member (userId -> hours); absent or 0 = not involved */
  effort: Record<ID, number>;
  /** Discovered after the order and not sold to the client: it costs, it does not bill */
  unsold?: boolean;
  note?: string;
  order: number;
}

export type BaselineKind = "order" | "manual";

/**
 * Frozen copy of an offer (lines, forecast and the cost rates in force) taken
 * at a point in time, so later revisions can be compared with what was
 * planned when the offer was sent, ordered or re-planned.
 */
export interface OfferBaseline {
  id: ID;
  offerId: ID;
  projectId: ID;
  name: string;
  note?: string;
  kind: BaselineKind;
  createdAt: string;
  createdBy: ID;
  discountPct?: number;
  lines: OfferLine[];
  /** Cost rate per member when the baseline was taken (userId -> rate per hour) */
  costRates: Record<ID, number>;
  /** Billing rate per member when the baseline was taken */
  billingRates: Record<ID, number>;
}

export interface Offer {
  id: ID;
  projectId: ID;
  /** e.g. JIG-O1 */
  number: string;
  title: string;
  status: OfferStatus;
  ownerId: ID;
  /** yyyy-MM-dd */
  issueDate: string;
  validUntil?: string;
  discountPct?: number;
  notes?: string;
  lines: OfferLine[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  acceptedAt?: string;
  orderedAt?: string;
}

export interface TimeEntry {
  id: ID;
  userId: ID;
  description: string;
  projectId?: ID;
  issueId?: ID;
  tagIds: ID[];
  billable: boolean;
  /** ISO date-time */
  start: string;
  /** ISO date-time; undefined while running */
  stop?: string;
  /** Generated from an allocation, never stored (see lib/allocations.ts) */
  virtual?: boolean;
  allocationId?: ID;
  percent?: number;
}

export interface StatusMeta {
  id: IssueStatus;
  name: string;
  category: "todo" | "inprogress" | "done";
}

export const STATUSES: StatusMeta[] = [
  { id: "todo", name: "To Do", category: "todo" },
  { id: "inprogress", name: "In Progress", category: "inprogress" },
  { id: "inreview", name: "In Review", category: "inprogress" },
  { id: "done", name: "Done", category: "done" },
];

export const PRIORITIES: { id: IssuePriority; name: string }[] = [
  { id: "highest", name: "Highest" },
  { id: "high", name: "High" },
  { id: "medium", name: "Medium" },
  { id: "low", name: "Low" },
  { id: "lowest", name: "Lowest" },
];

export const ISSUE_TYPES: { id: IssueType; name: string }[] = [
  { id: "epic", name: "Epic" },
  { id: "story", name: "Story" },
  { id: "task", name: "Task" },
  { id: "bug", name: "Bug" },
  { id: "subtask", name: "Subtask" },
];

/**
 * Project colour palette.
 * The first 8 slots are ordered so that adjacent pairs stay distinguishable under
 * colour-vision deficiency (validated with the dataviz palette checker, light surface).
 */
export const PROJECT_COLORS = [
  "#0b83d9",
  "#e36a00",
  "#06a893",
  "#9e5bd9",
  "#c7af14",
  "#d94182",
  "#2da608",
  "#465bb3",
  "#bf7000",
  "#990099",
  "#566614",
  "#d92b2b",
  "#525266",
];

export const AVATAR_COLORS = [
  "#0C66E4",
  "#6E5DC6",
  "#1F845A",
  "#C9372C",
  "#E56910",
  "#227D9B",
  "#943D73",
  "#5E4DB2",
];
