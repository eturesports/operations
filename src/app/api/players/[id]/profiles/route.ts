import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parseProfileInput } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { ncaaDivisionFor, syncPlayerFromProfiles } from "@/lib/divisions";

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

  // The same university in the same season is not a second stint, it is a
  // second copy — and copies double the money on every count that adds
  // profiles up. One was created by hand this morning and cost $160,000 of
  // phantom scholarship before it was spotted.
  const clash = await prisma.playerProfile.findFirst({
    where: {
      player: player.personId ? { personId: player.personId } : { id: params.id },
      university: { equals: data.university!, mode: "insensitive" },
      season: (data.season as string | null) ?? null,
    },
    select: { id: true, university: true, season: true },
  });
  if (clash) {
    return NextResponse.json(
      {
        error: `${player.name} already has a profile for ${clash.university}${
          clash.season ? ` in ${clash.season}` : ""
        }. Edit that one instead.`,
      },
      { status: 409 }
    );
  }

  // A second college is a second operation. Rather than hiding it inside the
  // first record — where no count would ever see it — the profile is attached
  // to a new record for the same person, dated to the season it was assigned.
  // The money is never carried across: each university agrees its own.
  const existing = await prisma.playerProfile.count({ where: { playerId: params.id } });
  const target =
    existing === 0
      ? player
      : await prisma.player.create({
          data: {
            sportId: player.sportId,
            personId: player.personId,
            name: player.name,
            university: data.university!,
            season: (data.season as string | null) ?? player.season,
            division: (data.division as string | null) ?? player.division,
            program: player.program,
            nationality: player.nationality,
            position: player.position,
            previousClub: player.previousClub,
            instagramUrl: player.instagramUrl,
            graduated: player.graduated,
            graduationYear: player.graduationYear,
            createdById: session.user.id,
            updatedById: session.user.id,
          },
        });

  const profile = await prisma.$transaction(async (tx) => {
    if (data.current) {
      // Playing now is true of the person, so it clears across their records.
      await tx.playerProfile.updateMany({
        where: { player: { personId: player.personId }, current: true },
        data: { current: false },
      });
    }
    return tx.playerProfile.create({
      data: {
        ...(data as object),
        playerId: target.id,
        university: data.university!,
        // Derived from the division rather than asked for a second time.
        ncaaDivision: ncaaDivisionFor(data.division as string | null),
      },
    });
  });

  await syncPlayerFromProfiles(target.id);

  await logAudit(session.user, {
    entity: "PlayerProfile",
    entityId: profile.id,
    entityName: `${player.name} — ${profile.university}`,
    action: "create",
    summary: `Added university profile “${profile.university}” to ${player.name}`,
  });

  return NextResponse.json({
    profile,
    // The screen needs to know a new operation appeared, not just a profile.
    newOperation: target.id === player.id ? null : { id: target.id, name: target.name },
  });
}
