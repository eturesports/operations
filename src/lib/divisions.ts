// Where the facts of a stint live.
//
// A player's division, the money a university agreed to, and the link to
// their roster page are all facts about *a college they went to*, not about
// the person or even about the operation in the abstract. So they are typed
// once, on the college profile, and the player record mirrors whichever
// profile speaks for them today.
//
// The mirror is not laziness. Every filter, dashboard, CSV export and public
// endpoint reads those columns on Player; keeping them in step costs one
// update on save, while teaching each of them to join through profiles would
// cost a rewrite and buy nothing.

import { prisma } from "@/lib/prisma";
import { seasonSortKey } from "@/lib/format";

/** The NCAA's own shorthand, for the stats lookups. Derived, never typed. */
export function ncaaDivisionFor(division: string | null | undefined): string {
  const d = (division ?? "").toLowerCase();
  if (/\biii\b|division 3|d3/.test(d)) return "d3";
  if (/\bii\b|division 2|d2/.test(d)) return "d2";
  return "d1";
}

type Speaking = {
  division: string | null;
  season: string | null;
  current: boolean;
  scholarship: number | null;
  fullRide: boolean;
  rosterUrl: string | null;
  profileImageUrl: string | null;
  actionImageUrl: string | null;
  createdAt: Date;
};

/**
 * The profile that speaks for the player: the one they are playing for, else
 * the most recent season, else the one added last. That last tiebreak matters
 * — a profile added without a season is usually the one just created.
 */
function speaksFor(profiles: Speaking[]): Speaking | null {
  if (profiles.length === 0) return null;
  return (
    profiles.find((p) => p.current) ??
    [...profiles].sort((a, b) => {
      const bySeason = seasonSortKey(b.season) - seasonSortKey(a.season);
      if (bySeason !== 0) return bySeason;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0]
  );
}

/**
 * Refreshes the player record from their college profiles. Silent when they
 * have none: there is nothing to copy, and blanking what is already there
 * would lose data rather than tidy it.
 */
export async function syncPlayerFromProfiles(playerId: string): Promise<void> {
  const profiles = await prisma.playerProfile.findMany({
    where: { playerId },
    select: {
      division: true,
      season: true,
      current: true,
      scholarship: true,
      fullRide: true,
      rosterUrl: true,
      profileImageUrl: true,
      actionImageUrl: true,
      createdAt: true,
    },
  });

  const best = speaksFor(profiles);
  if (!best) return;

  // Each field falls back to any profile that has one, so a stint entered
  // without an amount does not erase the amount recorded on another.
  const withMoney = profiles.find((p) => p.scholarship != null);
  const withLink = profiles.find((p) => p.rosterUrl);
  const withPhoto = profiles.find((p) => p.profileImageUrl);
  const withAction = profiles.find((p) => p.actionImageUrl);

  await prisma.player.update({
    where: { id: playerId },
    data: {
      ...(best.division ? { division: best.division } : {}),
      scholarship: best.scholarship ?? withMoney?.scholarship ?? null,
      fullRide: best.fullRide || profiles.some((p) => p.fullRide),
      ...(best.rosterUrl || withLink?.rosterUrl
        ? { ncaaUrl: best.rosterUrl ?? withLink?.rosterUrl }
        : {}),
      ...(best.profileImageUrl || withPhoto?.profileImageUrl
        ? { profileImageUrl: best.profileImageUrl ?? withPhoto?.profileImageUrl }
        : {}),
      ...(best.actionImageUrl || withAction?.actionImageUrl
        ? { actionImageUrl: best.actionImageUrl ?? withAction?.actionImageUrl }
        : {}),
    },
  });
}

/**
 * What the player record now mirrors, after a sync. The screens that edit a
 * college profile show the amount on the player above it, and re-deriving the
 * rule in the browser would be a second copy of it waiting to disagree.
 */
export async function playerMoney(
  playerId: string
): Promise<{ scholarship: number | null; fullRide: boolean }> {
  const p = await prisma.player.findUnique({
    where: { id: playerId },
    select: { scholarship: true, fullRide: true },
  });
  return { scholarship: p?.scholarship ?? null, fullRide: p?.fullRide ?? false };
}

/** @deprecated kept so older call sites keep compiling */
export const syncPlayerDivision = syncPlayerFromProfiles;
