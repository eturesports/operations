"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { trackPointer, useTravellingPill } from "./useTravellingPill";

type Item = { href: string; label: string; icon: React.ReactNode };

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/dashboard", label: "Overview", icon: <GridIcon /> },
    { href: "/players", label: "Players", icon: <UsersIcon /> },
    { href: "/showcase", label: "Showcase", icon: <TrophyIcon /> },
  ];
  // Share links go outside the company, so they stay with editors.
  if (role === "ADMIN" || role === "EDITOR")
    items.splice(2, 0, { href: "/links", label: "Links", icon: <LinkIcon /> });
  if (role === "ADMIN")
    items.push({ href: "/users", label: "Access", icon: <ShieldIcon /> });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const activeIndex = items.findIndex((it) => isActive(it.href));
  const { container, items: tabs, pill, settled } = useTravellingPill<HTMLDivElement>(activeIndex);

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        ref={container}
        onPointerMove={trackPointer}
        // An admin has five destinations, and five labelled items are wider
        // than an iPhone once the padding is counted. They are tightened to
        // fit; the scroll is the safety valve, so a narrower phone or a sixth
        // destination becomes a swipe rather than a bar hanging off the edge.
        className="liquid-glass no-scrollbar pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full px-2 py-2 shadow-glow"
      >
        {pill && (
          <span
            aria-hidden
            className="nav-pill"
            style={{
              transform: `translate(${pill.x}px, ${pill.y}px)`,
              width: pill.w,
              height: pill.h,
              transitionDuration: settled ? undefined : "0ms",
            }}
          />
        )}
        {items.map((it, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={it.href}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`relative z-[2] flex min-w-[52px] shrink-0 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-[10px] font-medium leading-tight transition-colors duration-300 sm:min-w-[72px] sm:px-4 sm:text-[11px] ${
                active ? "text-white" : "text-muted hover:text-fg"
              }`}
            >
              <span className="h-5 w-5">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}
