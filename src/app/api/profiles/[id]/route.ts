import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parseProfileInput } from "@/lib/validation";
import { logAudit, diffFields } from "@/lib/audit";
import { ncaaDivisionFor, syncPlayerDivision } from "@/lib/divisions";

export async function PATCH(
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

  const existing = await prisma.playerProfile.findUnique({
    where: { id: params.id },
    include: { player: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = parseProfileInput(body, { partial: true });
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Invalid data" }, { status: 400 });
  }

  // When any stats field is edited by hand, mark the source as manual.
  const statsFields = [
    "matchesPlayed", "matchesStarted", "minutes", "goals",
    "assists", "points", "saves", "goalsAgainst",
  ];
  const touchedStats = statsFields.some((f) => f in data);

  const profile = await prisma.$transaction(async (tx) => {
    if (data.current) {
      await tx.playerProfile.updateMany({
        where: { playerId: existing.playerId, current: true, NOT: { id: params.id } },
        data: { current: false },
      });
    }
    return tx.playerProfile.update({
      where: { id: params.id },
      data: {
        ...(data as object),
        // Derived from the division rather than asked for a second time.
        ...(data.division !== undefined
          ? { ncaaDivision: ncaaDivisionFor(data.division as string | null) }
          : {}),
        ...(touchedStats
          ? { statsSource: "manual", statsUpdatedAt: new Date() }
          : {}),
      },
    });
  });

  await syncPlayerDivision(existing.playerId);

  const changes = diffFields(
    existing as unknown as Record<string, unknown>,
    data as Record<string, unknown>,
    Object.keys(data)
  );
  if (changes) {
    await logAudit(session.user, {
      entity: "PlayerProfile",
      entityId: profile.id,
      entityName: `${existing.player.name} — ${profile.university}`,
      action: "update",
      summary: `Edited ${existing.player.name}'s profile at ${profile.university}`,
      changes,
    });
  }

  return NextResponse.json({ profile });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const existing = await prisma.playerProfile.findUnique({
    where: { id: params.id },
    include: { player: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  await prisma.playerProfile.delete({ where: { id: params.id } });
  await syncPlayerDivision(existing.playerId);

  await logAudit(session.user, {
    entity: "PlayerProfile",
    entityId: existing.id,
    entityName: `${existing.player.name} — ${existing.university}`,
    action: "delete",
    summary: `Removed ${existing.player.name}'s profile at ${existing.university}`,
  });

  return NextResponse.json({ ok: true });
}
