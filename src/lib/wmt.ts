// Season stats from athletics sites built on WMT Digital (uclabruins.com and
// others). Unlike Sidearm, the roster URL carries no numeric id:
//   https://uclabruins.com/sports/mens-soccer/roster/player/ander-marticorena
// The page embeds the player's WMT id in a stats widget URL
// (wmt.games/<school>/stats/roster/<personId>), which then resolves against
// api.wmt.games.

import type { RosterStats } from "@/lib/sidearm";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type WmtLookup =
  | { ok: true; stats: RosterStats }
  | { ok: false; reason: string };

const int = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : undefined;
};

export function looksLikeRosterPage(url: string): boolean {
  try {
    return /\/sports\/[a-z-]+\/roster\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export async function lookupWmtStats(rosterUrl: string): Promise<WmtLookup> {
  let html: string;
  let origin: string;
  try {
    const u = new URL(rosterUrl);
    origin = u.hostname.replace(/^www\./, "");
    const res = await fetch(rosterUrl, {
      // Athletics sites sit behind bot protection that rejects requests which
      // don't look like a browser — a bare user-agent gets a challenge page.
      headers: {
        "user-agent": UA,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, reason: `The roster page answered ${res.status}.` };
    html = await res.text();
  } catch {
    return { ok: false, reason: "Could not open the roster page." };
  }

  const personId = html.match(/wmt\.games\/[^/"']+\/stats\/roster\/(\d+)/)?.[1];
  if (!personId) {
    // A challenge page still returns 200, so tell these apart for the user.
    const blocked = /incapsula|captcha|cf-browser-verification|access denied/i.test(html);
    return {
      ok: false,
      reason: blocked
        ? "The university site blocked the request (bot protection)."
        : "No stats widget found on that roster page — check the link opens their profile.",
    };
  }

  type StatLine = { statistic?: Record<string, number | null> }[];
  let payload: {
    data?: {
      full_name?: string;
      player_career_statistic?: {
        gamesPlayed?: number;
        gamesStarted?: number;
        statistic?: StatLine;
      }[];
      /**
       * One row per season, which the career array above does not carry.
       * This was in the payload all along and went unread.
       */
      player_season_statistic?: {
        academicYear?: number;
        nameTabular?: string;
        gamesPlayed?: number;
        gamesStarted?: number;
        statistic?: StatLine;
      }[];
    };
  };
  try {
    const res = await fetch(`https://api.wmt.games/api/statistics/persons/${personId}`, {
      headers: { "user-agent": UA, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: false, reason: `The stats service answered ${res.status}.` };
    payload = await res.json();
  } catch {
    return { ok: false, reason: "Could not reach the stats service." };
  }

  const career = payload.data?.player_career_statistic?.[0];
  const line = career?.statistic?.[0]?.statistic;
  if (!career && !line) {
    return { ok: false, reason: "No season stats published for this player yet." };
  }

  // sMinutes is reported in SECONDS (≈75,097 for a 17-game starter).
  const toMinutes = (v: unknown): number | undefined =>
    v != null && Number.isFinite(Number(v)) ? Math.round(Number(v) / 60) : undefined;

  /**
   * WMT files a season under the academic year it ends in — `2026` is the
   * autumn-2025 season. Sidearm files the same season under `2025`. One of
   * them has to give, and it is this one, so a season means the same thing
   * whichever platform a university happens to run.
   */
  const seasons = (payload.data?.player_season_statistic ?? [])
    .map((s) => {
      const l = s.statistic?.[0]?.statistic;
      const year = s.academicYear != null ? s.academicYear - 1 : undefined;
      if (year == null) return null;
      return {
        year,
        matchesPlayed: int(s.gamesPlayed) ?? int(l?.sGames),
        matchesStarted: int(s.gamesStarted),
        minutes: toMinutes(l?.sMinutes),
        goals: int(l?.sGoals),
        assists: int(l?.sAssists),
        points: int(l?.sPoints),
        saves: int(l?.sSaves),
        goalsAgainst: int(l?.sGoalsAgainst),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    // A season the player has not started yet arrives with zeroes and no
    // minutes. Recording it would put an empty row in front of a real one.
    .filter((s) => (s.matchesPlayed ?? 0) > 0 || (s.minutes ?? 0) > 0)
    .sort((a, b) => b.year - a.year);

  const stats: RosterStats = {
    teamName: origin,
    matchesPlayed: int(career?.gamesPlayed) ?? int(line?.sGames),
    matchesStarted: int(career?.gamesStarted),
    minutes: toMinutes(line?.sMinutes),
    goals: int(line?.sGoals),
    assists: int(line?.sAssists),
    points: int(line?.sPoints),
    saves: int(line?.sSaves),
    goalsAgainst: int(line?.sGoalsAgainst),
    seasonsCounted: seasons.length || undefined,
    seasons,
  };
  return { ok: true, stats };
}
