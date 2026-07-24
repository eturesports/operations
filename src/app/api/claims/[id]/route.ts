import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { ClaimStatus } from "@prisma/client";

const FIELDS = [
  "text",
  "metric",
  "definition",
  "population",
  "period",
  "denominator",
  "source",
  "coverage",
  "authorizedUse",
  "owner",
] as const;

const STATUSES: ClaimStatus[] = ["DRAFT", "APPROVED", "ARCHIVED"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const f of FIELDS) {
    if (f in body) {
      const v = String(body[f] ?? "").trim();
      data[f] = f === "text" ? v : v || null;
    }
  }
  if (typeof body.status === "string" && STATUSES.includes(body.status as ClaimStatus)) {
    data.status = body.status as ClaimStatus;
  }
  if (body.asOf !== undefined) data.asOf = body.asOf ? new Date(String(body.asOf)) : null;

  const exists = await prisma.claim.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.claim.update({ where: { id: params.id }, data: data as never });
  await logAudit(session.user, {
    entity: "Claim",
    entityId: item.id,
    entityName: item.text.slice(0, 80),
    action: "update",
    summary: `Edited claim: “${item.text.slice(0, 60)}”`,
    changes: data,
  });
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const exists = await prisma.claim.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.claim.delete({ where: { id: params.id } });
  await logAudit(session.user, {
    entity: "Claim",
    entityId: exists.id,
    entityName: exists.text.slice(0, 80),
    action: "delete",
    summary: `Deleted claim: “${exists.text.slice(0, 60)}”`,
  });
  return NextResponse.json({ ok: true });
}
