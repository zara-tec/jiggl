import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, setSessionCookie, verifyPassword } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { DEACTIVATED_MESSAGE } from "@/server/members";

export const POST = handler(async (req) => {
  const body = await readJson<{ email: string; password: string }>(req);
  const email = (body.email ?? "").trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email }, include: { members: { orderBy: { syncedAt: "asc" } } } });
  if (!account || !verifyPassword(body.password ?? "", account.passwordHash)) throw new HttpError(401, "Wrong email or password");
  const first = account.members.find((m) => !m.deactivatedAt);
  if (!first) throw new HttpError(403, account.members.length ? DEACTIVATED_MESSAGE : "This account has no workspace");
  await setSessionCookie({ accountId: account.id, workspaceId: first.workspaceId });
  return NextResponse.json({ ok: true, workspaceId: first.workspaceId });
});
