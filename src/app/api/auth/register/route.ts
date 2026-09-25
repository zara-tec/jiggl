import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, hashPassword, setSessionCookie, slugify } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { DEFAULT_SETTINGS, linkMemberships, seedDemo, seedEmpty } from "@/server/workspace";
import { getInstance } from "@/server/instance";
import { registrationAllowed } from "@/lib/registration";

interface Body {
  name: string;
  email: string;
  password: string;
  workspaceName?: string;
  demo?: boolean;
}

export const POST = handler(async (req) => {
  const body = await readJson<Body>(req);
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!name) throw new HttpError(400, "Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (await prisma.account.findUnique({ where: { email } })) throw new HttpError(409, "An account with this email already exists");
  // the installation may limit registration; an invitation (a member row waiting for this email) always opens the door
  const invited = !!(await prisma.member.findFirst({ where: { email, accountId: null, deactivatedAt: null }, select: { id: true } }));
  const verdict = registrationAllowed(await getInstance(), email, invited);
  if (!verdict.ok) throw new HttpError(403, verdict.reason);

  const workspaceName = (body.workspaceName ?? "").trim() || `${name.split(" ")[0]}'s workspace`;
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({ data: { email, name, passwordHash: hashPassword(password) } });
    const workspace = await tx.workspace.create({ data: { name: workspaceName, slug: slugify(workspaceName), settings: { ...DEFAULT_SETTINGS, name: workspaceName } } });
    const owner = { accountId: account.id, name, email };
    if (body.demo) await seedDemo(tx, workspace.id, owner);
    else await seedEmpty(tx, workspace.id, owner);
    await linkMemberships(tx, account.id, email);
    return { account, workspace };
  }, { timeout: 30000 });

  await setSessionCookie({ accountId: result.account.id, workspaceId: result.workspace.id });
  return NextResponse.json({ ok: true, workspaceId: result.workspace.id });
});
