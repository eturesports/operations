"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/Select";
import { canonicalizeUniversity, preferDisplay, uniKey } from "@/lib/universities";
import { formatNumber, formatUSD, seasonSortKey } from "@/lib/format";

// One operation as the ranking needs to see it. The table aggregates in the
// browser rather than asking the server for a new ranking per filter: the
// whole database is a few hundred rows, and a filter that answers instantly
// is the difference between a report and a tool you actually explore with.
export type OperationRow = {
  player: string;
  university: string | null;
  season: string | null;
  division: string | null;
  program: string | null;
  scholarship: number | null;
};

type Ranked = {
  name: string;
  operations: number;
  uniquePlayers: number;
  seasons: number;
  lastSeason: string | null;
  lastSeasonKey: number;
  scholarshipTotal: number;
  scholarshipAvg: number | null;
  funded: number;
  score: number;
  tier: string;
};

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
  | "scholarshipAvg"
  | "score";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "University", align: "left" },
  { key: "operations", label: "Signed", align: "right" },
  { key: "uniquePlayers", label: "Players", align: "right" },
  { key: "seasons", label: "Seasons", align: "right" },
  { key: "lastSeason", label: "Last", align: "left" },
  { key: "scholarshipTotal", label: "Scholarships", align: "right" },
  { key: "scholarshipAvg", label: "Average", align: "right" },
  { key: "score", label: "Tier", align: "left" },
];

const PAGE = 50;
const norm = (s: string) => s.trim().toLowerCase();

