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
};

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
