import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "./db";
import { buildSeed } from "@/lib/seed";
import type { WorkspaceSettings } from "@/lib/types";

/**
 * Generic bridge between the client collections and the Prisma models.
 * Rows and entities have the same shape; the only differences are the
 * workspaceId / syncedAt bookkeeping columns and null vs undefined.
 */
export const COLLECTIONS = ["users", "clients", "tags", "projects", "sprints", "issues", "timeEntries", "offers", "allocations", "holidays", "timeOffs"] as const;
export type Collection = (typeof COLLECTIONS)[number];

const MODEL: Record<Collection, string> = {
  users: "Member",
  clients: "Client",
  tags: "Tag",
  projects: "Project",
  sprints: "Sprint",
  issues: "Issue",
  timeEntries: "TimeEntry",
  offers: "Offer",
  allocations: "Allocation",
  holidays: "Holiday",
  timeOffs: "TimeOff",
};

const BOOKKEEPING = new Set(["workspaceId", "syncedAt", "accountId"]);

type Entity = Record<string, unknown>;
type Tx = Prisma.TransactionClient;

function fieldsOf(collection: Collection) {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === MODEL[collection]);
  if (!model) throw new Error(`Unknown model for ${collection}`);
  return model.fields.filter((f) => f.kind === "scalar" && !BOOKKEEPING.has(f.name));
}

const fieldCache = new Map<Collection, ReturnType<typeof fieldsOf>>();
function fields(collection: Collection) {
  let f = fieldCache.get(collection);
  if (!f) {
    f = fieldsOf(collection);
    fieldCache.set(collection, f);
  }
  return f;
}

function delegate(tx: Tx | typeof prisma, collection: Collection) {
  const name = MODEL[collection];
  const key = name.charAt(0).toLowerCase() + name.slice(1);
  return (tx as unknown as Record<string, unknown>)[key] as {
    upsert: (args: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<Entity[]>;
  };
}

/** Entity (client shape) -> row (Prisma shape). Unknown keys are dropped, undefined becomes null. */
export function toRow(collection: Collection, entity: Entity): Entity {
  const row: Entity = {};
  for (const f of fields(collection)) {
    const v = entity[f.name];
    if (v === undefined || v === null) {
      if (f.isRequired) row[f.name] = f.type === "Json" ? [] : f.type === "String" ? "" : f.type === "Boolean" ? false : 0;
      else row[f.name] = null;
    } else {
      row[f.name] = v;
    }
  }
  return row;
}

/** Row (Prisma shape) -> entity (client shape): nulls removed, bookkeeping stripped. */
export function fromRow(collection: Collection, row: Entity): Entity {
  const out: Entity = {};
  for (const f of fields(collection)) {
    const v = row[f.name];
    if (v !== null && v !== undefined) out[f.name] = v;
  }
  return out;
}

export function isCollection(x: string): x is Collection {
  return (COLLECTIONS as readonly string[]).includes(x);
}

export async function upsertMany(tx: Tx, workspaceId: string, collection: Collection, entities: Entity[]) {
  const d = delegate(tx, collection);
  for (const e of entities) {
    if (typeof e.id !== "string" || !e.id) continue;
    const row = toRow(collection, e);
    await d.upsert({ where: { workspaceId_id: { workspaceId, id: e.id } }, create: { workspaceId, ...row }, update: row });
  }
}

export async function deleteMany(tx: Tx, workspaceId: string, collection: Collection, ids: string[]) {
  if (ids.length === 0) return;
  await delegate(tx, collection).deleteMany({ where: { workspaceId, id: { in: ids } } });
}

/** Everything the client needs to boot a workspace. */
export async function readWorkspace(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;
  const data: Record<string, unknown> = { settings: workspace.settings };
  for (const c of COLLECTIONS) {
    const rows = await delegate(prisma, c).findMany({ where: { workspaceId }, orderBy: ORDER[c] });
    data[c] = rows.map((r) => fromRow(c, r));
  }
  return { workspace, data };
}

/** Stable ordering so the client sees the same lists regardless of insertion order */
const ORDER: Record<Collection, Record<string, "asc">[]> = {
  users: [{ name: "asc" }],
  clients: [{ name: "asc" }],
  tags: [{ name: "asc" }],
  projects: [{ createdAt: "asc" }],
  sprints: [{ order: "asc" }],
  issues: [{ rank: "asc" }],
  timeEntries: [{ start: "asc" }],
  offers: [{ createdAt: "asc" }],
  allocations: [{ from: "asc" }],
  holidays: [{ date: "asc" }],
  timeOffs: [{ from: "asc" }],
};

export const DEFAULT_SETTINGS: WorkspaceSettings = { name: "My workspace", currency: "EUR", hoursPerDay: 8, workDays: [1, 2, 3, 4, 5], dayStart: "09:00" };

export interface Owner {
  accountId: string;
  name: string;
  email: string;
}

/** Fill a workspace with the demo dataset; the owner becomes the seed's main user. */
export async function seedDemo(tx: Tx, workspaceId: string, owner: Owner) {
  const seed = buildSeed();
  const list = (x: unknown[]) => x as Entity[];
  const entities: Record<Collection, Entity[]> = {
    users: list(seed.users.map((u) => (u.id === "u_alex" ? { ...u, name: owner.name, email: owner.email, accountId: owner.accountId } : u))),
    clients: list(seed.clients),
    tags: list(seed.tags),
    projects: list(seed.projects),
    sprints: list(seed.sprints),
    issues: list(seed.issues),
    timeEntries: list(seed.timeEntries),
    offers: list(seed.offers),
    allocations: list(seed.allocations),
    holidays: list(seed.holidays),
    timeOffs: list(seed.timeOffs),
  };
  for (const c of COLLECTIONS) {
    const rows = entities[c].map((e) => ({ workspaceId, ...toRow(c, e), ...(c === "users" && e.accountId ? { accountId: e.accountId } : {}) }));
    if (rows.length) await delegate(tx, c).createMany({ data: rows });
  }
  await tx.workspace.update({ where: { id: workspaceId }, data: { settings: { ...DEFAULT_SETTINGS, name: "Jiggl demo" } } });
  return "u_alex";
}

/** Empty workspace: just the owner as admin member. */
export async function seedEmpty(tx: Tx, workspaceId: string, owner: Owner) {
  const id = nanoid(8);
  await tx.member.create({
    data: { workspaceId, id, accountId: owner.accountId, name: owner.name, email: owner.email, color: "#0C66E4", role: "admin", costRates: [] },
  });
  return id;
}

export async function wipeWorkspace(tx: Tx, workspaceId: string) {
  for (const c of COLLECTIONS) await delegate(tx, c).deleteMany({ where: { workspaceId } });
}

/** Link members that were invited by email before the person registered. */
export async function linkMemberships(tx: Tx, accountId: string, email: string) {
  await tx.member.updateMany({ where: { email: email.toLowerCase(), accountId: null }, data: { accountId } });
}
