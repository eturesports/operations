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

export async function lookupRosterStats(rosterUrl: string): Promise<RosterLookup> {
  const parsed = parseRosterUrl(rosterUrl);
  if (!parsed) {
    return {
      ok: false,
      reason:
        "The link isn't a recognizable roster page (expected …/sports/mens-soccer/roster/name/id).",
    };
  }

  const api = `${parsed.origin}/services/cumestats.ashx?global_sport_shortname=${parsed.sport}`;
  let json: {
    our_team_name?: string;
    overall_individual_stats?: Record<string, StatRow[]>;
  };
  try {
    const res = await fetch(api, {
      headers: {
        // Sidearm sites sit behind bot protection that rejects bare clients
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept: "application/json",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return { ok: false, reason: `The university site answered ${res.status}.` };
    }
    json = await res.json();
  } catch {
    return { ok: false, reason: "Could not reach the university's stats service." };
  }

  const sections = json.overall_individual_stats ?? {};
  const findRow = (section: string): StatRow | undefined =>
    (sections[section] ?? []).find((r) => r.player_roster_bio_id === parsed.rosterId);

  const offense = findRow("individual_offensive_stats");
  const goalie = findRow("goalie_stats");
  if (!offense && !goalie) {
    return {
      ok: false,
      reason:
        "The player doesn't appear in this season's stats on their university site yet.",
    };
  }

  const stats: RosterStats = { teamName: json.our_team_name ?? parsed.origin };
  if (offense) {
    stats.matchesPlayed = toInt(offense.games_played);
    stats.matchesStarted = toInt(offense.games_started);
    stats.minutes = toMinutes(offense.minutes_played);
    stats.goals = toInt(offense.goals);
    stats.assists = toInt(offense.assists);
    stats.points = toInt(offense.points);
  }
  if (goalie) {
    stats.saves = toInt(goalie.saves);
    stats.goalsAgainst = toInt(goalie.goals_allowed);
    // goalies often have no offensive row — fall back to their goalie line
    stats.matchesPlayed ??= toInt(goalie.games_played);
    stats.matchesStarted ??= toInt(goalie.games_started);
    stats.minutes ??= toMinutes(goalie.minutes_played);
  }
  return { ok: true, stats };
}
