import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, requireSession, setSessionCookie } from "@/server/auth";
import { handler } from "@/server/http";
import { DEACTIVATED_MESSAGE, firstActiveMembership } from "@/server/members";
import { readWorkspace } from "@/server/workspace";

/**
 * Everything the client needs on load: session, workspaces and the full workspace state.
 * When the session workspace is no longer open to the account (removed or deactivated
 * there), the session moves to another workspace of the account, if it has one.
 */
export const GET = handler(async () => {
  const session = await requireSession();
  const here = await prisma.member.findFirst({ where: { workspaceId: session.workspaceId, accountId: session.accountId } });
  let member = here && !here.deactivatedAt ? here : null;
  if (!member) {
    member = await firstActiveMembership(session.accountId);
    if (!member) throw new HttpError(403, here ? DEACTIVATED_MESSAGE : "You are no longer a member of any workspace. Ask a workspace admin to invite you again.");
    await setSessionCookie({ accountId: session.accountId, workspaceId: member.workspaceId });
  }
  const [account, memberships, ws] = await Promise.all([
    prisma.account.findUnique({ where: { id: session.accountId } }),
    prisma.member.findMany({ where: { accountId: session.accountId, deactivatedAt: null }, include: { workspace: true } }),
    readWorkspace(member.workspaceId),
  ]);
  if (!account || !ws) throw new HttpError(404, "Workspace not found");
  // which members can sign in (linked to an account): read-only information for the Team page
  const linked = new Set((await prisma.member.findMany({ where: { workspaceId: ws.workspace.id, accountId: { not: null } }, select: { id: true } })).map((m) => m.id));
  ws.data.users = (ws.data.users as { id: string }[]).map((u) => ({ ...u, linked: linked.has(u.id) }));
  return NextResponse.json({
    session: {
      accountId: account.id,
      accountEmail: account.email,
      memberId: member.id,
      workspaceId: ws.workspace.id,
      workspaceName: ws.workspace.name,
      workspaces: memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role })),
    },
    data: ws.data,
  });
});
