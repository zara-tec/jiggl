import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireSession } from "@/server/auth";
import { requireMember } from "@/server/members";
import { handler, readJson } from "@/server/http";
import { deleteMany, isCollection, upsertMany } from "@/server/workspace";
import type { WorkspaceSettings } from "@/lib/types";

interface Body {
  upserts?: Record<string, Record<string, unknown>[]>;
  deletes?: Record<string, string[]>;
  settings?: WorkspaceSettings;
}

/**
 * Write-through sync from the client store: batches of upserted entities and
 * deleted ids per collection, applied in one transaction. Last write wins.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await requireMember(session);
  const body = await readJson<Body>(req);
  const ws = session.workspaceId;
  let count = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const [c, list] of Object.entries(body.upserts ?? {})) {
        if (!isCollection(c) || !Array.isArray(list)) continue;
        await upsertMany(tx, ws, c, list);
        count += list.length;
      }
      for (const [c, ids] of Object.entries(body.deletes ?? {})) {
        if (!isCollection(c) || !Array.isArray(ids)) continue;
        await deleteMany(tx, ws, c, ids.filter((x) => typeof x === "string"));
        count += ids.length;
      }
      if (body.settings && typeof body.settings === "object") {
        await tx.workspace.update({ where: { id: ws }, data: { settings: body.settings as unknown as Prisma.InputJsonValue, name: body.settings.name || undefined } });
        count += 1;
      }
    },
    { timeout: 30000 },
  );
  return NextResponse.json({ ok: true, count });
});
