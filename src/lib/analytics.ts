import { prisma } from "@/lib/prisma";
import { seasonSortKey } from "@/lib/format";
import { canonicalizeUniversity, uniKey } from "@/lib/universities";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const isNCAA = (d: string | null) =>
  ["division i", "division ii", "division iii"].includes(norm(d));
const isD1 = (d: string | null) => norm(d) === "division i";

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
}

type Row = {
  name: string;
  university: string | null;
  season: string | null;
  division: string | null;
  program: string | null;
  scholarship: number | null;
  nationality?: string | null;
  position?: string | null;
};

// ─────────────────────────── Segmentation ───────────────────────────

export type SegmentRow = {
  key: string;
  operations: number;
  uniquePlayers: number;
  d1Pct: number;
  scholarshipMedian: number | null;
};

export type SegmentationData = {
  byPosition: SegmentRow[];
  byNationality: SegmentRow[];
  positionCoverage: number;
  nationalityCoverage: number;
};

function segment(rows: Row[], pick: (r: Row) => string | null | undefined): SegmentRow[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const raw = (pick(r) ?? "").trim();
    if (!raw) continue;
    (map.get(raw) ?? map.set(raw, []).get(raw)!).push(r);
  }
  const out: SegmentRow[] = [];
  for (const [key, list] of map) {
    const d1 = list.filter((r) => isD1(r.division)).length;
    const amounts = list.filter((r) => r.scholarship != null).map((r) => r.scholarship!);
    out.push({
      key,
      operations: list.length,
      uniquePlayers: new Set(list.map((r) => r.name.trim().toLowerCase())).size,
      d1Pct: list.length ? Math.round((d1 / list.length) * 1000) / 10 : 0,
      scholarshipMedian: median(amounts),
    });
  }
  return out.sort((a, b) => b.operations - a.operations);
}

export async function getSegmentationData(): Promise<SegmentationData> {
  const rows = (await prisma.player.findMany({
    where: { active: true },
    select: {
      name: true, university: true, season: true, division: true, program: true,
      scholarship: true, nationality: true, position: true,
    },
  })) as Row[];
  const withPos = rows.filter((r) => (r.position ?? "").trim()).length;
  const withNat = rows.filter((r) => (r.nationality ?? "").trim()).length;
  return {
    byPosition: segment(rows, (r) => r.position),
    byNationality: segment(rows, (r) => r.nationality),
    positionCoverage: rows.length ? Math.round((withPos / rows.length) * 1000) / 10 : 0,
    nationalityCoverage: rows.length ? Math.round((withNat / rows.length) * 1000) / 10 : 0,
  };
}

// ─────────────────────────── Active players ───────────────────────────

export type ActivePlayerRow = {
  profileId: string;
  playerId: string;
  name: string;
  university: string;
  division: string | null;
  season: string | null;
  jersey: string | null;
  matchesPlayed: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  saves: number | null;
  statsSource: string | null;
  statsUpdatedAt: Date | null;
  ncaaUrl: string | null;
  instagramUrl: string | null;
  profileImageUrl: string | null;
};

export type ActiveData = {
  activeCount: number;
  withStats: number;
  totals: { goals: number; assists: number; points: number; minutes: number; saves: number };
  rows: ActivePlayerRow[];
  topScorers: ActivePlayerRow[];
  topAssists: ActivePlayerRow[];
};

export async function getActiveData(): Promise<ActiveData> {
  const profiles = await prisma.playerProfile.findMany({
    where: { current: true },
    include: {
      player: {
        select: {
          id: true,
          name: true,
          ncaaUrl: true,
          instagramUrl: true,
          profileImageUrl: true,
          active: true,
        },
      },
    },
  });

  const rows: ActivePlayerRow[] = profiles
    .filter((p) => p.player.active)
    .map((p) => ({
      profileId: p.id,
      playerId: p.playerId,
      name: p.player.name,
      university: p.university,
      division: p.division,
      season: p.season,
      jersey: p.jersey,
      matchesPlayed: p.matchesPlayed,
      minutes: p.minutes,
      goals: p.goals,
      assists: p.assists,
      points: p.points,
      saves: p.saves,
      statsSource: p.statsSource,
      statsUpdatedAt: p.statsUpdatedAt,
      ncaaUrl: p.player.ncaaUrl,
      instagramUrl: p.player.instagramUrl,
      profileImageUrl: p.player.profileImageUrl,
    }));

  const sum = (pick: (r: ActivePlayerRow) => number | null) =>
    rows.reduce((a, r) => a + (pick(r) ?? 0), 0);

  const hasStats = (r: ActivePlayerRow) =>
    [r.matchesPlayed, r.minutes, r.goals, r.assists, r.points, r.saves].some((v) => v != null);

  const byGoals = [...rows]
    .filter((r) => (r.goals ?? 0) > 0)
    .sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0) || (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 10);
  const byAssists = [...rows]
    .filter((r) => (r.assists ?? 0) > 0)
    .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))
    .slice(0, 10);

  rows.sort(
    (a, b) =>
      (b.points ?? 0) - (a.points ?? 0) ||
      (b.goals ?? 0) - (a.goals ?? 0) ||
      a.name.localeCompare(b.name)
  );

  return {
    activeCount: rows.length,
    withStats: rows.filter(hasStats).length,
    totals: {
      goals: sum((r) => r.goals),
      assists: sum((r) => r.assists),
      points: sum((r) => r.points),
      minutes: sum((r) => r.minutes),
      saves: sum((r) => r.saves),
    },
    rows,
    topScorers: byGoals,
    topAssists: byAssists,
  };
}

