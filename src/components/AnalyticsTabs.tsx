"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackPointer, useTravellingPill } from "./useTravellingPill";

const TABS = [
  { href: "/dashboard", label: "Authority" },
  { href: "/dashboard/active", label: "Active players" },
  { href: "/dashboard/seasons", label: "Seasons" },
  { href: "/dashboard/programs", label: "Programs" },
  { href: "/dashboard/universities", label: "Universities" },
  { href: "/dashboard/segmentation", label: "Segmentation" },
  { href: "/dashboard/claims", label: "Claims" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  const activeIndex = TABS.findIndex((t) => t.href === pathname);
  const { container, items, pill, settled } = useTravellingPill<HTMLDivElement>(activeIndex);

  return (
    <div
      ref={container}
      onPointerMove={trackPointer}
      className="liquid-glass relative flex gap-1 overflow-x-auto rounded-full p-1"
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
      {TABS.map((t, i) => (
        <Link
          key={t.href}
          ref={(el) => {
            items.current[i] = el;
          }}
          href={t.href}
          aria-current={i === activeIndex ? "page" : undefined}
          className={`relative z-[2] whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
            i === activeIndex ? "text-white" : "text-muted hover:text-fg"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
