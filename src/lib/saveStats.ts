import { prisma } from "@/lib/prisma";
import type { SeasonFigures } from "@/lib/sidearm";
import type { RefreshOutcome } from "@/lib/statsRefresh";
import { isMissingSeasonTable } from "@/lib/seasonStats";

/**
 * Writing a refresh down: the career totals on the profile, and one row per
 * season beside them.
 *
 * There were three places doing the first half — the single-profile refresh,
 * the whole-player refresh and the weekly cron — with the same four lines
 * copied out. Adding the second half in three places would have been three
 * chances to write it differently, so it lives here once.
 */

/**
 * The season as the rest of the app says it. NCAA soccer is an autumn sport,
 * so the season that starts in 2025 is the one everybody calls 25/26.
 */
export function seasonLabel(year: number): string {
  const a = String(year).slice(2);
  const b = String(year + 1).slice(2);
  return `${a}/${b}`;
}

/**
 * The season being played now, or the one just finished.
 *
 * From August a new season is under way; before that, "this season" still
 * means the one that ended in the spring. Getting this wrong in July would
 * report a whole squad as having played nothing.
 */
export function currentSeasonYear(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

export async function saveProfileStats(
  profileId: string,
  outcome: Extract<RefreshOutcome, { matched: true }>
): Promise<{ seasonsWritten: number }> {
  await prisma.playerProfile.update({
    where: { id: profileId },
    data: {
      ...outcome.patch,
      statsSource: outcome.source,
      statsUpdatedAt: new Date(),
    },
  });
  return saveSeasonRows(profileId, outcome);
}

/**
 * Just the season rows, for the caller that has already written the profile
 * itself — the player-level refresh, which may have had to create the profile
 * before there was anything to attach a season to.
 */
export async function saveSeasonRows(
  profileId: string,
  outcome: Extract<RefreshOutcome, { matched: true }>
): Promise<{ seasonsWritten: number }> {
  const now = new Date();
  const seasons: SeasonFigures[] = outcome.seasons ?? [];
  if (seasons.length === 0) return { seasonsWritten: 0 };

  // The table is created by a migration that is run by hand, so until then
  // there is nowhere to put these. The career totals were already written by
  // the caller, which is the behaviour this feature was added on top of — so
  // a refresh still refreshes, it just does not split. Reads degrade the same
  // way, in src/lib/seasonStats.ts.
  try {
    return await writeSeasons(profileId, seasons, outcome.source, now);
  } catch (e) {
    if (isMissingSeasonTable(e)) return { seasonsWritten: 0 };
    throw e;
  }
}

async function writeSeasons(
  profileId: string,
  seasons: SeasonFigures[],
  source: string,
  now: Date
): Promise<{ seasonsWritten: number }> {
  // Replace rather than accumulate. A season is re-read every week while it
  // is being played, and the feed reports the season to date — so the row has
  // to be overwritten, never added to.
  for (const s of seasons) {
    const figures = {
      season: seasonLabel(s.year),
      matchesPlayed: s.matchesPlayed ?? null,
      matchesStarted: s.matchesStarted ?? null,
      minutes: s.minutes ?? null,
      goals: s.goals ?? null,
      assists: s.assists ?? null,
      points: s.points ?? null,
      saves: s.saves ?? null,
      goalsAgainst: s.goalsAgainst ?? null,
      source,
      statsUpdatedAt: now,
    };
    await prisma.profileSeasonStat.upsert({
      where: { profileId_year: { profileId, year: s.year } },
      create: { profileId, year: s.year, ...figures },
      update: figures,
    });
  }

  // A season the player no longer appears in — a correction upstream, or a
  // row that was matched to the wrong person and has since been fixed —
  // should not survive as a ghost.
  await prisma.profileSeasonStat.deleteMany({
    where: { profileId, year: { notIn: seasons.map((s) => s.year) } },
  });

  return { seasonsWritten: seasons.length };
}
