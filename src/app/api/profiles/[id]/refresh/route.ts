import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canContribute } from "@/lib/permissions";
import { fetchProfileStats } from "@/lib/statsRefresh";
import { saveProfileStats } from "@/lib/saveStats";
import { adoptRosterPhoto, NO_STORAGE } from "@/lib/playerPhoto";
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
  if (!canContribute(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const profile = await prisma.playerProfile.findUnique({
    where: { id: params.id },
    include: {
      player: {
        select: { id: true, name: true, ncaaUrl: true, profileImageUrl: true },
      },
    },
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

  // This profile's own roster page also carries the player's headshot.
  const photo = await adoptRosterPhoto(
    profile.player,
    profile.rosterUrl ?? profile.player.ncaaUrl
  );
  if (photo.added) {
    await logAudit(session.user, {
      entity: "Player",
      entityId: profile.player.id,
      entityName: profile.player.name,
      action: "photo_from_roster",
      summary: `Copied ${profile.player.name}'s photo from their college roster page`,
      changes: { profileImageUrl: photo.url },
    });
  }

  if (!result.matched) {
    return NextResponse.json(
      {
        matched: false,
        reason: result.reason,
        candidates: result.candidates,
        photoAdded: photo.added,
        photoUrl: photo.added ? photo.url : undefined,
        photoBlocked: !photo.added && photo.reason === NO_STORAGE,
      },
      { status: 200 }
    );
  }

  const { seasonsWritten } = await saveProfileStats(params.id, result);
  const updated = await prisma.playerProfile.findUniqueOrThrow({ where: { id: params.id } });

  await logAudit(session.user, {
    entity: "PlayerProfile",
    entityId: updated.id,
    entityName: `${profile.player.name} — ${updated.university}`,
    action: "stats_refresh",
    summary:
      `Refreshed ${profile.player.name}'s stats from ${
        result.source === "roster-site" ? "their university roster page" : "the NCAA leaderboards"
      } (${result.matchedLabel})` +
      (seasonsWritten ? `, split across ${seasonsWritten} season${seasonsWritten === 1 ? "" : "s"}` : ""),
    changes: { ...result.patch, seasons: result.seasons },
  });

  return NextResponse.json({
    matched: true,
    profile: updated,
    source: result.source,
    seasonsCounted: result.seasonsCounted,
    seasonsWritten,
    photoAdded: photo.added,
    photoUrl: photo.added ? photo.url : undefined,
    photoBlocked: !photo.added && photo.reason === NO_STORAGE,
    ncaa: { name: result.matchedLabel, team: "" },
  });
}
