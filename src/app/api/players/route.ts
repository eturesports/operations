import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { personIdFor } from "@/lib/person";
import { setPlayingNow } from "@/lib/profiles";
import { syncPlayerFromProfiles } from "@/lib/divisions";
import type { Prisma } from "@prisma/client";

// GET /api/players?sport=MSOC&season=24/25&division=Division I&program=...&q=texto
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const where: Prisma.PlayerWhereInput = {};

  const sport = searchParams.get("sport");
  if (sport) where.sport = { code: sport };
  const season = searchParams.get("season");
  if (season) where.season = season;
  const division = searchParams.get("division");
  if (division) where.division = division;
  const program = searchParams.get("program");
  if (program) where.program = program;
  const q = searchParams.get("q");
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { university: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const players = await prisma.player.findMany({
    where,
    include: { sport: { select: { code: true, name: true } } },
    orderBy: [{ season: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ players });
}

// POST /api/players
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = parsePlayerInput(body);
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Invalid data" }, { status: 400 });
  }

  const sport = await prisma.sport.findUnique({ where: { id: data.sportId! } });
  if (!sport) {
    return NextResponse.json({ error: "Sport not found" }, { status: 400 });
  }

  const player = await prisma.player.create({
    data: {
      sportId: data.sportId!,
      name: data.name!,
      // A second operation for someone already in the database joins them
      // rather than starting a stranger with the same name.
      personId: await personIdFor(data.name!),
      university: data.university ?? null,
      season: data.season ?? null,
      division: data.division ?? null,
      program: data.program ?? null,
      scholarship: data.scholarship ?? null,
      fullRide: data.fullRide ?? false,
      notes: data.notes ?? null,
      legacyNumber: data.legacyNumber ?? null,
      active: data.active ?? true,
      graduated: data.graduated ?? false,
      graduationYear: data.graduationYear ?? null,
      nationalChampion: data.nationalChampion ?? false,
      mlsDraftYear: data.mlsDraftYear ?? null,
      mlsDraftClub: data.mlsDraftClub ?? null,
      mlsDraftRound: data.mlsDraftRound ?? null,
      mlsDraftPick: data.mlsDraftPick ?? null,
      profileImageUrl: data.profileImageUrl ?? null,
      actionImageUrl: data.actionImageUrl ?? null,
      ncaaUrl: data.ncaaUrl ?? null,
      instagramUrl: data.instagramUrl ?? null,
      nationality: data.nationality ?? null,
      position: data.position ?? null,
      previousClub: data.previousClub ?? null,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
    include: { sport: { select: { code: true, name: true } } },
  });

  await logAudit(session.user, {
    entity: "Player",
    entityId: player.id,
    entityName: player.name,
    action: "create",
    summary: `Created player “${player.name}”`,
  });

  // The college profile is where a stint's facts live — the money agreed, the
  // division, the photos taken in that shirt — so an operation is not complete
  // without one. Signing a player is exactly when none of that exists yet: no
  // roster page has been published, so the link is deliberately left empty and
  // added later, and the profile is created from what is known today.
  if (data.university) {
    const profile = await prisma.playerProfile.create({
      data: {
        playerId: player.id,
        university: data.university,
        season: data.season ?? null,
        division: data.division ?? null,
        scholarship: data.scholarship ?? null,
        fullRide: data.fullRide ?? false,
        // Being signed is not the same as being on a roster; "playing now" is
        // its own deliberate choice, applied just below when it was made.
        current: false,
      },
    });

    await logAudit(session.user, {
      entity: "PlayerProfile",
      entityId: profile.id,
      entityName: `${player.name} — ${profile.university}`,
      action: "create",
      summary: `Opened ${player.name}'s ${profile.university} profile with the new operation`,
      changes: {
        university: profile.university,
        season: profile.season,
        scholarship: profile.scholarship,
        fullRide: profile.fullRide,
      },
    });
  }

  if (body.playingNow) await setPlayingNow(player.id, true);

  // The record mirrors its profiles, so it is refreshed from the one just
  // created rather than left holding a separate copy that could drift.
  await syncPlayerFromProfiles(player.id);
  const saved = await prisma.player.findUnique({
    where: { id: player.id },
    include: { sport: { select: { code: true, name: true } } },
  });

  return NextResponse.json({ player: saved ?? player }, { status: 201 });
}
