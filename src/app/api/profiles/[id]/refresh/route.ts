import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { lookupPlayerStats } from "@/lib/ncaa";
import { logAudit } from "@/lib/audit";

// POST /api/profiles/[id]/refresh — pull season stats from the public NCAA API
// and write them onto the profile. Matches by player name across the tracked
// individual-stat leaderboards for the profile's sport/division/season.
export async function POST(
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

  const profile = await prisma.playerProfile.findUnique({
    where: { id: params.id },
    include: { player: { select: { name: true } } },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let result;
  try {
    result = await lookupPlayerStats({
      name: profile.player.name,
      sport: profile.ncaaSport,
      division: profile.ncaaDivision,
      season: profile.season,
    });
  } catch (err) {
    console.error("NCAA lookup failed", err);
    return NextResponse.json(
      { error: "Could not reach the NCAA stats service. Try again later." },
      { status: 502 }
    );
  }

  if (!result.matched || !result.stats) {
    return NextResponse.json(
      { matched: false, reason: result.reason, candidates: result.candidates ?? [] },
      { status: 200 }
    );
  }

  const s = result.stats;
  const updated = await prisma.playerProfile.update({
    where: { id: params.id },
    data: {
      matchesPlayed: s.games ?? null,
      goals: s.goals ?? null,
      assists: s.assists ?? null,
      points: s.points ?? null,
      minutes: s.minutes ?? null,
      saves: s.saves ?? null,
      statsSource: "ncaa-api",
      statsUpdatedAt: new Date(),
    },
  });

  await logAudit(session.user, {
    entity: "PlayerProfile",
    entityId: updated.id,
    entityName: `${profile.player.name} — ${updated.university}`,
    action: "stats_refresh",
    summary: `Refreshed ${profile.player.name}'s stats from NCAA (matched ${s.name}, ${s.team})`,
    changes: {
      games: s.games ?? null,
      goals: s.goals ?? null,
      assists: s.assists ?? null,
      points: s.points ?? null,
      minutes: s.minutes ?? null,
      saves: s.saves ?? null,
    },
  });

  return NextResponse.json({
    matched: true,
    profile: updated,
    ncaa: { name: s.name, team: s.team },
  });
}
