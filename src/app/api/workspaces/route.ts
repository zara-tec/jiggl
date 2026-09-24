import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, requireSession, setSessionCookie, slugify } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { DEFAULT_SETTINGS, seedDemo, seedEmpty } from "@/server/workspace";

/** Create another workspace for the logged-in account and switch to it. */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const body = await readJson<{ name: string; demo?: boolean }>(req);
  const name = (body.name ?? "").trim();
  if (!name) throw new HttpError(400, "Name is required");
  const account = await prisma.account.findUnique({ where: { id: session.accountId } });
  if (!account) throw new HttpError(401, "Not authenticated");
  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({ data: { name, slug: slugify(name), settings: { ...DEFAULT_SETTINGS, name } } });
    const owner = { accountId: account.id, name: account.name, email: account.email };
    if (body.demo) await seedDemo(tx, ws.id, owner);
    else await seedEmpty(tx, ws.id, owner);
    return ws;
  }, { timeout: 30000 });
  await setSessionCookie({ accountId: account.id, workspaceId: workspace.id });
  return NextResponse.json({ ok: true, workspaceId: workspace.id });
});
