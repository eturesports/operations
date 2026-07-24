import type { Role } from "@prisma/client";

// Jerarquía de roles: ADMIN > EDITOR > VIEWER
const RANK: Record<Role, number> = {
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export function canView(role: Role | undefined | null): boolean {
  return !!role && RANK[role] >= RANK.VIEWER;
}

export function canEdit(role: Role | undefined | null): boolean {
  return !!role && RANK[role] >= RANK.EDITOR;
}

export function canManageUsers(role: Role | undefined | null): boolean {
  return role === "ADMIN";
}

// Valores sugeridos en los formularios (el campo admite texto libre).
export const DIVISIONS = [
  "Division I",
  "Division II",
  "Division III",
  "JUCO",
  "NAIA III",
  "MLS NEXT PRO",
];

export const PROGRAMS = ["Becas EEUU", "Gap Year / Eture FC"];
