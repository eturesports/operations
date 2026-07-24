import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
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
  };

  const data: { role?: Role; active?: boolean } = {};
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role as Role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }
    data.role = body.role as Role;
  }
  if (body.active !== undefined) data.active = Boolean(body.active);

  // Evita que un admin se quite a sí mismo el último acceso admin.
  if (params.id === session.user.id && (data.role === "VIEWER" || data.role === "EDITOR")) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) {
      return NextResponse.json(
        { error: "No puedes quitarte el rol de administrador siendo el único." },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ user });
}
