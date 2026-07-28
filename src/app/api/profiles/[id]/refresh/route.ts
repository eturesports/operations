import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { fetchProfileStats } from "@/lib/statsRefresh";
import { logAudit } from "@/lib/audit";

// POST /api/profiles/[id]/refresh — pull season stats for this profile.
// Prefers the player's own roster page (complete team stats); falls back to
// the NCAA national leaderboards matched by name.
// Reads several seasons of ~2MB stats feeds, which does not fit the
// default 10s function limit.
export const maxDuration = 60;

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
    include: { player: { select: { name: true, ncaaUrl: true } } },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  let result;
  try {
    result = await fetchProfileStats({
      playerName: profile.player.name,
      rosterUrl: profile.rosterUrl,
      ncaaUrl: profile.player.ncaaUrl,
      ncaaSport: profile.ncaaSport,
      ncaaDivision: profile.ncaaDivision,
      season: profile.season,
    });
  } catch (err) {
    console.error("stats lookup failed", err);
    return NextResponse.json(
      { error: "Could not reach the stats services. Try again later." },
      { status: 502 }
    );
  }

  if (!result.matched) {
    return NextResponse.json(
      { matched: false, reason: result.reason, candidates: result.candidates },
      { status: 200 }
    );
  }

  const updated = await prisma.playerProfile.update({
    where: { id: params.id },
    data: {
      ...result.patch,
      statsSource: result.source,
      statsUpdatedAt: new Date(),
    },
  });

  await logAudit(session.user, {
    entity: "PlayerProfile",
    entityId: updated.id,
    entityName: `${profile.player.name} — ${updated.university}`,
    action: "stats_refresh",
    summary: `Refreshed ${profile.player.name}'s stats from ${
      result.source === "roster-site" ? "their university roster page" : "the NCAA leaderboards"
    } (${result.matchedLabel})`,
    changes: result.patch,
  });

  return NextResponse.json({
    matched: true,
    profile: updated,
    source: result.source,
    seasonsCounted: result.seasonsCounted,
    ncaa: { name: result.matchedLabel, team: "" },
  });
}
