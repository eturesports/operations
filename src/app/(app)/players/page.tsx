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
      include: {
        sport: { select: { code: true, name: true } },
        // Every college profile: the current one drives the Active badge, and
        // all of them together are the player's career, which is what the
        // stats panel counts. Pulling stats no longer marks anyone as playing
        // now, so "current only" would report almost nothing.
        profiles: {
          select: {
            current: true,
            university: true,
            season: true,
            goals: true,
            assists: true,
            matchesPlayed: true,
            minutes: true,
            saves: true,
          },
          orderBy: [{ current: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ season: "desc" }, { name: "asc" }],
    }),
  ]);

  // A player's totals across every college they have played for. Each
  // profile already holds their career figures at that university.
  const careerOf = (
    profiles: {
      goals: number | null;
      assists: number | null;
      matchesPlayed: number | null;
      minutes: number | null;
    }[]
  ) => {
    const has = profiles.some(
      (x) =>
        x.minutes != null || x.goals != null || x.assists != null || x.matchesPlayed != null
    );
    if (!has) return null;
    const sum = (pick: (x: (typeof profiles)[number]) => number | null) =>
      profiles.reduce((a, x) => a + (pick(x) ?? 0), 0);
    return {
      minutes: sum((x) => x.minutes),
      goals: sum((x) => x.goals),
      assists: sum((x) => x.assists),
      matchesPlayed: sum((x) => x.matchesPlayed),
      colleges: profiles.length,
    };
  };

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
  // Sorted, because this one is long: 296 spellings, not the half-dozen a
  // season or a programme comes in.
  const universities = distinctCI(players.map((p) => p.university)).sort((a, b) =>
    a.localeCompare(b)
  );
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
        active: p.active,
        graduated: p.graduated,
        graduationYear: p.graduationYear,
        nationalChampion: p.nationalChampion,
        mlsDraftYear: p.mlsDraftYear,
        mlsDraftClub: p.mlsDraftClub,
        mlsDraftRound: p.mlsDraftRound,
        mlsDraftPick: p.mlsDraftPick,
        fullRide: p.fullRide,
        byEture: p.byEture,
        personId: p.personId,
        activeProfile: p.profiles.find((x) => x.current) ?? null,
        career: careerOf(p.profiles),
        nationality: p.nationality,
        position: p.position,
        previousClub: p.previousClub,
      }))}
      facets={{ seasons, divisions, programs, universities }}
    />
  );
}
