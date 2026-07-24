import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const items = await prisma.showcaseUniversity.findMany({
    orderBy: [{ year: "desc" }, { order: "asc" }, { name: "asc" }],
  });
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
  const body = (await req.json().catch(() => ({}))) as {
    year?: number | string;
    name?: string;
    logoUrl?: string;
    notes?: string;
  };
  const year = parseInt(String(body.year ?? ""), 10);
  const name = (body.name ?? "").trim();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Valid year is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "University name is required" }, { status: 400 });
  }
  const max = await prisma.showcaseUniversity.aggregate({
    where: { year },
    _max: { order: true },
  });
  const item = await prisma.showcaseUniversity.create({
    data: {
      year,
      name,
      order: (max._max.order ?? 0) + 1,
      logoUrl: (body.logoUrl ?? "").trim() || null,
      notes: (body.notes ?? "").trim() || null,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
