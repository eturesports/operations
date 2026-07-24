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

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const items = await prisma.claim.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Claim text is required" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  for (const f of FIELDS) {
    if (f in body) {
      const v = String(body[f] ?? "").trim();
      data[f] = v || null;
    }
  }
  data.text = text;
  if (typeof body.status === "string") data.status = body.status as ClaimStatus;
  if (body.asOf) data.asOf = new Date(String(body.asOf));
  else data.asOf = new Date();

  const item = await prisma.claim.create({ data: data as never });
  await logAudit(session.user, {
    entity: "Claim",
    entityId: item.id,
    entityName: item.text.slice(0, 80),
    action: "create",
    summary: `Created claim: “${item.text.slice(0, 60)}”`,
  });
  return NextResponse.json({ item }, { status: 201 });
}
