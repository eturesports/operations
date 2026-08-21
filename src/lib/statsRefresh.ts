import { lookupPlayerStats } from "@/lib/ncaa";
import { lookupRosterStats, type SeasonFigures } from "@/lib/sidearm";
import { lookupWmtStats } from "@/lib/wmt";

// One place that decides where a profile's stats come from:
//  1. the player's own roster page (profile.rosterUrl or player.ncaaUrl).
//     University athletics sites run on a handful of platforms, so both are
//     tried: Sidearm (…/roster/name/1234) and WMT (…/roster/player/name).
//  2. fallback: the NCAA national leaderboards (top players only), by name

export type ProfileStatPatch = {
  matchesPlayed: number | null;
  matchesStarted: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  saves: number | null;
  goalsAgainst: number | null;
};

export type RefreshOutcome =
  | {
      matched: true;
      source: "roster-site" | "ncaa-leaderboards";
      matchedLabel: string; // e.g. "Asier Fernandez (D'Youville)" — for human confirmation
      teamName: string; // used to name a profile when the player has none yet
      seasonsCounted?: number; // how many seasons the totals cover
      patch: ProfileStatPatch;
      /**
       * The same totals before they were added up, newest first.
       *
       * Absent from the national leaderboards, which report only the season
       * being played. One season is not a split, and filing it as one would
       * say this year's numbers are the player's whole career.
       */
      seasons?: SeasonFigures[];
    }
  | { matched: false; reason: string; candidates: { name: string; team: string }[] };

export async function fetchProfileStats(opts: {
  playerName: string;
  rosterUrl?: string | null;
  ncaaUrl?: string | null;
  ncaaSport?: string | null;
  ncaaDivision?: string | null;
  season?: string | null;
}): Promise<RefreshOutcome> {
  const url = opts.rosterUrl?.trim() || opts.ncaaUrl?.trim();

  if (url) {
    // Two platforms, told apart by the shape of the URL: Sidearm ends in a
    // numeric roster id (…/roster/name/1234), WMT does not (…/roster/player/name).
    // Try the likely one first, then the other, and keep whichever reason is
    // most specific so a failure explains itself instead of blaming the
    // leaderboards.
    const looksSidearm = /\/roster\/[^/]+\/\d+\/?$/.test(url);
    const readers = looksSidearm
      ? [lookupRosterStats, lookupWmtStats]
      : [lookupWmtStats, lookupRosterStats];

    let r = await readers[0](url);
    let firstReason = r.ok ? null : r.reason;
    if (!r.ok) {
      const second = await readers[1](url);
      if (second.ok) r = second;
    }
    if (!r.ok) r = { ok: false, reason: firstReason ?? r.reason };

    if (r.ok) {
      const s = r.stats;
      return {
        matched: true,
        source: "roster-site",
        matchedLabel: `${opts.playerName} (${s.teamName})`,
        teamName: s.teamName,
        seasonsCounted: s.seasonsCounted,
        seasons: s.seasons,
        patch: {
          matchesPlayed: s.matchesPlayed ?? null,
          matchesStarted: s.matchesStarted ?? null,
          minutes: s.minutes ?? null,
          goals: s.goals ?? null,
          assists: s.assists ?? null,
          points: s.points ?? null,
          saves: s.saves ?? null,
          goalsAgainst: s.goalsAgainst ?? null,
        },
      };
    }
    // The link is the reliable source, so when it fails that is the finding —
    // the leaderboards only cover the national top ~150 and saying "no match"
    // there hides the real problem.
    const fallback = await fromLeaderboards(opts);
    if (fallback.matched) return fallback;
    return {
      ...fallback,
      reason: `Couldn't read their roster page: ${r.reason} They also don't rank in the NCAA leaderboards, so there is nothing to fall back on.`,
    };
  }

  return fromLeaderboards(opts);
}

async function fromLeaderboards(opts: {
  playerName: string;
  ncaaSport?: string | null;
  ncaaDivision?: string | null;
  season?: string | null;
}): Promise<RefreshOutcome> {
  const r = await lookupPlayerStats({
    name: opts.playerName,
    sport: opts.ncaaSport,
    division: opts.ncaaDivision,
    season: opts.season,
  });
  if (!r.matched || !r.stats) {
    return {
      matched: false,
      reason:
        r.reason ??
        "No match on the NCAA leaderboards. Add the player's roster-page link for full stats.",
      candidates: r.candidates ?? [],
    };
  }
  const s = r.stats;
  return {
    matched: true,
    source: "ncaa-leaderboards",
    matchedLabel: `${s.name} (${s.team})`,
    teamName: s.team,
    patch: {
      matchesPlayed: s.games ?? null,
      matchesStarted: null,
      minutes: s.minutes ?? null,
      goals: s.goals ?? null,
      assists: s.assists ?? null,
      points: s.points ?? null,
      saves: s.saves ?? null,
      goalsAgainst: null,
    },
  };
}
