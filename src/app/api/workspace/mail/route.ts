import { NextResponse } from "next/server";
import { HttpError, requireSession } from "@/server/auth";
import { handler, readJson } from "@/server/http";
import { requireAdmin } from "@/server/members";
import { deleteMailConfig, getMailConfig, mailView, saveMailConfig } from "@/server/mail";
import { parseMailSettings } from "@/lib/mail";

/**
 * Outgoing email of the workspace (admins only). The password is written but
 * never read back: the client only learns whether one is stored.
 */
export const GET = handler(async () => {
  const session = await requireSession();
  await requireAdmin(session);
  const config = await getMailConfig(session.workspaceId);
  return NextResponse.json({ configured: !!config, settings: config ? mailView(config) : null });
});

interface Body {
  /** Forget the settings: invitations go back to being shared by hand */
  remove?: boolean;
  /** Omitted or empty keeps the stored password */
  password?: string;
}

export const POST = handler(async (req) => {
  const session = await requireSession();
  await requireAdmin(session);
  const body = await readJson<Body>(req);
  if (body.remove) {
    await deleteMailConfig(session.workspaceId);
    return NextResponse.json({ ok: true, configured: false, settings: null });
  }
  const parsed = parseMailSettings(body);
  if (!parsed.ok) throw new HttpError(400, parsed.error);
  const password = typeof body.password === "string" && body.password ? body.password : undefined;
  if (parsed.value.user) {
    const existing = await getMailConfig(session.workspaceId);
    if (!password && !existing?.encryptedPassword) throw new HttpError(400, "Enter the SMTP password");
  }
  // without a username there is nothing to authenticate with: drop any stored password
  await saveMailConfig(session.workspaceId, parsed.value, parsed.value.user ? password : "");
  const config = await getMailConfig(session.workspaceId);
  return NextResponse.json({ ok: true, configured: !!config, settings: config ? mailView(config) : null });
});
