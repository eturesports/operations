"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
  VIEWER: "Lectura",
};

export function NavBar({
  user,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role: Role };
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Panel" },
    { href: "/players", label: "Jugadores" },
  ];
  if (user.role === "ADMIN") links.push({ href: "/users", label: "Usuarios" });

  return (
    <header className="sticky top-0 z-30 border-b border-ink-600 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-sm font-black uppercase tracking-[0.25em] text-brand">
            ETURE
          </span>
          <span className="hidden text-xs font-semibold uppercase tracking-widest text-gray-500 sm:inline">
            Database
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-ink-700 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium text-gray-200">
              {user.name ?? user.email}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              {ROLE_LABEL[user.role]}
            </div>
          </div>
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="h-8 w-8 rounded-full border border-ink-600"
            />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-bold text-gray-300">
              {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:text-white"
              title="Cerrar sesión"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
