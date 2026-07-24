import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const player = await prisma.player.findUnique({
    where: { id: params.id },
    include: { sport: { select: { code: true, name: true } } },
  });
  if (!player) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ player });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = parsePlayerInput(body, { partial: true });
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Datos inválidos" }, { status: 400 });
  }

  const exists = await prisma.player.findUnique({ where: { id: params.id } });
  if (!exists) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const player = await prisma.player.update({
    where: { id: params.id },
    data: { ...data, updatedById: session.user.id },
    include: { sport: { select: { code: true, name: true } } },
  });

  return NextResponse.json({ player });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const exists = await prisma.player.findUnique({ where: { id: params.id } });
  if (!exists) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.player.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
