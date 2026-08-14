import type { Role } from "@prisma/client";

// Jerarquía de roles: ADMIN > EDITOR > COLLABORATOR > VIEWER
const RANK: Record<Role, number> = {
  ADMIN: 4,
  EDITOR: 3,
  COLLABORATOR: 2,
  VIEWER: 1,
};

export function canView(role: Role | undefined | null): boolean {
  return !!role && RANK[role] >= RANK.VIEWER;
}

/**
 * May change what is already there — a roster link, a player's details, the
 * figures on a college profile — but may not bring a record into existence
 * or take one out.
 *
 * This is the line the COLLABORATOR role draws. Someone filling in NCAA
 * links and tidying details all week does not need the power to delete a
 * player, and a permission nobody needs is one that can only be used by
 * accident.
 */
export function canContribute(role: Role | undefined | null): boolean {
  return !!role && RANK[role] >= RANK.COLLABORATOR;
}

/**
 * The full run of the players database, creating and deleting included.
 *
 * Every route keeps this unless it was deliberately opened to contributors,
 * so a permission is never widened by forgetting to narrow it.
 */
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
