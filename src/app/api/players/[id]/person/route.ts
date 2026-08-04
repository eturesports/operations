import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

/**
 * Separates one operation from the person it was attached to.
 *
 * Records are tied into a career by person, and a person was first worked out
 * from the name — which is right nearly always and wrong whenever two people
 * share one. Two different David Fernandezes, one at Mars Hill and one at
 * SNHU, arrived as a single career with a transfer that never happened.
 *
 * This gives the record a person of its own. Nothing else moves: the
 * university, the season and the money describe the operation and were never
 * shared. The fields that describe a human being — nationality, position,
 * Instagram, graduation, the draft — stay on the record as they are, but from
 * now on they are this person's alone and editing one no longer reaches the
 * other.
 */
export async function POST(
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

  const player = await prisma.player.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, university: true, season: true, personId: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const siblings = player.personId
    ? await prisma.player.count({
        where: { personId: player.personId, NOT: { id: player.id } },
      })
    : 0;

  // Alone already — splitting would only swap one person for another.
  if (siblings === 0) {
    return NextResponse.json(
      { error: "This record is already on its own person." },
      { status: 400 }
    );
  }

  const person = await prisma.person.create({ data: { name: player.name } });
  await prisma.player.update({
    where: { id: player.id },
    data: { personId: person.id },
  });

  const where = [player.university, player.season].filter(Boolean).join(" ");
  await logAudit(session.user, {
    entity: "Player",
    entityId: player.id,
    entityName: player.name,
    action: "split_person",
    summary: `Separated ${player.name}${where ? ` (${where})` : ""} from ${siblings} other record${siblings === 1 ? "" : "s"} — a different person of the same name`,
    changes: { from: player.personId, to: person.id, leftBehind: siblings },
  });

  return NextResponse.json({ personId: person.id, separatedFrom: siblings });
}
