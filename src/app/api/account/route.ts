import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, diffFields } from "@/lib/audit";

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// PATCH /api/account — the signed-in user updates their own display name & photo.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: { name?: string | null; image?: string | null } = {};
  if ("name" in body) {
    const name = str(body.name);
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }
    data.name = name;
  }
  if ("image" in body) data.image = str(body.image);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id: session.user.id } });
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true, name: true, email: true, image: true, role: true },
  });

  const changes = diffFields(
    (before ?? {}) as unknown as Record<string, unknown>,
    data as Record<string, unknown>,
    Object.keys(data)
  );
  if (changes) {
    await logAudit(session.user, {
      entity: "User",
      entityId: user.id,
      entityName: user.email,
      action: "profile_update",
      summary: `Updated their own account profile`,
      changes,
    });
  }

  return NextResponse.json({ user });
}
