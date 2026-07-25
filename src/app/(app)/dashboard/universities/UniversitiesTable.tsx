"use client";

import { useMemo, useState } from "react";
import type { UniversityStat } from "@/lib/analytics";
import { formatUSD, seasonSortKey } from "@/lib/format";

const TIER_STYLE: Record<string, string> = {
  "Elite partner": "bg-brand/20 text-brand",
  "Strong partner": "bg-accent/20 text-accent",
  "Active partner": "bg-green-500/15 text-green-300",
  Emerging: "bg-ink-700 text-muted",
};

type SortKey =
  | "name"
  | "operations"
  | "uniquePlayers"
  | "seasons"
  | "lastSeason"
  | "scholarshipTotal"
  | "score";

const COLUMNS: {
  key: SortKey;
  label: string;
  align: "left" | "right";
  numeric: boolean;
}[] = [
  { key: "name", label: "University", align: "left", numeric: false },
  { key: "operations", label: "Ops", align: "right", numeric: true },
  { key: "uniquePlayers", label: "Players", align: "right", numeric: true },
  { key: "seasons", label: "Seasons", align: "right", numeric: true },
  { key: "lastSeason", label: "Last", align: "left", numeric: true },
  { key: "scholarshipTotal", label: "Scholarships", align: "right", numeric: true },
  { key: "score", label: "Tier", align: "left", numeric: true },
];

const PAGE = 50;

export function UniversitiesTable({ universities }: { universities: UniversityStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("operations");
  const [asc, setAsc] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      // numbers read best high-to-low first; names A→Z
      setAsc(key === "name");
    }
  }

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? universities.filter((u) => u.name.toLowerCase().includes(needle))
      : [...universities];

    const value = (u: UniversityStat): string | number => {
      switch (sortKey) {
        case "name":
          return u.name.toLowerCase();
        case "lastSeason":
          return seasonSortKey(u.lastSeason);
        default:
          return u[sortKey];
      }
    };

    rows.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      let cmp: number;
      if (typeof va === "string" || typeof vb === "string") {
        cmp = String(va).localeCompare(String(vb));
      } else {
        cmp = va - vb;
      }
      // stable, meaningful tie-break so equal values don't shuffle
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return asc ? cmp : -cmp;
    });
    return rows;
  }, [universities, sortKey, asc, q]);

  const visible = showAll ? sorted : sorted.slice(0, PAGE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search university…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-muted">
          Showing {visible.length} of {sorted.length}
          {q ? " matching" : ""} · sorted by{" "}
          {COLUMNS.find((c) => c.key === sortKey)?.label} {asc ? "↑" : "↓"}
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                {COLUMNS.map((c) => {
                  const active = sortKey === c.key;
                  return (
                    <th
                      key={c.key}
                      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
                      className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}
                    >
                      <button
                        onClick={() => toggle(c.key)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-fg ${
                          active ? "text-fg" : ""
                        }`}
                        title={`Sort by ${c.label}`}
                      >
                        {c.label}
                        <span className={active ? "text-brand" : "opacity-30"}>
                          {active ? (asc ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((u, i) => (
                <tr key={u.name} className="border-b border-ink-700/60 hover:bg-ink-800/40">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-fg">{u.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg">{u.operations}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{u.uniquePlayers}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{u.seasons}</td>
                  <td className="px-4 py-3 text-muted">{u.lastSeason ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">
                    {u.scholarshipTotal > 0 ? formatUSD(u.scholarshipTotal) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${TIER_STYLE[u.tier] ?? "bg-ink-700 text-muted"}`}>
                      {u.tier}
                    </span>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                    No universities match “{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sorted.length > PAGE && (
        <button onClick={() => setShowAll((v) => !v)} className="btn-ghost px-3 py-1.5 text-xs">
          {showAll ? `Show top ${PAGE}` : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
