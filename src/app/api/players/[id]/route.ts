import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canContribute, canEdit } from "@/lib/permissions";
import { parsePlayerInput } from "@/lib/validation";
import { logAudit, diffFields } from "@/lib/audit";
import { syncPersonFields } from "@/lib/person";
import { setPlayingNow } from "@/lib/profiles";
import { moveUniversity, syncPlayerFromProfiles } from "@/lib/divisions";

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
  if (!canContribute(session.user.role)) {
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

  let player = await prisma.player.update({
    where: { id: params.id },
    data: { ...data, updatedById: session.user.id },
    include: { sport: { select: { code: true, name: true } } },
  });

  // Changing the university here has to reach the college profile, which is
  // what actually owns it — and the division comes with it, from the NCAA
  // directory rather than from a second field to keep in step. The form shows
  // the division read-only for exactly this reason: choosing Providence is
  // choosing Division I, and there is nothing left to decide.
  if ("university" in data && data.university !== exists.university) {
    await moveUniversity(params.id, (data.university as string | null) ?? null);
    await syncPlayerFromProfiles(params.id);
    // Re-read: the mirror was re-derived after the update above returned.
    player = await prisma.player.findUniqueOrThrow({
      where: { id: params.id },
      include: { sport: { select: { code: true, name: true } } },
    });
  }

  // Nationality, position and the rest of what describes the human being are
  // the same at every university, so an edit here reaches their other
  // operations rather than leaving the database disagreeing with itself.
  const spread = await syncPersonFields(params.id, data as Record<string, unknown>);
  if (spread.siblings > 0) {
    await logAudit(session.user, {
      entity: "Player",
      entityId: player.id,
      entityName: player.name,
      action: "person_fields_synced",
      summary: `Applied ${spread.fields.join(", ")} to ${player.name}'s other ${
        spread.siblings === 1 ? "operation" : `${spread.siblings} operations`
      }`,
      changes: { fields: spread.fields, siblings: spread.siblings },
    });
  }

  // "Playing now" is stored on the player's university profiles, not on the
  // player row, so it is applied separately when the form sends it.
  let playingWarning: string | undefined;
  if ("playingNow" in body) {
    const wanted = Boolean(body.playingNow);
    const res = await setPlayingNow(params.id, wanted);
    if (!res.ok) {
      playingWarning =
        "Add a university to this player (or a university profile) before marking them as playing now.";
    } else if (res.changed) {
      await logAudit(session.user, {
        entity: "Player",
        entityId: player.id,
        entityName: player.name,
        action: wanted ? "playing_now_set" : "playing_now_cleared",
        summary: wanted
          ? `Marked ${player.name} as currently playing`
          : `Marked ${player.name} as no longer playing`,
      });
    }
  }

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

  return NextResponse.json({
    player,
    warning: playingWarning,
    // So the screen can say that an edit reached more than one record.
    syncedTo: spread.siblings,
    syncedFields: spread.fields,
  });
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
