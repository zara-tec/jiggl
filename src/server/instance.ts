import { prisma } from "./db";
import { HttpError, type SessionPayload } from "./auth";
import { DEFAULT_INSTANCE, isRegistrationPolicy, type InstanceSettings } from "@/lib/registration";

const ID = "main";

export interface InstanceRow extends InstanceSettings {
  ownerAccountId: string | null;
}

/**
 * The single row of installation settings, created on first use. The owner
 * starts as the oldest account, or the account named by INSTANCE_OWNER_EMAIL
 * (checked on every read, so the variable can claim ownership at any time),
 * and can hand over from Settings.
 */
export async function getInstance(): Promise<InstanceRow> {
  let row = await prisma.instance.findUnique({ where: { id: ID } });
  if (!row) {
    const oldest = await prisma.account.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    row = await prisma.instance.upsert({ where: { id: ID }, create: { id: ID, registration: "open", domains: [], ownerAccountId: oldest?.id ?? null }, update: {} });
  }
  const claim = (process.env.INSTANCE_OWNER_EMAIL ?? "").trim().toLowerCase();
  if (claim) {
    const account = await prisma.account.findUnique({ where: { email: claim }, select: { id: true } });
    if (account && row.ownerAccountId !== account.id) row = await prisma.instance.update({ where: { id: ID }, data: { ownerAccountId: account.id } });
  }
  if (!row.ownerAccountId) {
    const oldest = await prisma.account.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    if (oldest) row = await prisma.instance.update({ where: { id: ID }, data: { ownerAccountId: oldest.id } });
  }
  return {
    registration: isRegistrationPolicy(row.registration) ? row.registration : DEFAULT_INSTANCE.registration,
    domains: Array.isArray(row.domains) ? (row.domains as unknown[]).filter((d): d is string => typeof d === "string") : [],
    ownerAccountId: row.ownerAccountId,
  };
}

export async function isInstanceOwner(session: SessionPayload | null): Promise<boolean> {
  if (!session) return false;
  const inst = await getInstance();
  return !!inst.ownerAccountId && inst.ownerAccountId === session.accountId;
}

export async function requireInstanceOwner(session: SessionPayload) {
  if (!(await isInstanceOwner(session))) throw new HttpError(403, "Only the instance owner can change this");
}

export async function saveInstance(patch: Partial<InstanceRow>) {
  return prisma.instance.update({ where: { id: ID }, data: { ...(patch.registration ? { registration: patch.registration } : {}), ...(patch.domains ? { domains: patch.domains } : {}), ...(patch.ownerAccountId ? { ownerAccountId: patch.ownerAccountId } : {}) } });
}
