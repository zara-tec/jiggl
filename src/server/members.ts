import { prisma } from "./db";
import { HttpError, type SessionPayload } from "./auth";

export const DEACTIVATED_MESSAGE = "Your access to this workspace has been deactivated. Ask a workspace admin to reactivate it.";

/** The caller's member row in the session workspace, or 403 (also when an admin deactivated it) */
export async function requireMember(session: SessionPayload) {
  const member = await prisma.member.findFirst({ where: { workspaceId: session.workspaceId, accountId: session.accountId } });
  if (!member) throw new HttpError(403, "You are not a member of this workspace");
  if (member.deactivatedAt) throw new HttpError(403, DEACTIVATED_MESSAGE);
  return member;
}

/** Same, but the member must be a workspace admin */
export async function requireAdmin(session: SessionPayload) {
  const member = await requireMember(session);
  if (member.role !== "admin") throw new HttpError(403, "Only workspace admins can do this");
  return member;
}

/** The workspace an account lands in: its oldest active membership */
export async function firstActiveMembership(accountId: string) {
  return prisma.member.findFirst({ where: { accountId, deactivatedAt: null }, orderBy: { syncedAt: "asc" } });
}
