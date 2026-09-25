import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, getSession, requireSession } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { getInstance, isInstanceOwner, requireInstanceOwner, saveInstance } from "@/server/instance";
import { isRegistrationPolicy, parseDomains } from "@/lib/registration";

/**
 * Installation settings. Anyone (even logged out) reads the registration
 * policy, which the register page explains; the owner also gets who owns the
 * instance and can change everything.
 */
export const GET = handler(async () => {
  const session = await getSession();
  const inst = await getInstance();
  const owner = await isInstanceOwner(session);
  const body: Record<string, unknown> = { registration: inst.registration, domains: inst.domains, owner };
  if (owner && inst.ownerAccountId) {
    const account = await prisma.account.findUnique({ where: { id: inst.ownerAccountId }, select: { email: true, name: true } });
    body.ownerEmail = account?.email;
    body.ownerName = account?.name;
  }
  return NextResponse.json(body);
});

interface Body {
  registration?: string;
  domains?: string | string[];
  /** Member of the current workspace whose account becomes the owner */
  ownerMemberId?: string;
}

export const POST = handler(async (req) => {
  const session = await requireSession();
  await requireInstanceOwner(session);
  const body = await readJson<Body>(req);
  const patch: Parameters<typeof saveInstance>[0] = {};
  if (body.registration !== undefined) {
    if (!isRegistrationPolicy(body.registration)) throw new HttpError(400, "Unknown registration policy");
    patch.registration = body.registration;
  }
  if (body.domains !== undefined) patch.domains = parseDomains(Array.isArray(body.domains) ? body.domains.join(",") : String(body.domains));
  if (body.ownerMemberId) {
    const member = await prisma.member.findUnique({ where: { workspaceId_id: { workspaceId: session.workspaceId, id: body.ownerMemberId } } });
    if (!member?.accountId) throw new HttpError(400, "That member has no account yet: give them a password first");
    if (member.deactivatedAt) throw new HttpError(400, "That member is deactivated");
    patch.ownerAccountId = member.accountId;
  }
  await saveInstance(patch);
  const inst = await getInstance();
  return NextResponse.json({ ok: true, registration: inst.registration, domains: inst.domains, owner: inst.ownerAccountId === session.accountId });
});
