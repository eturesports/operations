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

  let payload: {
    data?: {
      full_name?: string;
      player_career_statistic?: {
        gamesPlayed?: number;
        gamesStarted?: number;
        statistic?: { statistic?: Record<string, number | null> }[];
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
  const seconds = line?.sMinutes;
  const minutes =
    seconds != null && Number.isFinite(Number(seconds))
      ? Math.round(Number(seconds) / 60)
      : undefined;

  const stats: RosterStats = {
    teamName: origin,
    matchesPlayed: int(career?.gamesPlayed) ?? int(line?.sGames),
    matchesStarted: int(career?.gamesStarted),
    minutes,
    goals: int(line?.sGoals),
    assists: int(line?.sAssists),
    points: int(line?.sPoints),
    saves: int(line?.sSaves),
    goalsAgainst: int(line?.sGoalsAgainst),
  };
  return { ok: true, stats };
}
