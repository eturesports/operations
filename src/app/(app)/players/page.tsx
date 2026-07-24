import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canEdit, canManageUsers } from "@/lib/permissions";
import { PlayersClient } from "./PlayersClient";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const session = await requireSession();
  const editable = canEdit(session.user.role);
  const isAdmin = canManageUsers(session.user.role);

  const [sports, players] = await Promise.all([
    prisma.sport.findMany({ orderBy: { order: "asc" } }),
    prisma.player.findMany({
      include: { sport: { select: { code: true, name: true } } },
      orderBy: [{ season: "desc" }, { name: "asc" }],
    }),
  ]);

  // Opciones distintas para los filtros/desplegables.
  const seasons = [...new Set(players.map((p) => p.season).filter(Boolean))] as string[];
  const divisions = [...new Set(players.map((p) => p.division).filter(Boolean))] as string[];
  const programs = [...new Set(players.map((p) => p.program).filter(Boolean))] as string[];

  return (
    <PlayersClient
      editable={editable}
      isAdmin={isAdmin}
      sports={sports.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
      initialPlayers={players.map((p) => ({
        id: p.id,
        name: p.name,
        university: p.university,
        season: p.season,
        division: p.division,
        program: p.program,
        scholarship: p.scholarship,
        notes: p.notes,
        legacyNumber: p.legacyNumber,
        sportCode: p.sport.code,
        sportId: p.sportId,
        profileImageUrl: p.profileImageUrl,
        actionImageUrl: p.actionImageUrl,
        ncaaUrl: p.ncaaUrl,
        instagramUrl: p.instagramUrl,
      }))}
      facets={{ seasons, divisions, programs }}
    />
  );
}
