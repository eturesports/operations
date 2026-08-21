// Season stats from a player's own roster page (Sidearm Sports sites —
// most NCAA athletics websites, e.g. dyusaints.com).
//
// The roster URL carries everything needed:
//   https://dyusaints.com/sports/mens-soccer/roster/asier-fernandez/4100
//   └─ origin ──────────┘        └─ sport ─┘                       └─ id ┘
// and {origin}/services/cumestats.ashx?global_sport_shortname={msoc|wsoc}
// returns the whole team's cumulative stats keyed by that roster id.

/** The numbers themselves, for one season or for a whole career. */
export type StatFigures = {
  matchesPlayed?: number;
  matchesStarted?: number;
  minutes?: number;
  goals?: number;
  assists?: number;
  points?: number;
  saves?: number;
  goalsAgainst?: number;
};

/** One season, as the feed reported it. */
export type SeasonFigures = StatFigures & {
  /** the calendar year the feed files it under — 2025 is the 25/26 season */
  year: number;
};

export type RosterStats = StatFigures & {
  teamName: string;
  /** how many seasons these totals cover (career at this university) */
  seasonsCounted?: number;
  /**
   * The same numbers before they were added up, newest first.
   *
   * The walk below always had these — it fetches one season at a time and
   * sums them as it goes. Keeping them is what makes "this season" a question
   * the database can answer.
   */
  seasons: SeasonFigures[];
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
): { origin: string; sport: string; rosterId: string; slug: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const sportSeg = u.pathname.match(/\/sports\/([a-z-]+)\//)?.[1];
  const m = u.pathname.match(/\/roster\/([^/]+)\/(\d+)\/?$/);
  if (!sportSeg || !m) return null;
  const sport = SPORT_SHORTNAMES[sportSeg];
  if (!sport) return null;
  return { origin: u.origin, sport, rosterId: m[2], slug: m[1] };
}

// "Cuquerella, Vicente" and the slug "vicente-cuquerella" reduce to the same
// set of name parts, which is what lets us match a player whose roster id
// changed between seasons.
function nameTokens(s: string): Set<string> {
  return new Set(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 1)
  );
}

const deaccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Name parts as written, accents intact, so we can tell which ones a URL
// would have mangled.
function rawTokens(s: string): string[] {
  return s.split(/[^\p{L}]+/u).filter((w) => deaccent(w).length > 1);
}

// Roster URLs strip accented letters instead of transliterating them:
// "Álvaro Timón" becomes "-lvaro-tim-n", so those parts arrive clipped. That
// only happens to a part that carried an accent — for a plain one the URL is
// exact, and demanding an exact match there is what stops "marc-garcia" from
// claiming Marco García's season.
function samePart(reported: string, fromUrl: string): boolean {
  const plain = deaccent(reported);
  if (plain === fromUrl) return true;
  if (plain === reported.toLowerCase()) return false; // nothing was stripped
  if (fromUrl.length < 3 || fromUrl.length >= plain.length) return false;
  return plain.startsWith(fromUrl) || plain.endsWith(fromUrl);
}

/** @param b the name as it appears in the roster URL */
function sameName(a: string, b: string): boolean {
  const A = rawTokens(a);
  const B = nameTokens(b);
  if (A.length === 0 || B.size === 0) return false;
  const shared = A.filter((w) => [...B].some((x) => samePart(w, x))).length;
  // every part of the shorter name must appear in the longer one
  return shared === Math.min(A.length, B.size);
}

type StatRow = Record<string, unknown> & { player_roster_bio_id?: string };

const UA =
  // Sidearm sites sit behind bot protection that rejects bare clients
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type CumeStats = {
  our_team_name?: string;
  overall_individual_stats?: Record<string, StatRow[]>;
};

