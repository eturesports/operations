// Fill a player's profile photo from their college roster page.
//
// Reading the photo is only half the job: universities re-cut their roster
// images every season and some block hotlinking, so every photo lives in our
// own Blob storage and the record points at our copy — never at theirs. A
// photo an editor uploaded themselves is never touched.

import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { fetchRosterPhoto, isOurCopy } from "@/lib/photo";
import { blobToken, NO_STORAGE } from "@/lib/blob";

const MAX_BYTES = 8 * 1024 * 1024;

export { NO_STORAGE };

export type PhotoAdoption =
  | { added: false; reason?: string }
  | { added: true; url: string; confident: boolean };

function extensionFor(contentType: string, url: string): string {
  const fromType = contentType.split("/")[1]?.split(";")[0];
  if (fromType && /^(jpeg|jpg|png|webp|avif|gif)$/.test(fromType)) {
    return fromType === "jpeg" ? "jpg" : fromType;
  }
  const fromUrl = url.split("?")[0].split(".").pop()?.toLowerCase();
  return fromUrl && /^(jpe?g|png|webp|avif|gif)$/.test(fromUrl) ? fromUrl : "jpg";
}

type Stored = { ok: true; url: string } | { ok: false; reason: string };

// Downloads someone else's image and keeps our own copy of it.
async function storeCopy(
  playerId: string,
  imageUrl: string,
  referer: string
): Promise<Stored> {
  const token = blobToken();
  if (!token) return { ok: false, reason: NO_STORAGE };

  const res = await fetch(imageUrl, {
    headers: { referer, "user-agent": "Mozilla/5.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return { ok: false, reason: `The photo answered ${res.status}.` };

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return { ok: false, reason: "That address is not an image." };
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength === 0) return { ok: false, reason: "The photo came back empty." };
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, reason: "The photo is too large to copy." };
  }

  const blob = await put(
    `players/${playerId}-${Date.now()}.${extensionFor(contentType, imageUrl)}`,
    bytes,
    { access: "public", contentType, token }
  );
  return { ok: true, url: blob.url };
}

/**
 * Copies the headshot from `rosterUrl` onto the player, but only when they
 * have no photo yet. Never throws — a missing photo must not fail a stats
 * refresh.
 */
export async function adoptRosterPhoto(
  player: { id: string; name: string; profileImageUrl: string | null },
  rosterUrl: string | null | undefined
): Promise<PhotoAdoption> {
  if (player.profileImageUrl) return { added: false };
  const link = rosterUrl?.trim();
  if (!link) return { added: false };

  try {
    const found = await fetchRosterPhoto(link, player.name);
    if (!found.ok) return { added: false, reason: found.reason };

    const stored = await storeCopy(player.id, found.url, link);
    if (!stored.ok) return { added: false, reason: stored.reason };

    await prisma.player.update({
      where: { id: player.id },
      data: { profileImageUrl: stored.url },
    });

    return { added: true, url: stored.url, confident: found.confident };
  } catch (e) {
    return {
      added: false,
      reason: e instanceof Error ? e.message : "Could not copy the photo.",
    };
  }
}

/**
 * Brings a photo that still points at somebody else's server into our Blob
 * storage, keeping the same picture. For records whose photo was pasted as a
 * link before we stored our own copies.
 */
export async function mirrorPhoto(player: {
  id: string;
  profileImageUrl: string | null;
}): Promise<PhotoAdoption> {
  const current = player.profileImageUrl?.trim();
  if (!current || isOurCopy(current)) return { added: false };

  try {
    const stored = await storeCopy(player.id, current, current);
    if (!stored.ok) return { added: false, reason: stored.reason };

    await prisma.player.update({
      where: { id: player.id },
      data: { profileImageUrl: stored.url },
    });

    return { added: true, url: stored.url, confident: true };
  } catch (e) {
    return {
      added: false,
      reason: e instanceof Error ? e.message : "Could not copy the photo.",
    };
  }
}
