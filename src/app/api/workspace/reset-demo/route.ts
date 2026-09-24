import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, requireSession } from "@/server/auth";
import { handler } from "@/server/http";
import { seedDemo, wipeWorkspace } from "@/server/workspace";

/** Replace everything in the current workspace with the demo dataset. */
export const POST = handler(async () => {
  const session = await requireSession();
  const member = await prisma.member.findFirst({ where: { workspaceId: session.workspaceId, accountId: session.accountId } });
  if (!member) throw new HttpError(403, "You are not a member of this workspace");
  if (member.role !== "admin") throw new HttpError(403, "Only admins can reset a workspace");
  const account = await prisma.account.findUnique({ where: { id: session.accountId } });
  if (!account) throw new HttpError(401, "Not authenticated");
  await prisma.$transaction(async (tx) => {
    await wipeWorkspace(tx, session.workspaceId);
    await seedDemo(tx, session.workspaceId, { accountId: account.id, name: account.name, email: account.email });
  }, { timeout: 60000 });
  return NextResponse.json({ ok: true });
});
