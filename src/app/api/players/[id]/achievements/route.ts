import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canContribute } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// GET /api/players/[id]/achievements — everything recorded for this player.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const achievements = await prisma.achievement.findMany({
    where: { playerId: params.id },
    orderBy: [{ season: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ achievements });
}

// POST /api/players/[id]/achievements — record something a player did.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canContribute(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "An achievement needs some text" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const achievement = await prisma.achievement.create({
    data: {
      playerId: player.id,
      text,
      season: body?.season?.trim() || null,
      kind: body?.kind?.trim() || null,
      source: body?.source?.trim() || null,
    },
  });

  await logAudit(session.user, {
    entity: "Achievement",
    entityId: achievement.id,
    entityName: player.name,
    action: "create",
    summary: `Added an achievement for ${player.name}`,
    changes: { season: achievement.season, kind: achievement.kind, text },
  });

  return NextResponse.json({ achievement }, { status: 201 });
}
