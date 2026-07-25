import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

type IncomingRow = {
  name?: string;
  university?: string;
  season?: string;
  division?: string;
  program?: string;
  scholarship?: string | number;
  sportCode?: string;
  notes?: string;
  nationality?: string;
  position?: string;
  previousClub?: string;
  graduated?: string;
  graduationYear?: string;
  active?: string;
};

// POST /api/players/import
// body: { defaultSportId: string, skipDuplicates?: boolean, rows: IncomingRow[] }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    defaultSportId?: string;
    skipDuplicates?: boolean;
    rows?: IncomingRow[];
  } | null;

  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  if (body.rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  if (body.rows.length > 5000) {
    return NextResponse.json(
      { error: "Too many rows (maximum 5000 per import)" },
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
      { error: "Select a valid target sport" },
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
        nationality: raw.nationality,
        position: raw.position,
        previousClub: raw.previousClub,
        graduated: raw.graduated,
        graduationYear: raw.graduationYear,
        ...(raw.active !== undefined ? { active: raw.active } : {}),
      },
      { partial: false }
    );

    if (error || !data) {
      errors.push({ row: i + 2, error: error ?? "Invalid data" }); // +2: fila 1 = cabecera
      continue;
    }

    if (skipDuplicates) {
      const dup = await prisma.player.findFirst({
        where: {
          sportId: data.sportId!,
          // case-insensitive so a re-imported "FRAN CORTIJO" still matches the
          // stored "Fran Cortijo" instead of creating a second record
          name: { equals: data.name!, mode: "insensitive" },
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
        nationality: data.nationality ?? null,
        position: data.position ?? null,
        previousClub: data.previousClub ?? null,
        graduated: data.graduated ?? false,
        graduationYear: data.graduationYear ?? null,
        active: data.active ?? true,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    });
    created++;
  }

  await logAudit(session.user, {
    entity: "Player",
    action: "import",
    summary: `Imported CSV: ${created} created, ${skipped} skipped, ${errors.length} errors`,
    changes: { created, skipped, errors: errors.length },
  });

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
  });
}
