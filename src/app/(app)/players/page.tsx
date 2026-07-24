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

  // Distinct options for filters/dropdowns. Dedupe case-insensitively so
  // near-duplicate variants (e.g. "MLS NEXT PRO" vs "MLS Next Pro") collapse.
  const distinctCI = (vals: (string | null)[]) => {
    const seen = new Map<string, string>();
    for (const v of vals) {
      const s = (v ?? "").trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (!seen.has(k)) seen.set(k, s);
    }
    return [...seen.values()];
  };
  const seasons = distinctCI(players.map((p) => p.season));
  const divisions = distinctCI(players.map((p) => p.division));
  const programs = distinctCI(players.map((p) => p.program));

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
        nationality: p.nationality,
        position: p.position,
        previousClub: p.previousClub,
      }))}
      facets={{ seasons, divisions, programs }}
    />
  );
}
