import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEdit, canManageUsers } from "@/lib/permissions";
import type { Session } from "next-auth";

// Devuelve la sesión o redirige a /login. Úsalo en Server Components/route handlers.
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.active === false) redirect("/unauthorized");
  if (session.user.approved === false) redirect("/pending");
  return session;
}

export async function requireEditor(): Promise<Session> {
  const session = await requireSession();
  if (!canEdit(session.user.role)) redirect("/unauthorized");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!canManageUsers(session.user.role)) redirect("/unauthorized");
  return session;
}
