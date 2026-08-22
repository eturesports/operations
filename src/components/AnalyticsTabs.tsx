"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPointer, useTravellingPill } from "./useTravellingPill";

const TABS = [
  { href: "/dashboard", label: "Authority" },
  { href: "/dashboard/active", label: "Active players" },
  { href: "/dashboard/pitch", label: "On the pitch" },
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

  // Eight tabs do not fit a phone, so the one you are on has to be brought
  // into view — otherwise the bar looks like it starts at "Authority" no
  // matter which page you opened.
  useEffect(() => {
    const el = items.current[activeIndex];
    const box = container.current;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({
      left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [activeIndex, container, items]);

  return (
    <div
      ref={container}
      onPointerMove={trackPointer}
      className="liquid-glass no-scrollbar scroll-x relative flex gap-1 rounded-full p-1"
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
