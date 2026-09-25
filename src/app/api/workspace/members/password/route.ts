import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, hashPassword, requireSession } from "@/server/auth";
import { handler, readJson, requestOrigin } from "@/server/http";
import { requireAdmin } from "@/server/members";
import { trySend } from "@/server/mail";
import { passwordMail } from "@/lib/mail";

/**
 * Set or reset a member's password (admins only). Creates the account when
 * the member has none. Refuses when the account also belongs to a workspace
 * the caller does not administer: that person changes it from Settings.
 * With outgoing email set up, the new password is emailed to the member;
 * `mail` reports how that went.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const admin = await requireAdmin(session);
  const body = await readJson<{ memberId: string; password: string }>(req);
  const password = body.password ?? "";
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const member = await prisma.member.findUnique({ where: { workspaceId_id: { workspaceId: session.workspaceId, id: body.memberId ?? "" } } });
  if (!member) throw new HttpError(404, "Member not found");
  if (member.id === admin.id) throw new HttpError(400, "Change your own password from Settings");
  if (member.deactivatedAt) throw new HttpError(409, `${member.name} is deactivated: reactivate them first`);
  const email = member.email.toLowerCase();

  const created = await prisma.$transaction(async (tx) => {
    const account = member.accountId ? await tx.account.findUnique({ where: { id: member.accountId }, include: { members: true } }) : await tx.account.findUnique({ where: { email }, include: { members: true } });
    if (!account) {
      const fresh = await tx.account.create({ data: { email, name: member.name, passwordHash: hashPassword(password) } });
      await tx.member.update({ where: { workspaceId_id: { workspaceId: member.workspaceId, id: member.id } }, data: { accountId: fresh.id } });
      return true;
    }
    const foreign = [...new Set(account.members.map((m) => m.workspaceId))].filter((w) => w !== session.workspaceId);
    if (foreign.length) {
      const administered = await tx.member.count({ where: { accountId: session.accountId, role: "admin", workspaceId: { in: foreign } } });
      if (administered < foreign.length) throw new HttpError(403, "This person also belongs to a workspace you do not administer: they can change their password from Settings");
    }
    await tx.account.update({ where: { id: account.id }, data: { passwordHash: hashPassword(password) } });
    if (!member.accountId) await tx.member.update({ where: { workspaceId_id: { workspaceId: member.workspaceId, id: member.id } }, data: { accountId: account.id } });
    return false;
  });

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: session.workspaceId }, select: { name: true } });
  const message = passwordMail({ workspace: workspace.name, admin: admin.name, name: member.name, email, origin: requestOrigin(req), password, created });
  const mail = await trySend(session.workspaceId, workspace.name, { name: member.name, email }, message);
  return NextResponse.json({ ok: true, accountCreated: created, mail });
});
