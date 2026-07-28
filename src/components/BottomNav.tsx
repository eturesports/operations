"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Role } from "@prisma/client";

type Item = { href: string; label: string; icon: React.ReactNode };

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/dashboard", label: "Overview", icon: <GridIcon /> },
    { href: "/players", label: "Players", icon: <UsersIcon /> },
    { href: "/showcase", label: "Showcase", icon: <TrophyIcon /> },
    { href: "/claims", label: "Claims", icon: <QuoteIcon /> },
  ];
  if (role === "ADMIN" || role === "EDITOR")
    items.splice(2, 0, { href: "/links", label: "Links", icon: <LinkIcon /> });
  if (role === "ADMIN")
    items.push({ href: "/users", label: "Access", icon: <ShieldIcon /> });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const bar = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  // The first paint places the pill without animating it; only later moves
  // should travel, or every page load would begin with the pill sliding in
  // from the left.
  const [settled, setSettled] = useState(false);

  const placePill = useCallback(() => {
    const index = items.findIndex((it) => isActive(it.href));
    const el = index >= 0 ? tabs.current[index] : null;
    setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useLayoutEffect(placePill, [placePill]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    // Labels reflow between breakpoints, so the pill is re-measured with them.
    const observer = new ResizeObserver(placePill);
    if (bar.current) observer.observe(bar.current);
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [placePill]);

  // Where the light falls, for the specular highlight.
  function trackPointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        ref={bar}
        onPointerMove={trackPointer}
        className="liquid-glass pointer-events-auto flex items-center gap-1 rounded-full px-2 py-2 shadow-glow"
      >
        {pill && (
          <span
            aria-hidden
            className="nav-pill"
            style={{
              transform: `translateX(${pill.x}px)`,
              width: pill.w,
              transitionDuration: settled ? undefined : "0ms",
            }}
          />
        )}
        {items.map((it, i) => {
          const active = isActive(it.href);
          return (
            <Link
              key={it.href}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`relative z-[2] flex min-w-[60px] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors duration-300 sm:min-w-[72px] sm:px-4 ${
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}
function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21v-4a4 4 0 0 1 4-4h1M3 9a4 4 0 0 1 4-4h1M14 21v-4a4 4 0 0 1 4-4h1M14 9a4 4 0 0 1 4-4h1" />
    </svg>
  );
}
