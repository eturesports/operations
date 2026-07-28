// Season stats from a player's own roster page (Sidearm Sports sites —
// most NCAA athletics websites, e.g. dyusaints.com).
//
// The roster URL carries everything needed:
//   https://dyusaints.com/sports/mens-soccer/roster/asier-fernandez/4100
//   └─ origin ──────────┘        └─ sport ─┘                       └─ id ┘
// and {origin}/services/cumestats.ashx?global_sport_shortname={msoc|wsoc}
// returns the whole team's cumulative stats keyed by that roster id.

export type RosterStats = {
  teamName: string;
  matchesPlayed?: number;
  matchesStarted?: number;
  minutes?: number;
  goals?: number;
  assists?: number;
  points?: number;
  saves?: number;
  goalsAgainst?: number;
  /** how many seasons these totals cover (career at this university) */
  seasonsCounted?: number;
};

export type RosterLookup =
  | { ok: true; stats: RosterStats }
  | { ok: false; reason: string };

const SPORT_SHORTNAMES: Record<string, string> = {
  "mens-soccer": "msoc",
  "womens-soccer": "wsoc",
};

const toInt = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

// "682:41" (goalie minutes:seconds) or "394" → whole minutes
const toMinutes = (v: unknown): number | undefined => {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  const m = s.match(/^(\d+):(\d+)$/);
  if (m) return Math.round(parseInt(m[1], 10) + parseInt(m[2], 10) / 60);
  return toInt(s);
};

export function parseRosterUrl(
  url: string
): { origin: string; sport: string; rosterId: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const sportSeg = u.pathname.match(/\/sports\/([a-z-]+)\//)?.[1];
  const rosterId = u.pathname.match(/\/roster\/[^/]+\/(\d+)\/?$/)?.[1];
  if (!sportSeg || !rosterId) return null;
  const sport = SPORT_SHORTNAMES[sportSeg];
  if (!sport) return null;
  return { origin: u.origin, sport, rosterId };
}

type StatRow = Record<string, unknown> & { player_roster_bio_id?: string };

const UA =
  // Sidearm sites sit behind bot protection that rejects bare clients
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type CumeStats = {
  our_team_name?: string;
  overall_individual_stats?: Record<string, StatRow[]>;
};

async function fetchSeason(
  origin: string,
  sport: string,
  year: number
): Promise<CumeStats | null> {
  try {
    const res = await fetch(
      `${origin}/services/cumestats.ashx?global_sport_shortname=${sport}&year=${year}`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as CumeStats;
  } catch {
    return null;
  }
}

const add = (a: number | undefined, b: number | undefined) =>
  a == null && b == null ? undefined : (a ?? 0) + (b ?? 0);

/**
 * Career totals for a player at their university.
 *
 * The cumestats service reports one season at a time, so the player's history
 * is walked backwards from the current season and summed. Most players have
 * one to four seasons at a school, so the walk stops after two consecutive
 * seasons without them rather than always fetching the full range.
 */
export async function lookupRosterStats(rosterUrl: string): Promise<RosterLookup> {
  const parsed = parseRosterUrl(rosterUrl);
  if (!parsed) {
    return {
      ok: false,
      reason:
        "The link isn't a recognizable roster page (expected …/sports/mens-soccer/roster/name/id).",
    };
  }

  const thisYear = new Date().getFullYear();
  const stats: RosterStats = { teamName: parsed.origin, seasonsCounted: 0 };
  let misses = 0;
  let reached = false;

  for (let year = thisYear; year > thisYear - 8; year--) {
    const json = await fetchSeason(parsed.origin, parsed.sport, year);
    if (!json) {
      misses += 1;
      if (misses >= 2 && reached) break;
      continue;
    }
    reached = true;
    if (json.our_team_name) stats.teamName = json.our_team_name;

    const sections = json.overall_individual_stats ?? {};
    const find = (s: string) =>
      (sections[s] ?? []).find((r) => r.player_roster_bio_id === parsed.rosterId);
    const offense = find("individual_offensive_stats");
    const goalie = find("goalie_stats");

    if (!offense && !goalie) {
      misses += 1;
      // two blank seasons in a row means we've walked past their first year
      if (misses >= 2 && (stats.seasonsCounted ?? 0) > 0) break;
      continue;
    }
    misses = 0;
    stats.seasonsCounted = (stats.seasonsCounted ?? 0) + 1;

    if (offense) {
      stats.matchesPlayed = add(stats.matchesPlayed, toInt(offense.games_played));
      stats.matchesStarted = add(stats.matchesStarted, toInt(offense.games_started));
      stats.minutes = add(stats.minutes, toMinutes(offense.minutes_played));
      stats.goals = add(stats.goals, toInt(offense.goals));
      stats.assists = add(stats.assists, toInt(offense.assists));
      stats.points = add(stats.points, toInt(offense.points));
    }
    if (goalie) {
      stats.saves = add(stats.saves, toInt(goalie.saves));
      stats.goalsAgainst = add(stats.goalsAgainst, toInt(goalie.goals_allowed));
      if (!offense) {
        stats.matchesPlayed = add(stats.matchesPlayed, toInt(goalie.games_played));
        stats.matchesStarted = add(stats.matchesStarted, toInt(goalie.games_started));
        stats.minutes = add(stats.minutes, toMinutes(goalie.minutes_played));
      }
    }
  }

  if (!stats.seasonsCounted) {
    return {
      ok: false,
      reason: "The player doesn't appear in their university's published stats yet.",
    };
  }
  return { ok: true, stats };
}
