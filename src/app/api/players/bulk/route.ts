import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canManageUsers } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { setPlayingNow } from "@/lib/profiles";

// POST /api/players/bulk
// { action: "delete", ids: string[] }
// { action: "delete", all: true, sportId?: string }   (delete all — admin only)
// { action: "update", ids: string[], patch: { season?, division?, program? } }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: "delete" | "update";
    ids?: string[];
    all?: boolean;
    sportId?: string;
    patch?: Record<string, unknown>;
  } | null;

  if (!body || !body.action) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // ---- Delete ----
  if (body.action === "delete") {
    if (body.all === true) {
      // Deleting everything is admin-only.
      if (!canManageUsers(session.user.role)) {
        return NextResponse.json(
          { error: "Only administrators can delete all players." },
          { status: 403 }
        );
      }
      const where = body.sportId ? { sportId: body.sportId } : {};
      const res = await prisma.player.deleteMany({ where });
      await logAudit(session.user, {
        entity: "Player",
        action: "delete_all",
        summary: `Deleted ALL players (${res.count})`,
        changes: { count: res.count },
      });
      return NextResponse.json({ ok: true, deleted: res.count });
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No players selected" }, { status: 400 });
    }
    const res = await prisma.player.deleteMany({ where: { id: { in: ids } } });
    await logAudit(session.user, {
      entity: "Player",
      action: "bulk_delete",
      summary: `Deleted ${res.count} selected players`,
      changes: { count: res.count, ids },
    });
    return NextResponse.json({ ok: true, deleted: res.count });
  }

  // ---- Bulk update ----
  if (body.action === "update") {
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No players selected" }, { status: 400 });
    }
    // Only allow a safe subset of fields for bulk edits.
    const allowed = [
      "season",
      "division",
      "program",
      "university",
      "active",
      "graduated",
      "graduationYear",
      "nationalChampion",
      "fullRide",
    ] as const;
    const raw = body.patch ?? {};
    const filtered: Record<string, unknown> = {};
    for (const k of allowed) if (k in raw) filtered[k] = raw[k];

    // "Playing now" lives on the player's university profiles, not the player
    // row, so it is applied separately from the column patch.
    const hasPlaying = "playingNow" in raw;
    if (Object.keys(filtered).length === 0 && !hasPlaying) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    let count = 0;
    let data: Record<string, unknown> = {};
    if (Object.keys(filtered).length > 0) {
      const parsed = parsePlayerInput(filtered, { partial: true });
      if (parsed.error || !parsed.data) {
        return NextResponse.json(
          { error: parsed.error ?? "Invalid data" },
          { status: 400 }
        );
      }
      data = parsed.data as Record<string, unknown>;
      const res = await prisma.player.updateMany({
        where: { id: { in: ids } },
        data: { ...parsed.data, updatedById: session.user.id },
      });
      count = res.count;
    }

    let playingApplied = 0;
    let playingSkipped = 0;
    if (hasPlaying) {
      const wanted = Boolean(raw.playingNow);
      for (const id of ids) {
        const r = await setPlayingNow(id, wanted);
        if (r.ok) playingApplied += 1;
        else playingSkipped += 1; // no university to build a profile from
      }
      count = Math.max(count, playingApplied);
    }

    await logAudit(session.user, {
      entity: "Player",
      action: "bulk_update",
      summary:
        `Bulk-edited ${ids.length} players` +
        (hasPlaying
          ? ` (playing now: ${raw.playingNow ? "yes" : "no"}${playingSkipped ? `, ${playingSkipped} skipped without a university` : ""})`
          : ""),
      changes: { count, fields: data, playingNow: hasPlaying ? raw.playingNow : undefined, ids },
    });

    return NextResponse.json({
      ok: true,
      updated: count,
      playingSkipped: playingSkipped || undefined,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
