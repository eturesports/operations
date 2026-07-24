import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";

type IncomingRow = {
  name?: string;
  university?: string;
  season?: string;
  division?: string;
  program?: string;
  scholarship?: string | number;
  sportCode?: string;
  notes?: string;
};

// POST /api/players/import
// body: { defaultSportId: string, skipDuplicates?: boolean, rows: IncomingRow[] }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    defaultSportId?: string;
    skipDuplicates?: boolean;
    rows?: IncomingRow[];
  } | null;

  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  if (body.rows.length === 0) {
    return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });
  }
  if (body.rows.length > 5000) {
    return NextResponse.json(
      { error: "Demasiadas filas (máximo 5000 por importación)" },
      { status: 400 }
    );
  }

  // Mapa de deportes por código para resolver la columna "Deporte".
  const sports = await prisma.sport.findMany();
  const byCode = new Map(sports.map((s) => [s.code.toUpperCase(), s.id]));
  const validIds = new Set(sports.map((s) => s.id));

  const defaultSportId = body.defaultSportId;
  if (!defaultSportId || !validIds.has(defaultSportId)) {
    return NextResponse.json(
      { error: "Selecciona un deporte de destino válido" },
      { status: 400 }
    );
  }

  const skipDuplicates = body.skipDuplicates !== false; // por defecto true

  const errors: { row: number; error: string }[] = [];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < body.rows.length; i++) {
    const raw = body.rows[i];
    const sportId =
      (raw.sportCode && byCode.get(raw.sportCode.toUpperCase())) || defaultSportId;

    const { data, error } = parsePlayerInput(
      {
        sportId,
        name: raw.name,
        university: raw.university,
        season: raw.season,
        division: raw.division,
        program: raw.program,
        scholarship: raw.scholarship,
        notes: raw.notes,
      },
      { partial: false }
    );

    if (error || !data) {
      errors.push({ row: i + 2, error: error ?? "Datos inválidos" }); // +2: fila 1 = cabecera
      continue;
    }

    if (skipDuplicates) {
      const dup = await prisma.player.findFirst({
        where: {
          sportId: data.sportId!,
          name: data.name!,
          season: data.season ?? null,
          university: data.university ?? null,
        },
        select: { id: true },
      });
      if (dup) {
        skipped++;
        continue;
      }
    }

    await prisma.player.create({
      data: {
        sportId: data.sportId!,
        name: data.name!,
        university: data.university ?? null,
        season: data.season ?? null,
        division: data.division ?? null,
        program: data.program ?? null,
        scholarship: data.scholarship ?? null,
        notes: data.notes ?? null,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    });
    created++;
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
  });
}
