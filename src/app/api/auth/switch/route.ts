import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, requireSession, setSessionCookie } from "@/server/auth";
import { handler, readJson } from "@/server/http";

/** Switch the session to another workspace the account belongs to. */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const { workspaceId } = await readJson<{ workspaceId: string }>(req);
  const member = await prisma.member.findFirst({ where: { workspaceId, accountId: session.accountId } });
  if (!member) throw new HttpError(403, "You are not a member of that workspace");
  await setSessionCookie({ accountId: session.accountId, workspaceId });
  return NextResponse.json({ ok: true });
});
