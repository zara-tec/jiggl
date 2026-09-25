import { prisma } from "./db";
import { HttpError, type SessionPayload } from "./auth";

/** The caller's member row in the session workspace, or 403 */
export async function requireMember(session: SessionPayload) {
  const member = await prisma.member.findFirst({ where: { workspaceId: session.workspaceId, accountId: session.accountId } });
  if (!member) throw new HttpError(403, "You are not a member of this workspace");
  return member;
}

/** Same, but the member must be a workspace admin */
export async function requireAdmin(session: SessionPayload) {
  const member = await requireMember(session);
  if (member.role !== "admin") throw new HttpError(403, "Only workspace admins can do this");
  return member;
}
