"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { ThemeToggle } from "./ThemeToggle";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export function TopBar({
  user,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role: Role };
  signOutAction: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-30">
      <div className="glass mx-auto mt-3 flex max-w-6xl items-center gap-3 rounded-2xl px-4 py-2.5 sm:px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/eture-isotipo.svg"
            alt="Eture Sports"
            width={26}
            height={26}
            className="h-6 w-auto"
          />
          <span className="font-display text-lg leading-none tracking-[0.12em] text-fg">
            ETURE
          </span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-muted sm:inline">
            Operations
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium text-fg">
              {user.name ?? user.email}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted">
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
            <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-bold text-fg">
              {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink-700/60 hover:text-fg"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
