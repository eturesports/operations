// Fill a player's profile photo from their college roster page.
//
// Reading the photo is only half the job: universities re-cut their roster
// images every season and some block hotlinking, so the picture is copied
// into our own Blob storage and the record points at our copy. A photo an
// editor uploaded themselves is never touched.

import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { fetchRosterPhoto } from "@/lib/photo";

const MAX_BYTES = 8 * 1024 * 1024;

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

    let stored = found.url;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const res = await fetch(found.url, {
        headers: { referer: link, "user-agent": "Mozilla/5.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { added: false, reason: `The photo answered ${res.status}.` };

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        return { added: false, reason: "That address is not an image." };
      }

      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength === 0) return { added: false, reason: "The photo came back empty." };
      if (bytes.byteLength > MAX_BYTES) {
        return { added: false, reason: "The photo is too large to copy." };
      }

      const blob = await put(
        `players/${player.id}-${Date.now()}.${extensionFor(contentType, found.url)}`,
        bytes,
        { access: "public", contentType }
      );
      stored = blob.url;
    }

    await prisma.player.update({
      where: { id: player.id },
      data: { profileImageUrl: stored },
    });

    return { added: true, url: stored, confident: found.confident };
  } catch (e) {
    return {
      added: false,
      reason: e instanceof Error ? e.message : "Could not copy the photo.",
    };
  }
}
