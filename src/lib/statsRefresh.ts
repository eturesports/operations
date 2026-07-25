import { lookupPlayerStats } from "@/lib/ncaa";
import { lookupRosterStats } from "@/lib/sidearm";

// One place that decides where a profile's stats come from:
//  1. the player's own roster page (profile.rosterUrl or player.ncaaUrl) —
//     complete data for everyone on the team, via the Sidearm stats service
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
      patch: ProfileStatPatch;
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
    const r = await lookupRosterStats(url);
    if (r.ok) {
      const s = r.stats;
      return {
        matched: true,
        source: "roster-site",
        matchedLabel: `${opts.playerName} (${s.teamName})`,
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
    // fall through to the leaderboards, but keep the roster error in case
    // those don't match either
    const fallback = await fromLeaderboards(opts);
    if (fallback.matched) return fallback;
    return { ...fallback, reason: `${r.reason} ${fallback.reason}` };
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
