import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { newShareToken, DEFAULT_SHARE_DAYS } from "@/lib/share";

function shareUrl(req: Request, token: string): string {
  const base =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    new URL(req.url).origin;
  return `${base.replace(/\/$/, "")}/share/${token}`;
}

// GET — the player's active link, if any
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const link = await prisma.playerShareLink.findFirst({
    where: { playerId: params.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!link || (link.expiresAt && link.expiresAt.getTime() < Date.now())) {
    return NextResponse.json({ link: null });
  }
  return NextResponse.json({
    link: {
      url: shareUrl(req, link.token),
      expiresAt: link.expiresAt,
      useCount: link.useCount,
      lastUsedAt: link.lastUsedAt,
    },
  });
}

// POST — create (or replace) the player's share link
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const player = await prisma.player.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { days?: unknown };
  const days = Number.isFinite(Number(body.days))
    ? Math.min(Math.max(Math.round(Number(body.days)), 1), 365)
    : DEFAULT_SHARE_DAYS;

  const token = newShareToken();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // One live link per player: replacing it invalidates whatever was shared.
  const link = await prisma.$transaction(async (tx) => {
    await tx.playerShareLink.updateMany({
      where: { playerId: params.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.playerShareLink.create({
      data: { token, playerId: params.id, expiresAt, createdById: session.user.id },
    });
  });

  await logAudit(session.user, {
    entity: "Player",
    entityId: player.id,
    entityName: player.name,
    action: "share_link_created",
    summary: `Created an edit link for ${player.name}, valid ${days} days`,
  });

  return NextResponse.json({
    link: { url: shareUrl(req, link.token), expiresAt: link.expiresAt, useCount: 0 },
  });
}

// DELETE — revoke every live link for this player
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "No permission" }, { status: 403 });
  }

  const player = await prisma.player.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  const res = await prisma.playerShareLink.updateMany({
    where: { playerId: params.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (res.count > 0) {
    await logAudit(session.user, {
      entity: "Player",
      entityId: params.id,
      entityName: player?.name ?? null,
      action: "share_link_revoked",
      summary: `Revoked the edit link for ${player?.name ?? "a player"}`,
    });
  }

  return NextResponse.json({ ok: true, revoked: res.count });
}