// ─────────────────────────── Program performance ───────────────────────────

export type ProgramStat = {
  program: string;
  operations: number;
  uniquePlayers: number;
  d1Ops: number;
  d1Pct: number;
  scholarshipTotal: number;
  scholarshipMedian: number | null;
  coveragePct: number;
  topUniversities: { name: string; ops: number }[];
};

export async function getProgramStats(): Promise<ProgramStat[]> {
  const rows = (await prisma.player.findMany({
    where: { active: true },
    select: { name: true, university: true, season: true, division: true, program: true, scholarship: true },
  })) as Row[];

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = (r.program ?? "").trim() || "—";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }

  const out: ProgramStat[] = [];
  for (const [program, list] of groups) {
    const d1 = list.filter((r) => isD1(r.division)).length;
    const amounts = list.filter((r) => r.scholarship != null).map((r) => r.scholarship!) ;
    const uniCounts = new Map<string, number>();
    for (const r of list)
      for (const u of canonicalizeUniversity(r.university)) {
        uniCounts.set(u, (uniCounts.get(u) ?? 0) + 1);
      }
    const topUniversities = [...uniCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, ops]) => ({ name, ops }));

    out.push({
      program,
      operations: list.length,
      uniquePlayers: new Set(list.map((r) => norm(r.name))).size,
      d1Ops: d1,
      d1Pct: list.length ? Math.round((d1 / list.length) * 1000) / 10 : 0,
      scholarshipTotal: amounts.reduce((a, v) => a + v, 0),
      scholarshipMedian: median(amounts),
      coveragePct: list.length ? Math.round((amounts.length / list.length) * 1000) / 10 : 0,
      topUniversities,
    });
  }
  return out.sort((a, b) => b.operations - a.operations);
}

// ─────────────────────────── University network ───────────────────────────

export type UniversityStat = {
  name: string;
  operations: number;
  uniquePlayers: number;
  seasons: number;
  lastSeason: string | null;
  scholarshipTotal: number;
  scholarshipAvg: number | null;
  score: number; // 0-100 relationship score (orientative)
  tier: string;
};

export type UniversityNetwork = {
  totalUniversities: number;
  partners: number; // 3+ operations
  avgOpsPerUniversity: number;
  universities: UniversityStat[];
};

export async function getUniversityNetwork(): Promise<UniversityNetwork> {
  const rows = (await prisma.player.findMany({
    where: { active: true },
    select: { name: true, university: true, season: true, division: true, program: true, scholarship: true },
  })) as Row[];

  const latest = Math.max(
    0,
    ...rows.map((r) => seasonSortKey(r.season)).filter((n) => n >= 0)
  );

  type Agg = {
    name: string;
    ops: number;
    players: Set<string>;
    seasons: Set<string>;
    lastSeasonKey: number;
    scholarship: number;
    schCount: number;
  };
  const map = new Map<string, Agg>();

  for (const r of rows) {
    const unis = canonicalizeUniversity(r.university);
    unis.forEach((name, idx) => {
      const k = uniKey(name);
      const a =
        map.get(k) ??
        {
          name,
          ops: 0,
          players: new Set<string>(),
          seasons: new Set<string>(),
          lastSeasonKey: -1,
          scholarship: 0,
          schCount: 0,
        };
      a.ops += 1;
      a.players.add(norm(r.name));
      if (r.season) a.seasons.add(r.season.trim());
      a.lastSeasonKey = Math.max(a.lastSeasonKey, seasonSortKey(r.season));
      // attribute scholarship to the first (primary) university only
      if (idx === 0 && r.scholarship != null) {
        a.scholarship += r.scholarship;
        a.schCount += 1;
      }
      map.set(k, a);
    });
  }

  const universities: UniversityStat[] = [...map.values()].map((a) => {
    const avg = a.schCount ? Math.round(a.scholarship / a.schCount) : null;
    const recency = latest > 0 ? Math.max(0, 1 - (latest - a.lastSeasonKey) / 6) : 0;
    const score = Math.round(
      45 * Math.min(a.ops / 8, 1) +
        25 * Math.min(a.seasons.size / 5, 1) +
        15 * recency +
        15 * Math.min((avg ?? 0) / 150000, 1)
    );
    const tier =
      score >= 75
        ? "Elite partner"
        : score >= 55
          ? "Strong partner"
          : score >= 35
            ? "Active partner"
            : "Emerging";
    return {
      name: a.name,
      operations: a.ops,
      uniquePlayers: a.players.size,
      seasons: a.seasons.size,
      lastSeason:
        a.lastSeasonKey >= 0
          ? `${a.lastSeasonKey}/${String((a.lastSeasonKey + 1) % 100).padStart(2, "0")}`
          : null,
      scholarshipTotal: a.scholarship,
      scholarshipAvg: avg,
      score,
      tier,
    };
  });

  universities.sort(
    (a, b) => b.operations - a.operations || b.scholarshipTotal - a.scholarshipTotal
  );

  return {
    totalUniversities: universities.length,
    partners: universities.filter((u) => u.operations >= 3).length,
    avgOpsPerUniversity: universities.length
      ? Math.round((rows.length / universities.length) * 10) / 10
      : 0,
    universities,
  };
}
