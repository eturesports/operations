// What Eture publishes about its own operations.
//
// The database holds far more than this: scholarships, notes, contact
// history. This module is the single place that decides what leaves the
// building — name, the season the operation belongs to, the university, and
// a photo. Anything not listed here cannot reach the public API or the
// embedded reader, whatever the caller asks for.

import { prisma } from "@/lib/prisma";
import DOMAINS from "@/data/roster-domains.json";
import { preferDisplay, uniKey } from "@/lib/universities";
import { seasonSortKey } from "@/lib/format";

export type PublicPlayer = {
  slug: string;
  name: string;
  season: string | null;
  university: string | null;
  division: string | null;
  photo: string | null;
  /** the university's crest, served by its own athletics site */
  logo: string | null;
  /** minutes played across every college profile we hold */
  minutes: number | null;
  playingNow: boolean;
};

export type PublicSeason = {
  season: string;
  players: number;
  universities: number;
};

// Sidearm — which is most of college athletics — serves every site's crest
// from the same path. Sites that don't (Clemson, UCLA) simply answer 404 and
// the card falls back to the university's initials, so this needs no storage
// of ours and no third-party logo service.
function logoFor(rosterUrl: string | null, university: string | null): string | null {
  let host: string | null = null;
  if (rosterUrl) {
    try {
      host = new URL(rosterUrl).host;
    } catch {
      host = null;
    }
  }
  if (!host && university) {
    host = (DOMAINS as Record<string, string>)[uniKey(university)] ?? null;
  }
  return host ? `https://${host}/images/logos/site/site.png` : null;
}

// A readable, stable handle for a player, so the website can link to them.
export function slugFor(name: string, id: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "player"}-${id.slice(-4)}`;
}

/**
 * Never throws. These pages are prerendered at build time and revalidated
 * every few minutes, so a database that happens to be unreachable during a
 * build must not take the whole deployment down with it — the next
 * revalidation fills the page in.
 */
export async function getPublicRoster(): Promise<PublicPlayer[]> {
  try {
    return await readRoster();
  } catch (err) {
    console.error("public roster unavailable", err);
    return [];
  }
}

async function readRoster(): Promise<PublicPlayer[]> {
  const rows = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      season: true,
      university: true,
      division: true,
      profileImageUrl: true,
      actionImageUrl: true,
      ncaaUrl: true,
      profiles: { select: { current: true, minutes: true, rosterUrl: true } },
    },
    orderBy: [{ season: "desc" }, { name: "asc" }],
  });

  // The action shot is the one worth showing; the roster headshot stands in
  // when there isn't one.
  const players = rows.map((p) => {
    const minutes = p.profiles.reduce((a, x) => a + (x.minutes ?? 0), 0);
    return {
      slug: slugFor(p.name, p.id),
      name: p.name,
      season: p.season,
      university: p.university,
      division: p.division,
      photo: p.actionImageUrl || p.profileImageUrl,
      logo: logoFor(p.profiles[0]?.rosterUrl ?? p.ncaaUrl, p.university),
      minutes: minutes > 0 ? minutes : null,
      playingNow: p.profiles.some((x) => x.current),
    };
  });

  // Players with a photo first: a wall of placeholders is not a showcase.
  return players.sort((a, b) => {
    if (!!a.photo !== !!b.photo) return a.photo ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function seasonsOf(players: PublicPlayer[]): PublicSeason[] {
  const bySeason = new Map<string, PublicPlayer[]>();
  for (const p of players) {
    if (!p.season) continue;
    const list = bySeason.get(p.season) ?? [];
    list.push(p);
    bySeason.set(p.season, list);
  }

  return [...bySeason.entries()]
    .map(([season, list]) => ({
      season,
      players: list.length,
      universities: new Set(
        list.filter((p) => p.university).map((p) => uniKey(p.university as string))
      ).size,
    }))
    .sort((a, b) => seasonSortKey(b.season) - seasonSortKey(a.season));
}

/**
 * The same school is typed several ways across the years ("CLEMSON",
 * "Clemson University"). Public pages should show the best spelling we have
 * for each, not whichever one that record happens to carry.
 */
export function tidyUniversities(players: PublicPlayer[]): PublicPlayer[] {
  const best = new Map<string, string>();
  for (const p of players) {
    if (!p.university) continue;
    const key = uniKey(p.university);
    const current = best.get(key);
    best.set(key, current ? preferDisplay(current, p.university) : p.university);
  }
  return players.map((p) =>
    p.university ? { ...p, university: best.get(uniKey(p.university)) ?? p.university } : p
  );
}
