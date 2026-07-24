import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parseProfileInput } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const profiles = await prisma.playerProfile.findMany({
    where: { playerId: params.id },
    orderBy: [{ current: "desc" }, { season: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ profiles });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const player = await prisma.player.findUnique({ where: { id: params.id } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = parseProfileInput(body);
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Invalid data" }, { status: 400 });
  }

  const profile = await prisma.$transaction(async (tx) => {
    if (data.current) {
      await tx.playerProfile.updateMany({
        where: { playerId: params.id, current: true },
        data: { current: false },
      });
    }
    return tx.playerProfile.create({
      data: { ...(data as object), playerId: params.id, university: data.university! },
    });
  });

  await logAudit(session.user, {
    entity: "PlayerProfile",
    entityId: profile.id,
    entityName: `${player.name} — ${profile.university}`,
    action: "create",
    summary: `Added university profile “${profile.university}” to ${player.name}`,
  });

  return NextResponse.json({ profile });
}
