import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { fetchProfileStats } from "@/lib/statsRefresh";
import { logAudit } from "@/lib/audit";

// POST /api/players/[id]/refresh-stats
// Player-level refresh: reads the player's own NCAA profile link and pulls
// their season totals. If they have no university profile yet, one is created
// from what the roster page reports, so a single click is enough to go from
// "just a link" to a tracked, up-to-date player.
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

  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: {
      profiles: { orderBy: [{ current: "desc" }, { createdAt: "desc" }], take: 1 },
    },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const existing = player.profiles[0] ?? null;
  const link = existing?.rosterUrl?.trim() || player.ncaaUrl?.trim();
  if (!link && !player.name) {
    return NextResponse.json(
      { matched: false, reason: "Add the player's NCAA profile link first." },
      { status: 200 }
    );
  }

  let result;
  try {
    result = await fetchProfileStats({
      playerName: player.name,
      rosterUrl: existing?.rosterUrl,
      ncaaUrl: player.ncaaUrl,
      ncaaSport: existing?.ncaaSport,
      ncaaDivision: existing?.ncaaDivision,
      season: existing?.season,
    });
  } catch (err) {
    console.error("player stats refresh failed", err);
    return NextResponse.json(
      { error: "Could not reach the stats services. Try again later." },
      { status: 502 }
    );
  }

  if (!result.matched) {
    return NextResponse.json(
      {
        matched: false,
        reason: player.ncaaUrl
          ? result.reason
          : `${result.reason} Adding this player's NCAA profile link gives complete stats.`,
        candidates: result.candidates,
      },
      { status: 200 }
    );
  }

  const profile = existing
    ? await prisma.playerProfile.update({
        where: { id: existing.id },
        data: {
          ...result.patch,
          statsSource: result.source,
          statsUpdatedAt: new Date(),
          rosterUrl: existing.rosterUrl ?? player.ncaaUrl,
        },
      })
    : await prisma.playerProfile.create({
        data: {
          playerId: player.id,
          university: result.teamName || player.university || "Unknown",
          season: player.season,
          division: player.division,
          current: true,
          rosterUrl: player.ncaaUrl,
          ...result.patch,
          statsSource: result.source,
          statsUpdatedAt: new Date(),
        },
      });

  await logAudit(session.user, {
    entity: "PlayerProfile",
    entityId: profile.id,
    entityName: `${player.name} — ${profile.university}`,
    action: existing ? "stats_refresh" : "stats_refresh_created_profile",
    summary: `Refreshed ${player.name}'s stats from ${
      result.source === "roster-site" ? "their NCAA profile page" : "the NCAA leaderboards"
    }${existing ? "" : " and created their university profile"}`,
    changes: result.patch,
  });

  return NextResponse.json({
    matched: true,
    source: result.source,
    matchedLabel: result.matchedLabel,
    createdProfile: !existing,
    profile,
  });
}
