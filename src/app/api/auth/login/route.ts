import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, setSessionCookie, verifyPassword } from "@/server/auth";
import { handler, readJson } from "@/server/http";

export const POST = handler(async (req) => {
  const body = await readJson<{ email: string; password: string }>(req);
  const email = (body.email ?? "").trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email }, include: { members: { orderBy: { syncedAt: "asc" } } } });
  if (!account || !verifyPassword(body.password ?? "", account.passwordHash)) throw new HttpError(401, "Wrong email or password");
  const first = account.members[0];
  if (!first) throw new HttpError(403, "This account has no workspace");
  await setSessionCookie({ accountId: account.id, workspaceId: first.workspaceId });
  return NextResponse.json({ ok: true, workspaceId: first.workspaceId });
});