const distinct = (values: (string | null)[]) => {
  const seen = new Map<string, string>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (!s) continue;
    if (!seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
};

export function UniversitiesTable({ rows }: { rows: OperationRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("operations");
  const [asc, setAsc] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");

  const [season, setSeason] = useState("All seasons");
  const [division, setDivision] = useState("All divisions");
  const [program, setProgram] = useState("All programs");
  const [fundedOnly, setFundedOnly] = useState(false);

  const seasons = useMemo(
    () =>
      distinct(rows.map((r) => r.season)).sort(
        (a, b) => seasonSortKey(b) - seasonSortKey(a)
      ),
    [rows]
  );
  const divisions = useMemo(() => distinct(rows.map((r) => r.division)), [rows]);
  const programs = useMemo(() => distinct(rows.map((r) => r.program)), [rows]);

  const selected = useMemo(
    () =>
      rows.filter((r) => {
        if (season !== "All seasons" && r.season !== season) return false;
        if (division !== "All divisions" && r.division !== division) return false;
        if (program !== "All programs" && r.program !== program) return false;
        if (fundedOnly && r.scholarship == null) return false;
        return true;
      }),
    [rows, season, division, program, fundedOnly]
  );

  // The ranking itself, recomputed for whatever the filters left standing.
  const ranked = useMemo(() => {
    type Agg = {
      name: string;
      ops: number;
      players: Set<string>;
      seasons: Set<string>;
      lastSeasonKey: number;
      scholarship: number;
      funded: number;
    };
    const map = new Map<string, Agg>();

    for (const r of selected) {
      // A record naming two universities counts for both, but its money is
      // attributed once, to the first — otherwise the total would inflate.
      canonicalizeUniversity(r.university).forEach((name, idx) => {
        const k = uniKey(name);
        const a =
          map.get(k) ??
          {
            name,
            ops: 0,
            players: new Set<string>(),
            seasons: new Set<string>(),
            lastSeasonKey: -1,
            scholarship: 0,
            funded: 0,
          };
        a.name = preferDisplay(a.name, name);
        a.ops += 1;
        a.players.add(norm(r.player));
        if (r.season) a.seasons.add(r.season.trim());
        a.lastSeasonKey = Math.max(a.lastSeasonKey, seasonSortKey(r.season));
        if (idx === 0 && r.scholarship != null) {
          a.scholarship += r.scholarship;
          a.funded += 1;
        }
        map.set(k, a);
      });
    }

    const latest = Math.max(0, ...[...map.values()].map((a) => a.lastSeasonKey));

    return [...map.values()].map<Ranked>((a) => {
      const avg = a.funded ? Math.round(a.scholarship / a.funded) : null;
      const recency = latest > 0 ? Math.max(0, 1 - (latest - a.lastSeasonKey) / 6) : 0;
      const score = Math.round(
        45 * Math.min(a.ops / 8, 1) +
          25 * Math.min(a.seasons.size / 5, 1) +
          15 * recency +
          15 * Math.min((avg ?? 0) / 150000, 1)
      );
      return {
        name: a.name,
        operations: a.ops,
        uniquePlayers: a.players.size,
        seasons: a.seasons.size,
        lastSeasonKey: a.lastSeasonKey,
        lastSeason:
          a.lastSeasonKey >= 0
            ? `${a.lastSeasonKey}/${String((a.lastSeasonKey + 1) % 100).padStart(2, "0")}`
            : null,
        scholarshipTotal: a.scholarship,
        scholarshipAvg: avg,
        funded: a.funded,
        score,
        tier:
          score >= 75
            ? "Elite partner"
            : score >= 55
              ? "Strong partner"
              : score >= 35
                ? "Active partner"
                : "Emerging",
      };
    });
  }, [selected]);

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? ranked.filter((u) => u.name.toLowerCase().includes(needle))
      : [...ranked];

    const value = (u: Ranked): string | number => {
      switch (sortKey) {
        case "name":
          return u.name.toLowerCase();
        case "lastSeason":
          return u.lastSeasonKey;
        case "scholarshipAvg":
          return u.scholarshipAvg ?? -1;
        default:
          return u[sortKey];
      }
    };

    list.sort((a, b) => {
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
    return list;
  }, [ranked, sortKey, asc, q]);

  const totals = useMemo(
    () => ({
      universities: ranked.length,
      operations: selected.length,
      scholarship: ranked.reduce((a, u) => a + u.scholarshipTotal, 0),
      funded: ranked.reduce((a, u) => a + u.funded, 0),
    }),
    [ranked, selected]
  );

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      // numbers read best high-to-low first; names A→Z
      setAsc(key === "name");
    }
  }

  const visible = showAll ? sorted : sorted.slice(0, PAGE);
  const narrowed =
    season !== "All seasons" ||
    division !== "All divisions" ||
    program !== "All programs" ||
    fundedOnly;

  return (
    <div className="space-y-4">
      {/* Filters sit above the panels below, whose backdrop-filter would
          otherwise paint over an open dropdown. */}
      <div className="card relative z-30 space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="input"
            placeholder="Search university…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            value={season}
            options={["All seasons", ...seasons]}
            onChange={setSeason}
            ariaLabel="Filter by season"
          />
          <Select
            value={division}
            options={["All divisions", ...divisions]}
            onChange={setDivision}
            ariaLabel="Filter by division"
          />
          <Select
            value={program}
            options={["All programs", ...programs]}
            onChange={setProgram}
            ariaLabel="Filter by program"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFundedOnly((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              fundedOnly ? "bg-brand text-white" : "btn-ghost"
            }`}
          >
            With scholarship recorded
          </button>
          {(narrowed || q) && (
            <button
              type="button"
              onClick={() => {
                setSeason("All seasons");
                setDivision("All divisions");
                setProgram("All programs");
                setFundedOnly(false);
                setQ("");
              }}
              className="text-xs text-muted underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Headline figures for the current selection */}
      <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <div>
          <div className="font-display text-2xl text-fg">{formatNumber(totals.universities)}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Universities</div>
        </div>
        <div>
          <div className="font-display text-2xl text-fg">{formatNumber(totals.operations)}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Signings</div>
        </div>
        <div>
          <div className="font-display text-2xl text-accent">{formatUSD(totals.scholarship)}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">
            Scholarships · {formatNumber(totals.funded)} recorded
          </div>
        </div>
        <div>
          <div className="font-display text-2xl text-fg">
            {totals.funded ? formatUSD(Math.round(totals.scholarship / totals.funded)) : "—"}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted">Average per signing</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {u.scholarshipAvg != null ? formatUSD(u.scholarshipAvg) : "—"}
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
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                    No universities match this selection.
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
