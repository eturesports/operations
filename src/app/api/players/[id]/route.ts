import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";
import { logAudit, diffFields } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: { sport: { select: { code: true, name: true } } },
  });
  if (!player) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ player });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = parsePlayerInput(body, { partial: true });
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Invalid data" }, { status: 400 });
  }

  const exists = await prisma.player.findUnique({ where: { id: params.id } });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const player = await prisma.player.update({
    where: { id: params.id },
    data: { ...data, updatedById: session.user.id },
    include: { sport: { select: { code: true, name: true } } },
  });

  const changes = diffFields(
    exists as unknown as Record<string, unknown>,
    data as Record<string, unknown>,
    Object.keys(data)
  );
  if (changes) {
    await logAudit(session.user, {
      entity: "Player",
      entityId: player.id,
      entityName: player.name,
      action: "update",
      summary: `Edited player “${player.name}”`,
      changes,
    });
  }

  return NextResponse.json({ player });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const exists = await prisma.player.findUnique({ where: { id: params.id } });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.player.delete({ where: { id: params.id } });

  await logAudit(session.user, {
    entity: "Player",
    entityId: exists.id,
    entityName: exists.name,
    action: "delete",
    summary: `Deleted player “${exists.name}”`,
  });

  return NextResponse.json({ ok: true });
}
