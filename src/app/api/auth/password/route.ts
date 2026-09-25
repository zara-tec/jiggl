import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, hashPassword, requireSession, verifyPassword } from "@/server/auth";
import { handler, readJson } from "@/server/http";

/** Change the password of the logged-in account (current password required). */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const body = await readJson<{ currentPassword: string; newPassword: string }>(req);
  const next = body.newPassword ?? "";
  if (next.length < 8) throw new HttpError(400, "The new password must be at least 8 characters");
  const account = await prisma.account.findUnique({ where: { id: session.accountId } });
  if (!account) throw new HttpError(401, "Not authenticated");
  if (!verifyPassword(body.currentPassword ?? "", account.passwordHash)) throw new HttpError(403, "The current password is wrong");
  await prisma.account.update({ where: { id: account.id }, data: { passwordHash: hashPassword(next) } });
  return NextResponse.json({ ok: true });
});
