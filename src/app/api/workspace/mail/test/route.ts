import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { HttpError, requireSession } from "@/server/auth";
import { handler, requestOrigin } from "@/server/http";
import { requireAdmin } from "@/server/members";
import { deliver, describeError, getMailConfig } from "@/server/mail";
import { testMail } from "@/lib/mail";

/** Sends a test message to the calling admin through the stored settings */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const admin = await requireAdmin(session);
  const config = await getMailConfig(session.workspaceId);
  if (!config) throw new HttpError(400, "Set up outgoing email first");
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: session.workspaceId }, select: { name: true } });
  try {
    await deliver(config, workspace.name, { name: admin.name, email: admin.email }, testMail({ workspace: workspace.name, origin: requestOrigin(req) }));
  } catch (e) {
    throw new HttpError(502, `Could not send: ${describeError(e)}`);
  }
  return NextResponse.json({ ok: true, to: admin.email });
});
