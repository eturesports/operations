"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Authority" },
  { href: "/dashboard/programs", label: "Programs" },
  { href: "/dashboard/universities", label: "Universities" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto rounded-full border border-ink-600 bg-ink-900/40 p-1">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-brand text-white" : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
