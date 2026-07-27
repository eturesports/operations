import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Fields a share-link holder may change. Deliberately excludes the
// commercially sensitive scholarship amount, the archive flag and anything
// that could delete data — those stay with signed-in editors.
export const SHAREABLE_FIELDS = [
  "name",
  "university",
  "season",
  "division",
  "program",
  "position",
  "nationality",
  "previousClub",
  "notes",
  "profileImageUrl",
  "actionImageUrl",
  "ncaaUrl",
  "instagramUrl",
] as const;

export const DEFAULT_SHARE_DAYS = 30;

export function newShareToken(): string {
  // 32 bytes of entropy, URL-safe — not guessable
  return randomBytes(32).toString("base64url");
}

export type ResolvedShare = {
  ok: true;
  linkId: string;
  playerId: string;
};

export type ShareError = { ok: false; status: number; reason: string };

/**
 * Validate a share token. Returns the player it grants access to, or an
 * explicit reason so the page can say what happened (expired vs revoked).
 */
export async function resolveShareToken(
  token: string
): Promise<ResolvedShare | ShareError> {
  if (!token || token.length < 20) {
    return { ok: false, status: 404, reason: "This link is not valid." };
  }
  const link = await prisma.playerShareLink.findUnique({
    where: { token },
    select: { id: true, playerId: true, revokedAt: true, expiresAt: true },
  });
  if (!link) {
    return { ok: false, status: 404, reason: "This link is not valid." };
  }
  if (link.revokedAt) {
    return {
      ok: false,
      status: 410,
      reason: "This link has been revoked by Eture Sports.",
    };
  }
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 410, reason: "This link has expired." };
  }
  return { ok: true, linkId: link.id, playerId: link.playerId };
}

export async function noteShareUse(linkId: string): Promise<void> {
  try {
    await prisma.playerShareLink.update({
      where: { id: linkId },
      data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
    });
  } catch {
    // usage tracking must never block an edit
  }
}
