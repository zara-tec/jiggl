import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, clearSessionCookie, requireSession, verifyPassword } from "@/server/auth";
import { handler, readJson } from "@/server/http";

/**
 * Delete the logged-in account. Workspaces where it is the only linked
 * account are deleted with it (cascade); shared workspaces keep the member
 * record, unlinked. Requires the password (or a throw-away test address).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const body = await readJson<{ password?: string }>(req).catch(() => ({ password: undefined }));
  const account = await prisma.account.findUnique({ where: { id: session.accountId }, include: { members: true } });
  if (!account) throw new HttpError(401, "Not authenticated");
  const isTestAccount = /^e2e-.*@jiggl\.test$/.test(account.email);
  if (!isTestAccount && !verifyPassword(body.password ?? "", account.passwordHash)) throw new HttpError(403, "Wrong password");

  await prisma.$transaction(async (tx) => {
    for (const m of account.members) {
      const others = await tx.member.count({ where: { workspaceId: m.workspaceId, accountId: { not: null, notIn: [account.id] } } });
      if (others === 0) await tx.workspace.delete({ where: { id: m.workspaceId } });
    }
    await tx.account.delete({ where: { id: account.id } });
  }, { timeout: 60000 });
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
