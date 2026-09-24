import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, requireSession } from "@/server/auth";
import { handler } from "@/server/http";
import { readWorkspace } from "@/server/workspace";

/** Everything the client needs on load: session, workspaces and the full workspace state. */
export const GET = handler(async () => {
  const session = await requireSession();
  const member = await prisma.member.findFirst({ where: { workspaceId: session.workspaceId, accountId: session.accountId } });
  if (!member) throw new HttpError(403, "You are not a member of this workspace");
  const [account, memberships, ws] = await Promise.all([
    prisma.account.findUnique({ where: { id: session.accountId } }),
    prisma.member.findMany({ where: { accountId: session.accountId }, include: { workspace: true } }),
    readWorkspace(session.workspaceId),
  ]);
  if (!account || !ws) throw new HttpError(404, "Workspace not found");
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
