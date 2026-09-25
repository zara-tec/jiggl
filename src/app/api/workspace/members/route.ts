import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/server/db";
import { HttpError, hashPassword, requireSession } from "@/server/auth";
import { handler, readJson, requestOrigin } from "@/server/http";
import { requireAdmin } from "@/server/members";
import { trySend } from "@/server/mail";
import { invitationMail } from "@/lib/mail";
import { describeUsage, memberUsage, type UsageData } from "@/lib/team";
import { readWorkspace } from "@/server/workspace";

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
 * same email is linked instead (its password is not touched). When the
 * workspace has outgoing email, the invitation is emailed too (with the
 * welcome password when one was just issued); `mail` reports how that went.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const admin = await requireAdmin(session);
  const body = await readJson<Body>(req);
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!name) throw new HttpError(400, "Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email");
  if (body.password !== undefined && body.password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const ws = session.workspaceId;
  const already = await prisma.member.findFirst({ where: { workspaceId: ws, email } });
  if (already?.deactivatedAt) throw new HttpError(409, `${already.name} is deactivated in this workspace: reactivate them from the member menu`);
  if (already) throw new HttpError(409, "This email is already a member of the workspace");

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

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: ws }, select: { name: true } });
  const message = invitationMail({ workspace: workspace.name, inviter: admin.name, name, email, origin: requestOrigin(req), password: result.created ? body.password : undefined, existing: result.linked && !result.created });
  const mail = await trySend(ws, workspace.name, { name, email }, message);
  return NextResponse.json({ ok: true, id: result.member.id, linked: result.linked, accountCreated: result.created, mail });
});

/** The member an admin acts on, in the session workspace; never the admin themselves */
async function targetMember(req: Request, verb: string) {
  const session = await requireSession();
  const admin = await requireAdmin(session);
  const body = await readJson<{ memberId?: string; active?: boolean }>(req);
  const member = await prisma.member.findUnique({ where: { workspaceId_id: { workspaceId: session.workspaceId, id: body.memberId ?? "" } } });
  if (!member) throw new HttpError(404, "Member not found");
  if (member.id === admin.id) throw new HttpError(400, `You cannot ${verb} yourself`);
  return { session, member, body };
}

/**
 * Deactivate or reactivate a member (admins only). A deactivated member keeps
 * their history but can no longer open the workspace; the sync cannot change
 * this flag, only this route.
 */
export const PATCH = handler(async (req) => {
  const { member, body } = await targetMember(req, "deactivate");
  if (typeof body.active !== "boolean") throw new HttpError(400, "Say whether the member is active");
  const deactivatedAt = body.active ? null : (member.deactivatedAt ?? new Date().toISOString());
  await prisma.member.update({ where: { workspaceId_id: { workspaceId: member.workspaceId, id: member.id } }, data: { deactivatedAt } });
  return NextResponse.json({ ok: true, deactivatedAt });
});

/**
 * Remove a member from the workspace (admins only), only when nothing refers
 * to them (hours, work items, comments, plans...): otherwise deactivate them.
 * Their account, if any, stays and keeps its other workspaces.
 */
export const DELETE = handler(async (req) => {
  const { member } = await targetMember(req, "remove");
  const ws = await readWorkspace(member.workspaceId);
  if (!ws) throw new HttpError(404, "Workspace not found");
  const usage = memberUsage(member.id, ws.data as unknown as UsageData);
  if (usage.length) throw new HttpError(409, `${member.name} has ${describeUsage(usage)}: deactivate them instead`);
  await prisma.member.delete({ where: { workspaceId_id: { workspaceId: member.workspaceId, id: member.id } } });
  return NextResponse.json({ ok: true });
});
