import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// GET /api/players?sport=MSOC&season=24/25&division=Division I&program=...&q=texto
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const where: Prisma.PlayerWhereInput = {};

  const sport = searchParams.get("sport");
  if (sport) where.sport = { code: sport };
  const season = searchParams.get("season");
  if (season) where.season = season;
  const division = searchParams.get("division");
  if (division) where.division = division;
  const program = searchParams.get("program");
  if (program) where.program = program;
  const q = searchParams.get("q");
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { university: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const players = await prisma.player.findMany({
    where,
    include: { sport: { select: { code: true, name: true } } },
    orderBy: [{ season: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ players });
}

// POST /api/players
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = parsePlayerInput(body);
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Datos inválidos" }, { status: 400 });
  }

  const sport = await prisma.sport.findUnique({ where: { id: data.sportId! } });
  if (!sport) {
    return NextResponse.json({ error: "Deporte no encontrado" }, { status: 400 });
  }

  const player = await prisma.player.create({
    data: {
      sportId: data.sportId!,
      name: data.name!,
      university: data.university ?? null,
      season: data.season ?? null,
      division: data.division ?? null,
      program: data.program ?? null,
      scholarship: data.scholarship ?? null,
      notes: data.notes ?? null,
      legacyNumber: data.legacyNumber ?? null,
      active: data.active ?? true,
      profileImageUrl: data.profileImageUrl ?? null,
      actionImageUrl: data.actionImageUrl ?? null,
      ncaaUrl: data.ncaaUrl ?? null,
      instagramUrl: data.instagramUrl ?? null,
      nationality: data.nationality ?? null,
      position: data.position ?? null,
      previousClub: data.previousClub ?? null,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
    include: { sport: { select: { code: true, name: true } } },
  });

  await logAudit(session.user, {
    entity: "Player",
    entityId: player.id,
    entityName: player.name,
    action: "create",
    summary: `Created player “${player.name}”`,
  });

  return NextResponse.json({ player }, { status: 201 });
}
