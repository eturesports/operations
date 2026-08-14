import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canContribute, canEdit } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

/** Editing an achievement changes what is there; removing one takes it away,
 *  which is the line a contributor does not cross. */
async function gateFor(kind: "edit" | "remove") {
  const session = await auth();
  if (!session?.user) return { error: "Not authenticated", status: 401 } as const;
  const allowed =
    kind === "edit" ? canContribute(session.user.role) : canEdit(session.user.role);
  if (!allowed) return { error: "No permission", status: 403 } as const;
  return { user: session.user } as const;
}

// PATCH /api/achievements/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await gateFor("edit");
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => null);
  const existing = await prisma.achievement.findUnique({
    where: { id: params.id },
    include: { player: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const text = typeof body?.text === "string" ? body.text.trim() : existing.text;
  if (!text) {
    return NextResponse.json({ error: "An achievement needs some text" }, { status: 400 });
  }

  const achievement = await prisma.achievement.update({
    where: { id: params.id },
    data: {
      text,
      season: body?.season !== undefined ? body.season?.trim() || null : existing.season,
      kind: body?.kind !== undefined ? body.kind?.trim() || null : existing.kind,
      source: body?.source !== undefined ? body.source?.trim() || null : existing.source,
    },
  });

  await logAudit(gate.user, {
    entity: "Achievement",
    entityId: achievement.id,
    entityName: existing.player.name,
    action: "update",
    summary: `Edited an achievement for ${existing.player.name}`,
    changes: { season: achievement.season, kind: achievement.kind, text: achievement.text },
  });

  return NextResponse.json({ achievement });
}

// DELETE /api/achievements/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await gateFor("remove");
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const existing = await prisma.achievement.findUnique({
    where: { id: params.id },
    include: { player: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.achievement.delete({ where: { id: params.id } });

  await logAudit(gate.user, {
    entity: "Achievement",
    entityId: params.id,
    entityName: existing.player.name,
    action: "delete",
    summary: `Removed an achievement from ${existing.player.name}`,
    // Kept in the log so a deletion by mistake can be typed back.
    changes: { season: existing.season, kind: existing.kind, text: existing.text },
  });

  return NextResponse.json({ ok: true });
}
