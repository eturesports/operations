import { prisma } from "@/lib/prisma";
import { ETURE_OPERATION } from "@/lib/operations";
import { seasonSortKey } from "@/lib/format";

export type Bucket = { key: string; players: number; scholarship: number };

export type SportStats = {
  code: string;
  name: string;
  totalPlayers: number;
  totalScholarship: number;
  bySeason: Bucket[];
  byDivision: Bucket[];
  byProgram: Bucket[];
  topUniversities: Bucket[];
};

export type DashboardData = {
  totalPlayers: number;
  totalScholarship: number;
  sports: SportStats[];
};

function groupBuckets(
  rows: { key: string | null; players: number; scholarship: number }[],
  { sortBySeason = false, limit }: { sortBySeason?: boolean; limit?: number } = {}
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const key = r.key ?? "Sin dato";
    const b = map.get(key) ?? { key, players: 0, scholarship: 0 };
    b.players += r.players;
    b.scholarship += r.scholarship;
    map.set(key, b);
  }
  let out = [...map.values()];
  if (sortBySeason) {
    out.sort((a, b) => seasonSortKey(b.key) - seasonSortKey(a.key));
  } else {
    out.sort((a, b) => b.players - a.players || b.scholarship - a.scholarship);
  }
  if (limit) out = out.slice(0, limit);
  return out;
}

// Calcula toda la contabilización de forma automática desde la BD.
export async function getDashboardData(sportCode?: string): Promise<DashboardData> {
  const sports = await prisma.sport.findMany({ orderBy: { order: "asc" } });

  const perSport: SportStats[] = [];
  let totalPlayers = 0;
  let totalScholarship = 0;

  for (const sport of sports) {
    if (sportCode && sport.code !== sportCode) continue;

    const players = await prisma.player.findMany({
      where: { sportId: sport.id, ...ETURE_OPERATION },
      select: {
        season: true,
        division: true,
        program: true,
        university: true,
        scholarship: true,
      },
    });

    const sTotalPlayers = players.length;
    const sTotalScholarship = players.reduce((a, p) => a + (p.scholarship ?? 0), 0);

    perSport.push({
      code: sport.code,
      name: sport.name,
      totalPlayers: sTotalPlayers,
      totalScholarship: sTotalScholarship,
      bySeason: groupBuckets(
        players.map((p) => ({ key: p.season, players: 1, scholarship: p.scholarship ?? 0 })),
        { sortBySeason: true }
      ),
      byDivision: groupBuckets(
        players.map((p) => ({ key: p.division, players: 1, scholarship: p.scholarship ?? 0 }))
      ),
      byProgram: groupBuckets(
        players.map((p) => ({ key: p.program, players: 1, scholarship: p.scholarship ?? 0 }))
      ),
      topUniversities: groupBuckets(
        players.map((p) => ({ key: p.university, players: 1, scholarship: p.scholarship ?? 0 })),
        { limit: 10 }
      ),
    });

    totalPlayers += sTotalPlayers;
    totalScholarship += sTotalScholarship;
  }

  return { totalPlayers, totalScholarship, sports: perSport };
}
