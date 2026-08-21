import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { fetchProfileStats } from "@/lib/statsRefresh";
import { saveProfileStats } from "@/lib/saveStats";
import { adoptRosterPhoto } from "@/lib/playerPhoto";
import { logAudit } from "@/lib/audit";

// Weekly job: refresh NCAA season stats for every profile marked "current".
// Triggered by the Vercel cron in vercel.json, or on demand from the dashboard.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Two ways in, never open: Vercel's cron (Bearer CRON_SECRET) or a signed-in
// editor pressing "Refresh all". Without CRON_SECRET set, only the latter works.
async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const session = await auth();
  const u = session?.user;
  return !!u && u.active !== false && u.approved !== false && canEdit(u.role);
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.playerProfile.findMany({
    where: { current: true },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          active: true,
          ncaaUrl: true,
          profileImageUrl: true,
        },
      },
    },
  });

  const results = { checked: 0, updated: 0, unmatched: 0, failed: 0, photos: 0, seasonRows: 0 };
  const updatedNames: string[] = [];

  for (const p of profiles) {
    if (!p.player.active) continue;
    results.checked += 1;
    try {
      // Players who still have no photo get one from the same roster page.
      const photo = await adoptRosterPhoto(p.player, p.rosterUrl ?? p.player.ncaaUrl);
      if (photo.added) results.photos += 1;

      const r = await fetchProfileStats({
        playerName: p.player.name,
        rosterUrl: p.rosterUrl,
        ncaaUrl: p.player.ncaaUrl,
        ncaaSport: p.ncaaSport,
        ncaaDivision: p.ncaaDivision,
        season: p.season,
      });
      if (!r.matched) {
        results.unmatched += 1;
        continue;
      }
      const { seasonsWritten } = await saveProfileStats(p.id, r);
      results.updated += 1;
      results.seasonRows += seasonsWritten;
      updatedNames.push(p.player.name);
    } catch (err) {
      console.error(`weekly refresh failed for ${p.player.name}`, err);
      results.failed += 1;
    }
  }

  if (results.checked > 0) {
    await logAudit(null, {
      entity: "PlayerProfile",
      action: "stats_refresh_weekly",
      summary: `Weekly NCAA refresh: ${results.updated} updated across ${results.seasonRows} season rows, ${results.unmatched} unmatched, ${results.failed} failed, ${results.photos} photo${results.photos === 1 ? "" : "s"} added (of ${results.checked} active)`,
      changes: { ...results, updatedNames },
    });
  }

  return NextResponse.json({ ok: true, ...results });
}
