// Thin client for the public henrygd/ncaa-api instance.
// Docs: https://github.com/henrygd/ncaa-api
// Endpoint: /stats/{sport}/{div}/{season}/individual/{categoryId}[/p{n}]
//   sport   = soccer-men | soccer-women
//   div     = d1 | d2 | d3
//   season  = "current" or a season/year id
//   category= NCAA statistics category id (differs per sport)

const NCAA_BASE = process.env.NCAA_API_BASE?.replace(/\/$/, "") || "https://ncaa-api.henrygd.me";

// Per-sport category ids. Men's soccer confirmed live; women's ids TBD until WSOC
// operations start, so refresh returns "unsupported" gracefully for women for now.
const CATEGORIES: Record<string, { outfield?: number; goalie?: number }> = {
  "soccer-men": { outfield: 4, goalie: 10 },
  "soccer-women": {}, // ids to be resolved when WSOC data lands
};

export type NcaaStatLine = {
  name: string;
  team: string;
  games?: number;
  goals?: number;
  assists?: number;
  points?: number;
  minutes?: number;
  saves?: number;
  isGoalie: boolean;
};

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const toInt = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

async function fetchAllPages(
  sport: string,
  div: string,
  season: string,
  category: number
): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  let page = 1;
  let pages = 1;
  do {
    const suffix = page > 1 ? `/p${page}` : "";
    const url = `${NCAA_BASE}/stats/${sport}/${div}/${season}/individual/${category}${suffix}`;
    const res = await fetch(url, {
      headers: { "user-agent": "eture-operations" },
      // stats update infrequently; let Next cache for an hour
      next: { revalidate: 3600 },
    });
    if (!res.ok) break; // category not available for this sport/div/season
    const json = (await res.json()) as { pages?: number; data?: Record<string, string>[] };
    pages = json.pages ?? 1;
    for (const d of json.data ?? []) rows.push(d);
    page += 1;
  } while (page <= pages && page <= 25);
  return rows;
}

export type NcaaMatch = {
  matched: boolean;
  reason?: string;
  candidates?: { name: string; team: string }[];
  stats?: NcaaStatLine;
};

// Look a player up across the outfield + goalie leaderboards and return the
// row whose name matches. Team is returned so a human can confirm the match.
export async function lookupPlayerStats(opts: {
  name: string;
  sport?: string | null;
  division?: string | null;
  season?: string | null;
}): Promise<NcaaMatch> {
  const sport = (opts.sport || "soccer-men").trim();
  const div = (opts.division || "d1").trim().toLowerCase();
  const season = (opts.season || "current").trim() || "current";
  const cats = CATEGORIES[sport];

  if (!cats || (cats.outfield == null && cats.goalie == null)) {
    return {
      matched: false,
      reason: `NCAA stats are not wired up for “${sport}” yet.`,
    };
  }

  const target = normalizeName(opts.name);
  if (!target) return { matched: false, reason: "Player has no name to match." };

  const lines: NcaaStatLine[] = [];

  if (cats.outfield != null) {
    for (const d of await fetchAllPages(sport, div, season, cats.outfield)) {
      lines.push({
        name: d.Name ?? "",
        team: d.Team ?? "",
        games: toInt(d.Games),
        goals: toInt(d.Goals),
        assists: toInt(d.Assists),
        points: toInt(d.Points),
        isGoalie: false,
      });
    }
  }
  if (cats.goalie != null) {
    for (const d of await fetchAllPages(sport, div, season, cats.goalie)) {
      lines.push({
        name: d.Name ?? "",
        team: d.Team ?? "",
        games: toInt(d.Games),
        minutes: toInt(d["Goalie Min. Plyd"]),
        saves: toInt(d.Saves),
        isGoalie: true,
      });
    }
  }

  if (lines.length === 0) {
    return { matched: false, reason: "No leaderboard data returned for that season." };
  }

  const exact = lines.filter((l) => normalizeName(l.name) === target);
  if (exact.length === 1) return { matched: true, stats: exact[0] };
  if (exact.length > 1) {
    // same name in multiple leaderboards (e.g. outfield + goalie) → merge
    const merged = exact.reduce<NcaaStatLine>(
      (acc, l) => ({
        name: l.name,
        team: acc.team || l.team,
        games: acc.games ?? l.games,
        goals: acc.goals ?? l.goals,
        assists: acc.assists ?? l.assists,
        points: acc.points ?? l.points,
        minutes: acc.minutes ?? l.minutes,
        saves: acc.saves ?? l.saves,
        isGoalie: acc.isGoalie || l.isGoalie,
      }),
      { name: opts.name, team: "", isGoalie: false }
    );
    return { matched: true, stats: merged };
  }

  // no exact hit → offer close candidates (surname match) for a manual pick
  const surname = target.split(" ").slice(-1)[0];
  const candidates = lines
    .filter((l) => normalizeName(l.name).includes(surname) && surname.length >= 3)
    .slice(0, 8)
    .map((l) => ({ name: l.name, team: l.team }));

  return {
    matched: false,
    reason:
      "No exact name match on the NCAA leaderboards. The player may not rank in the tracked categories this season.",
    candidates,
  };
}
