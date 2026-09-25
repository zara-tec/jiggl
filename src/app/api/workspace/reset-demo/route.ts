import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, requireSession } from "@/server/auth";
import { handler } from "@/server/http";
import { requireMember } from "@/server/members";
import { seedDemo, wipeWorkspace } from "@/server/workspace";

/** Replace everything in the current workspace with the demo dataset. */
export const POST = handler(async () => {
  const session = await requireSession();
  const member = await requireMember(session);
  if (member.role !== "admin") throw new HttpError(403, "Only admins can reset a workspace");
  const account = await prisma.account.findUnique({ where: { id: session.accountId } });
  if (!account) throw new HttpError(401, "Not authenticated");
  await prisma.$transaction(async (tx) => {
    await wipeWorkspace(tx, session.workspaceId);
    await seedDemo(tx, session.workspaceId, { accountId: account.id, name: account.name, email: account.email });
  }, { timeout: 60000 });
  return NextResponse.json({ ok: true });
});
