import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePlayerInput } from "@/lib/validation";
import { logAudit, diffFields } from "@/lib/audit";
import { resolveShareToken, noteShareUse, SHAREABLE_FIELDS } from "@/lib/share";

// PATCH /api/share/[token] — edits made by someone holding a share link.
// No session: the token IS the authorization, so it is scoped to one player
// and to SHAREABLE_FIELDS only, and every change is audit-logged.
export async function PATCH(
  req: Request,
  { params }: { params: { token: string } }
) {
  const share = await resolveShareToken(params.token);
  if (!share.ok) {
    return NextResponse.json({ error: share.reason }, { status: share.status });
  }

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Ignore anything outside the allowed set — a crafted request cannot reach
  // scholarship, the archive flag, or another player.
  const filtered: Record<string, unknown> = {};
  for (const f of SHAREABLE_FIELDS) if (f in raw) filtered[f] = raw[f];
  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = parsePlayerInput(filtered, { partial: true });
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Invalid data" }, { status: 400 });
  }

  const before = await prisma.player.findUnique({ where: { id: share.playerId } });
  if (!before) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const player = await prisma.player.update({
    where: { id: share.playerId },
    data,
  });

  const changes = diffFields(
    before as unknown as Record<string, unknown>,
    data as Record<string, unknown>,
    Object.keys(data)
  );
  if (changes) {
    await logAudit(null, {
      entity: "Player",
      entityId: player.id,
      entityName: player.name,
      action: "update_via_share_link",
      summary: `Edited “${player.name}” through a shared edit link`,
      changes,
    });
  }
  await noteShareUse(share.linkId);

  return NextResponse.json({ ok: true });
}
