import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { adoptRosterPhoto, mirrorPhoto, NO_STORAGE } from "@/lib/playerPhoto";
import { isOurCopy } from "@/lib/photo";
import { logAudit } from "@/lib/audit";

// POST /api/players/photos/backfill
// Two jobs, both about ending up with our own copy of every photo:
//   1. players who have a college link but no photo → copy it from the page
//   2. players whose photo still points at a university server → mirror it
// Works in batches so a single run stays inside the function limit — the
// screen calls it again while there is more to do.
export const maxDuration = 60;

const BATCH = 24;
const CONCURRENCY = 4;

type Done = { id: string; name: string; url: string };

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: NO_STORAGE }, { status: 501 });
  }

  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, name: true, profileImageUrl: true, ncaaUrl: true },
    orderBy: { name: "asc" },
  });

  const missing = players.filter((p) => !p.profileImageUrl && p.ncaaUrl);
  // Photos pasted as a link before we kept our own copies.
  const external = players.filter((p) => p.profileImageUrl && !isOurCopy(p.profileImageUrl));

  // Getting a photo at all comes first; mirroring fills the rest of the batch.
  const todo = [
    ...missing.map((p) => ({ player: p, kind: "adopt" as const })),
    ...external.map((p) => ({ player: p, kind: "mirror" as const })),
  ];
  const batch = todo.slice(0, BATCH);

  const added: Done[] = [];
  const mirrored: Done[] = [];
  let skipped = 0;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      slice.map((t) =>
        t.kind === "adopt" ? adoptRosterPhoto(t.player, t.player.ncaaUrl) : mirrorPhoto(t.player)
      )
    );
    outcomes.forEach((o, n) => {
      const { player, kind } = slice[n];
      if (!o.added) {
        skipped += 1;
        return;
      }
      (kind === "adopt" ? added : mirrored).push({
        id: player.id,
        name: player.name,
        url: o.url,
      });
    });
  }

  if (added.length > 0 || mirrored.length > 0) {
    await logAudit(session.user, {
      entity: "Player",
      action: "photo_backfill",
      summary: [
        added.length > 0 &&
          `Copied ${added.length} player photo${added.length === 1 ? "" : "s"} from college roster pages`,
        mirrored.length > 0 &&
          `moved ${mirrored.length} photo${mirrored.length === 1 ? "" : "s"} into our own storage`,
      ]
        .filter(Boolean)
        .join(", "),
      changes: {
        added: added.map((a) => a.name),
        mirrored: mirrored.map((a) => a.name),
      },
    });
  }

  return NextResponse.json({
    added: added.length,
    mirrored: mirrored.length,
    photos: [...added, ...mirrored],
    skipped,
    // What is left after this batch, so the caller knows whether to run again.
    remaining: Math.max(0, todo.length - batch.length),
  });
}
