import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"];

// PATCH /api/users/:id  { role?, active? }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    role?: string;
    active?: boolean;
    approved?: boolean;
  };

  const data: { role?: Role; active?: boolean; approved?: boolean } = {};
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role as Role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    data.role = body.role as Role;
  }
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.approved !== undefined) data.approved = Boolean(body.approved);

  // Evita que un admin se quite a sí mismo el último acceso admin.
  if (params.id === session.user.id && (data.role === "VIEWER" || data.role === "EDITOR")) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) {
      return NextResponse.json(
        { error: "You can't remove your own admin role as the only administrator." },
        { status: 400 }
      );
    }
  }

  const before = await prisma.user.findUnique({ where: { id: params.id } });
  const user = await prisma.user.update({ where: { id: params.id }, data });

  const bits: string[] = [];
  if (data.role !== undefined && before && data.role !== before.role)
    bits.push(`role ${before.role} → ${data.role}`);
  if (data.approved !== undefined && before && data.approved !== before.approved)
    bits.push(data.approved ? "approved" : "unapproved");
  if (data.active !== undefined && before && data.active !== before.active)
    bits.push(data.active ? "activated" : "deactivated");
  if (bits.length) {
    await logAudit(session.user, {
      entity: "User",
      entityId: user.id,
      entityName: user.email,
      action: data.approved === true && before?.approved === false ? "approve" : "update",
      summary: `${user.email}: ${bits.join(", ")}`,
      changes: data,
    });
  }

  return NextResponse.json({ user });
}
