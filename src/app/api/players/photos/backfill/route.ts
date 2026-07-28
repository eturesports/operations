import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { adoptRosterPhoto } from "@/lib/playerPhoto";
import { logAudit } from "@/lib/audit";

// POST /api/players/photos/backfill
// Copies headshots from college roster pages for players who have a link but
// no photo yet. Works in batches so a single run stays inside the function
// limit — the screen calls it again while there is more to do.
export const maxDuration = 60;

const BATCH = 24;
const CONCURRENCY = 4;

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const players = await prisma.player.findMany({
    where: {
      active: true,
      profileImageUrl: null,
      ncaaUrl: { not: null },
    },
    select: { id: true, name: true, profileImageUrl: true, ncaaUrl: true },
    orderBy: { name: "asc" },
  });

  const batch = players.slice(0, BATCH);
  const added: { id: string; name: string; url: string }[] = [];
  let skipped = 0;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      slice.map((p) => adoptRosterPhoto(p, p.ncaaUrl))
    );
    outcomes.forEach((o, n) => {
      if (o.added) added.push({ id: slice[n].id, name: slice[n].name, url: o.url });
      else skipped += 1;
    });
  }

  if (added.length > 0) {
    await logAudit(session.user, {
      entity: "Player",
      action: "photo_backfill",
      summary: `Copied ${added.length} player photo${
        added.length === 1 ? "" : "s"
      } from college roster pages`,
      changes: { added: added.map((a) => a.name) },
    });
  }

  return NextResponse.json({
    added: added.length,
    photos: added,
    skipped,
    // What is left after this batch, so the caller knows whether to run again.
    remaining: Math.max(0, players.length - batch.length),
  });
}