// One season of this feed is 2–3MB, which is over Next's 2MB data-cache limit,
// so it is fetched uncached with a hard timeout — a single slow university
// site must not hang the whole refresh.
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
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
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
  const stats: RosterStats = { teamName: parsed.origin, seasonsCounted: 0, seasons: [] };

  // How far back to look. The player record's season is the season the
  // placement was agreed, not when they competed — Adrian Crespo is filed
  // under 17/18 but his stats sit in 2021 — so the year can't be derived and
  // has to be searched. Seasons are fetched in small parallel batches to keep
  // a wide search fast; the search stops once a whole batch comes back empty
  // after the player has already been found.
  const YEARS_BACK = 10;
  const BATCH = 4;
  const years: number[] = [];
  for (let y = thisYear; y > thisYear - YEARS_BACK; y--) years.push(y);

  for (let i = 0; i < years.length; i += BATCH) {
    const batch = years.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((y) => fetchSeason(parsed.origin, parsed.sport, y))
    );
    let hitsInBatch = 0;

    // Zipped with the batch rather than iterated bare: which year a result
    // came from is the whole point now, and `for (const json of results)`
    // threw it away.
    for (let k = 0; k < results.length; k++) {
      const json = results[k];
      const year = batch[k];
      if (!json) continue;
      if (json.our_team_name) stats.teamName = json.our_team_name;

      const sections = json.overall_individual_stats ?? {};
    // Two wrinkles in this feed:
    //  - schools issue a fresh roster id each season, so the id in the URL
    //    often isn't the one attached to older stats → fall back to the name
    //  - a player can appear on several rows within one season, so all their
    //    rows are summed rather than taking the first
    const findAll = (s: string): StatRow[] => {
      const rows = (sections[s] ?? []).filter((r) => !r.is_a_footer_stat);
      const byId = rows.filter((r) => r.player_roster_bio_id === parsed.rosterId);
      if (byId.length) return byId;
      return rows.filter(
        (r) => typeof r.player_name === "string" && sameName(r.player_name, parsed.slug)
      );
    };
    const sumOf = (rows: StatRow[], field: string, minutes = false) =>
      rows.length
        ? rows.reduce<number | undefined>(
            (acc, r) => add(acc, minutes ? toMinutes(r[field]) : toInt(r[field])),
            undefined
          )
        : undefined;

    const offenseRows = findAll("individual_offensive_stats");
    const goalieRows = findAll("goalie_stats");
    const offense = offenseRows.length > 0;
    const goalie = goalieRows.length > 0;

    if (!offense && !goalie) continue;
    hitsInBatch += 1;
    stats.seasonsCounted = (stats.seasonsCounted ?? 0) + 1;

    // This one season on its own, then folded into the career total. Built
    // first so the two can never disagree: the totals are the sum of exactly
    // what was recorded, not a second reading of the same feed.
    const season: SeasonFigures = { year };
    if (offense) {
      season.matchesPlayed = sumOf(offenseRows, "games_played");
      season.matchesStarted = sumOf(offenseRows, "games_started");
      season.minutes = sumOf(offenseRows, "minutes_played", true);
      season.goals = sumOf(offenseRows, "goals");
      season.assists = sumOf(offenseRows, "assists");
      season.points = sumOf(offenseRows, "points");
    }
    if (goalie) {
      season.saves = sumOf(goalieRows, "saves");
      season.goalsAgainst = sumOf(goalieRows, "goals_allowed");
      // A goalkeeper's appearances are on the goalie rows, not the outfield
      // ones — but an outfield player who kept goal for ten minutes has both,
      // and taking the goalie count there would undercount their season.
      if (!offense) {
        season.matchesPlayed = sumOf(goalieRows, "games_played");
        season.matchesStarted = sumOf(goalieRows, "games_started");
        season.minutes = sumOf(goalieRows, "minutes_played", true);
      }
    }
    stats.seasons.push(season);

    stats.matchesPlayed = add(stats.matchesPlayed, season.matchesPlayed);
    stats.matchesStarted = add(stats.matchesStarted, season.matchesStarted);
    stats.minutes = add(stats.minutes, season.minutes);
    stats.goals = add(stats.goals, season.goals);
    stats.assists = add(stats.assists, season.assists);
    stats.points = add(stats.points, season.points);
    stats.saves = add(stats.saves, season.saves);
    stats.goalsAgainst = add(stats.goalsAgainst, season.goalsAgainst);
    }

    // Once the player has been found, a whole batch with nothing means we've
    // gone past their first year — no point fetching another 2MB per season.
    if (hitsInBatch === 0 && (stats.seasonsCounted ?? 0) > 0) break;
  }

  if (!stats.seasonsCounted) {
    return {
      ok: false,
      reason: "The player doesn't appear in their university's published stats yet.",
    };
  }
  return { ok: true, stats };
}
