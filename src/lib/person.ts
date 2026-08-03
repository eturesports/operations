// What belongs to the person and what belongs to the stint.
//
// A record is one operation: a player at a university for a season. Some of
// what it holds describes the operation and rightly differs between them —
// the university, the money, the photo taken in that shirt. The rest
// describes the human being and cannot differ: a player does not change
// nationality by transferring.
//
// Keeping the second kind on every record is what lets the filters, the
// dashboards and the CSV stay simple. The cost is that they can drift out of
// step, so an edit to one of them reaches the player's other operations.

import { prisma } from "@/lib/prisma";

/** True of the person, whichever university they are at. */
export const PERSON_FIELDS = [
  "name",
  "nationality",
  "position",
  "previousClub",
  "instagramUrl",
  "graduated",
  "graduationYear",
  // Drafted once, at the end of the college years — not at any one of them.
  "mlsDraftYear",
  "mlsDraftClub",
  "mlsDraftRound",
  "mlsDraftPick",
] as const;

/** True of this operation only. */
export const STINT_FIELDS = [
  "university",
  "season",
  "division",
  "program",
  "scholarship",
  "fullRide",
  "nationalChampion",
  "profileImageUrl",
  "actionImageUrl",
  "ncaaUrl",
  "notes",
] as const;

export type PersonField = (typeof PERSON_FIELDS)[number];

/**
 * Copies the fields that describe the human being onto their other
 * operations. Returns how many records followed, so the screen can say so —
 * changing four records when the editor edited one should never be silent.
 */
export async function syncPersonFields(
  playerId: string,
  patch: Record<string, unknown>
): Promise<{ siblings: number; fields: string[] }> {
  const fields = PERSON_FIELDS.filter((f) => f in patch);
  if (fields.length === 0) return { siblings: 0, fields: [] };

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { personId: true },
  });
  if (!player?.personId) return { siblings: 0, fields: [] };

  const shared = Object.fromEntries(fields.map((f) => [f, patch[f]]));
  const result = await prisma.player.updateMany({
    where: { personId: player.personId, NOT: { id: playerId } },
    data: shared,
  });

  // The person's own name follows too, so lists of people read correctly.
  if ("name" in shared && typeof shared.name === "string") {
    await prisma.person.update({
      where: { id: player.personId },
      data: { name: shared.name },
    });
  }

  return { siblings: result.count, fields: [...fields] };
}

/** Attaches a new operation to an existing person, or creates one. */
export async function personIdFor(name: string): Promise<string> {
  const normalised = name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const existing = await prisma.player.findFirst({
    where: { name: { equals: normalised, mode: "insensitive" }, personId: { not: null } },
    select: { personId: true },
  });
  if (existing?.personId) return existing.personId;

  const person = await prisma.person.create({ data: { name: name.trim() } });
  return person.id;
}
