// Where a player's division lives.
//
// It used to be typed in four places — the player form, bulk edit, the table
// cell and the college profile — which meant four chances to disagree about
// the same fact. A division belongs to the college a player went to, so the
// college profile owns it and everything else follows from there.
//
// Player.division stays as a mirror of that answer. Filters, the dashboards,
// the CSV export and the public API all read it, and keeping it in step is
// far cheaper than teaching every one of them to join through profiles.

import { prisma } from "@/lib/prisma";
import { seasonSortKey } from "@/lib/format";

/** The NCAA's own shorthand, for the stats lookups. Derived, never typed. */
export function ncaaDivisionFor(division: string | null | undefined): string {
  const d = (division ?? "").toLowerCase();
  if (/\biii\b|division 3|d3/.test(d)) return "d3";
  if (/\bii\b|division 2|d2/.test(d)) return "d2";
  return "d1";
}

/**
 * Copies the division from the profile that best represents the player right
 * now — the one they are playing for, else their most recent — onto the
 * player record. Silent when they have no profile: there is nothing to copy,
 * and wiping what is already there would lose data rather than tidy it.
 */
export async function syncPlayerDivision(playerId: string): Promise<string | null> {
  const profiles = await prisma.playerProfile.findMany({
    where: { playerId },
    select: { division: true, season: true, current: true },
  });
  if (profiles.length === 0) return null;

  const best =
    profiles.find((p) => p.current && p.division) ??
    [...profiles]
      .filter((p) => p.division)
      .sort((a, b) => seasonSortKey(b.season) - seasonSortKey(a.season))[0];

  if (!best?.division) return null;

  await prisma.player.update({
    where: { id: playerId },
    data: { division: best.division },
  });
  return best.division;
}
