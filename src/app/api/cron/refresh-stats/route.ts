import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { fetchProfileStats } from "@/lib/statsRefresh";
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
    include: { player: { select: { name: true, active: true, ncaaUrl: true } } },
  });

  const results = { checked: 0, updated: 0, unmatched: 0, failed: 0 };
  const updatedNames: string[] = [];

  for (const p of profiles) {
    if (!p.player.active) continue;
    results.checked += 1;
    try {
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
      await prisma.playerProfile.update({
        where: { id: p.id },
        data: {
          ...r.patch,
          statsSource: r.source,
          statsUpdatedAt: new Date(),
        },
      });
      results.updated += 1;
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
      summary: `Weekly NCAA refresh: ${results.updated} updated, ${results.unmatched} unmatched, ${results.failed} failed (of ${results.checked} active)`,
      changes: { ...results, updatedNames },
    });
  }

  return NextResponse.json({ ok: true, ...results });
}
