import { prisma } from "@/lib/prisma";

export type PlayingNowResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "no-university" };

/**
 * Set whether a player is currently playing on a college roster.
 *
 * "Playing now" lives on PlayerProfile.current (a player can hold several
 * university profiles after a transfer), so this keeps that single source of
 * truth in sync with the simple yes/no the user sees on the player form.
 *
 *  - false → clears the flag on every profile
 *  - true  → keeps an existing current profile, otherwise promotes the most
 *            recent one, otherwise creates one from the player's own
 *            university/season/division
 */
export async function setPlayingNow(
  playerId: string,
  playing: boolean
): Promise<PlayingNowResult> {
  if (!playing) {
    const res = await prisma.playerProfile.updateMany({
      where: { playerId, current: true },
      data: { current: false },
    });
    return { ok: true, changed: res.count > 0 };
  }

  const alreadyCurrent = await prisma.playerProfile.findFirst({
    where: { playerId, current: true },
    select: { id: true },
  });
  if (alreadyCurrent) return { ok: true, changed: false };

  const latest = await prisma.playerProfile.findFirst({
    where: { playerId },
    orderBy: [{ season: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (latest) {
    await prisma.playerProfile.update({
      where: { id: latest.id },
      data: { current: true },
    });
    return { ok: true, changed: true };
  }

  // No profiles at all — build the first one from the player record.
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { university: true, season: true, division: true },
  });
  if (!player?.university) return { ok: false, reason: "no-university" };

  await prisma.playerProfile.create({
    data: {
      playerId,
      university: player.university,
      season: player.season,
      division: player.division,
      current: true,
    },
  });
  return { ok: true, changed: true };
}
