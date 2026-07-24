import { prisma } from "@/lib/prisma";
import { seasonSortKey } from "@/lib/format";

// Authority metrics following the Eture Data Intelligence framework (Phase 1):
// clear definitions, denominators and coverage — a row is an OPERATION, not
// necessarily a unique player.

const NCAA_DIVS = new Set(["division i", "division ii", "division iii"]);
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const isNCAA = (d: string | null) => NCAA_DIVS.has(norm(d));
const isD1 = (d: string | null) => norm(d) === "division i";

export type Bucket = { key: string; ops: number; players: number; pct: number; scholarship: number };

export type AuthorityData = {
  operations: number;
  uniquePlayers: number;
  transfers: number; // operations beyond the first per player (approx.)
  universities: number;
  seasonsCount: number;
  seasonFrom: string | null;
  seasonTo: string | null;
  avgPerSeason: number;
  bestSeason: { key: string; ops: number } | null;
  scholarship: {
    total: number;
    withData: number;
    coveragePct: number;
    average: number | null;
    median: number | null;
  };
  d1: {
    d1Ops: number;
    ncaaOps: number;
    d1OverTotalPct: number;
    d1WithinNcaaPct: number;
    playersReachedD1: number;
    playersReachedD1Pct: number;
  };
  byDivision: Bucket[];
  byProgram: Bucket[];
  bySeason: Bucket[];
  topUniversities: Bucket[];
};

function bucketize(
  rows: { key: string | null; scholarship: number | null }[],
  { sortBySeason = false, limit }: { sortBySeason?: boolean; limit?: number } = {}
): Bucket[] {
  const total = rows.length;
  const map = new Map<string, { ops: number; scholarship: number; players: Set<string> }>();
  // players set not meaningful here; ops == players per row group unless deduping
  for (const r of rows) {
    const key = (r.key ?? "").trim() || "—";
    const b = map.get(key) ?? { ops: 0, scholarship: 0, players: new Set<string>() };
    b.ops += 1;
    b.scholarship += r.scholarship ?? 0;
    map.set(key, b);
  }
  let out: Bucket[] = [...map.entries()].map(([key, b]) => ({
    key,
    ops: b.ops,
    players: b.ops,
    scholarship: b.scholarship,
    pct: total ? Math.round((b.ops / total) * 1000) / 10 : 0,
  }));
  if (sortBySeason) out.sort((a, b) => seasonSortKey(b.key) - seasonSortKey(a.key));
  else out.sort((a, b) => b.ops - a.ops || b.scholarship - a.scholarship);
  if (limit) out = out.slice(0, limit);
  return out;
}

export async function getAuthorityData(): Promise<AuthorityData> {
  const rows = await prisma.player.findMany({
    where: { active: true },
    select: { name: true, university: true, season: true, division: true, program: true, scholarship: true },
  });

  const operations = rows.length;
  const uniqueNames = new Set(rows.map((r) => norm(r.name)));
  const uniquePlayers = uniqueNames.size;
  const transfers = Math.max(0, operations - uniquePlayers);

  const universities = new Set(rows.map((r) => norm(r.university)).filter(Boolean)).size;

  const seasons = [...new Set(rows.map((r) => (r.season ?? "").trim()).filter(Boolean))].sort(
    (a, b) => seasonSortKey(a) - seasonSortKey(b)
  );

  // Scholarships (coverage-aware)
  const withAmount = rows.filter((r) => r.scholarship != null) as { scholarship: number }[];
  const amounts = withAmount.map((r) => r.scholarship).sort((a, b) => a - b);
  const total = amounts.reduce((a, v) => a + v, 0);
  const average = amounts.length ? Math.round(total / amounts.length) : null;
  const median =
    amounts.length === 0
      ? null
      : amounts.length % 2
        ? amounts[(amounts.length - 1) / 2]
        : Math.round((amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2);

  // D1 with explicit denominators
  const d1Ops = rows.filter((r) => isD1(r.division)).length;
  const ncaaOps = rows.filter((r) => isNCAA(r.division)).length;
  const playersReachedD1 = new Set(rows.filter((r) => isD1(r.division)).map((r) => norm(r.name))).size;

  // Season buckets
  const bySeason = bucketize(rows.map((r) => ({ key: r.season, scholarship: r.scholarship })), {
    sortBySeason: true,
  });
  const bestSeason = [...bySeason].sort((a, b) => b.ops - a.ops)[0] ?? null;

  return {
    operations,
    uniquePlayers,
    transfers,
    universities,
    seasonsCount: seasons.length,
    seasonFrom: seasons[0] ?? null,
    seasonTo: seasons[seasons.length - 1] ?? null,
    avgPerSeason: seasons.length ? Math.round(operations / seasons.length) : 0,
    bestSeason: bestSeason ? { key: bestSeason.key, ops: bestSeason.ops } : null,
    scholarship: {
      total,
      withData: withAmount.length,
      coveragePct: operations ? Math.round((withAmount.length / operations) * 1000) / 10 : 0,
      average,
      median,
    },
    d1: {
      d1Ops,
      ncaaOps,
      d1OverTotalPct: operations ? Math.round((d1Ops / operations) * 1000) / 10 : 0,
      d1WithinNcaaPct: ncaaOps ? Math.round((d1Ops / ncaaOps) * 1000) / 10 : 0,
      playersReachedD1,
      playersReachedD1Pct: uniquePlayers ? Math.round((playersReachedD1 / uniquePlayers) * 1000) / 10 : 0,
    },
    byDivision: bucketize(rows.map((r) => ({ key: r.division, scholarship: r.scholarship }))),
    byProgram: bucketize(rows.map((r) => ({ key: r.program, scholarship: r.scholarship }))),
    bySeason,
    topUniversities: bucketize(rows.map((r) => ({ key: r.university, scholarship: r.scholarship })), {
      limit: 12,
    }),
  };
}
