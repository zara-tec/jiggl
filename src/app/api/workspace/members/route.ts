import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/server/db";
import { HttpError, hashPassword, requireSession } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { requireAdmin } from "@/server/members";

interface Body {
  id?: string;
  name: string;
  email: string;
  role?: string;
  color?: string;
  costRates?: { from: string; rate: number }[];
  /** Welcome password: creates the account so the person can sign in right away */
  password?: string;
}

/**
 * Invite a member (admins only). The member row is created here, before the
 * client store syncs it, so that an account with a welcome password can be
 * created and linked in the same transaction. An existing account with the
 * same email is linked instead (its password is not touched).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await requireAdmin(session);
  const body = await readJson<Body>(req);
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!name) throw new HttpError(400, "Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email");
  if (body.password !== undefined && body.password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const ws = session.workspaceId;
  if (await prisma.member.findFirst({ where: { workspaceId: ws, email } })) throw new HttpError(409, "This email is already a member of the workspace");

  const result = await prisma.$transaction(async (tx) => {
    let account = await tx.account.findUnique({ where: { email } });
    let created = false;
    if (!account && body.password) {
      account = await tx.account.create({ data: { email, name, passwordHash: hashPassword(body.password) } });
      created = true;
    }
    const member = await tx.member.create({
      data: {
        workspaceId: ws,
        id: typeof body.id === "string" && body.id ? body.id : nanoid(8),
        accountId: account?.id ?? null,
        name,
        email,
        color: body.color ?? "#0C66E4",
        role: body.role === "admin" || body.role === "pm" ? body.role : "member",
        costRates: Array.isArray(body.costRates) ? body.costRates : [],
      },
    });
    return { member, created, linked: !!account };
  });
  return NextResponse.json({ ok: true, id: result.member.id, linked: result.linked, accountCreated: result.created });
});
