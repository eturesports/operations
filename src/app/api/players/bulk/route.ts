import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canManageUsers } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";

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
      return NextResponse.json({ ok: true, deleted: res.count });
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No players selected" }, { status: 400 });
    }
    const res = await prisma.player.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, deleted: res.count });
  }

  // ---- Bulk update ----
  if (body.action === "update") {
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No players selected" }, { status: 400 });
    }
    // Only allow a safe subset of fields for bulk edits.
    const allowed = ["season", "division", "program", "university"] as const;
    const raw = body.patch ?? {};
    const filtered: Record<string, unknown> = {};
    for (const k of allowed) if (k in raw) filtered[k] = raw[k];
    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const { data, error } = parsePlayerInput(filtered, { partial: true });
    if (error || !data) {
      return NextResponse.json({ error: error ?? "Invalid data" }, { status: 400 });
    }
    const res = await prisma.player.updateMany({
      where: { id: { in: ids } },
      data: { ...data, updatedById: session.user.id },
    });
    return NextResponse.json({ ok: true, updated: res.count });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
