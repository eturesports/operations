import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";
import { UniversitiesTable, type OperationRow } from "./UniversitiesTable";

export const dynamic = "force-dynamic";

export default async function UniversitiesPage() {
  await requireSession();

  // The ranking is built in the browser so the filters answer instantly;
  // this is the raw material for it, and it is only a few hundred rows.
  const players = await prisma.player.findMany({
    where: { active: true },
    select: {
      name: true,
      university: true,
      season: true,
      division: true,
      program: true,
      scholarship: true,
    },
  });

  const rows: OperationRow[] = players.map((p) => ({
    player: p.name,
    university: p.university,
    season: p.season,
    division: p.division,
    program: p.program,
    scholarship: p.scholarship,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">University Network</h1>
        <p className="text-sm text-muted">
          Which universities take our players, how many, and how much they fund. Filter by
          season, division or program, and click any column to reorder.
        </p>
      </div>

      <AnalyticsTabs />

      <UniversitiesTable rows={rows} />

      <p className="text-xs leading-relaxed text-muted">
        <b className="text-fg">Signed</b> counts operations, so a player who returns to the same
        university in a later season counts twice; <b className="text-fg">Players</b> counts each
        person once. Scholarship figures cover only the records that carry an amount, and a record
        naming two universities is credited to the first so the money is not counted twice.{" "}
        <b className="text-fg">Tier</b> is an orientative 0–100 score combining volume, seasons of
        continuity, recency and average scholarship. University names are normalized best-effort.
      </p>
    </div>
  );
}
