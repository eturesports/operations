import { requireEditor } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { LinksClient, type LinkRow } from "./LinksClient";

export const dynamic = "force-dynamic";

export default async function LinksPage() {
  await requireEditor();

  const players = await prisma.player.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      university: true,
      season: true,
      division: true,
      ncaaUrl: true,
      profiles: { where: { current: true }, select: { id: true }, take: 1 },
    },
    orderBy: [{ season: "desc" }, { name: "asc" }],
  });

  const rows: LinkRow[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    university: p.university,
    season: p.season,
    division: p.division,
    ncaaUrl: p.ncaaUrl,
    playingNow: p.profiles.length > 0,
  }));

  return <LinksClient rows={rows} />;
}
