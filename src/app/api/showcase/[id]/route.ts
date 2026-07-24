import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    year?: number | string;
    name?: string;
    logoUrl?: string;
    notes?: string;
  };
  const data: Record<string, unknown> = {};
  if (body.year !== undefined) {
    const y = parseInt(String(body.year), 10);
    if (!Number.isFinite(y)) return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    data.year = y;
  }
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = n;
  }
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes.trim() || null;

  const exists = await prisma.showcaseUniversity.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.showcaseUniversity.update({ where: { id: params.id }, data });
  await logAudit(session.user, {
    entity: "ShowcaseUniversity",
    entityId: item.id,
    entityName: `${item.name} (${item.year})`,
    action: "update",
    summary: `Edited Showcase entry “${item.name}” (${item.year})`,
    changes: data,
  });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const exists = await prisma.showcaseUniversity.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.showcaseUniversity.delete({ where: { id: params.id } });
  await logAudit(session.user, {
    entity: "ShowcaseUniversity",
    entityId: exists.id,
    entityName: `${exists.name} (${exists.year})`,
    action: "delete",
    summary: `Removed “${exists.name}” from Showcase ${exists.year}`,
  });
  return NextResponse.json({ ok: true });
}
