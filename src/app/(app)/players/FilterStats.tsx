"use client";

import { useMemo } from "react";
import type { PlayerRow } from "./PlayersClient";
import { formatNumber, formatUSD, formatUSDCompact } from "@/lib/format";
import { canonicalizeUniversity, uniKey } from "@/lib/universities";

// Everything here is computed from the rows currently on screen, so applying a
// filter re-reads the whole picture for that selection rather than the database.

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "brand" | "accent" | "green";
}) {
  const tone =
    accent === "accent"
      ? "text-accent"
      : accent === "green"
        ? "text-emerald-400"
        : "text-fg";
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-xl leading-tight ${tone}`}>{value}</div>
      {sub && <div className="text-[10px] leading-tight text-muted">{sub}</div>}
    </div>
  );
}

export function FilterStats({
  rows,
  filtered,
}: {
  rows: PlayerRow[]; // the full set, for context
  filtered: PlayerRow[]; // what the filters left
}) {
  const s = useMemo(() => {
    const ops = filtered.length;
    const players = new Set(filtered.map((p) => p.name.trim().toLowerCase())).size;

    const unis = new Set<string>();
    for (const p of filtered)
      for (const u of canonicalizeUniversity(p.university)) unis.add(uniKey(u));

    const d1 = filtered.filter(
      (p) => (p.division ?? "").trim().toLowerCase() === "division i"
    ).length;
    const champions = filtered.filter((p) => p.nationalChampion).length;
    const graduated = filtered.filter((p) => p.graduated).length;
    const playing = filtered.filter((p) => p.activeProfile).length;

    const withMoney = filtered.filter((p) => p.scholarship != null);
    const scholarship = withMoney.reduce((a, p) => a + (p.scholarship ?? 0), 0);

    const minutes = filtered.reduce((a, p) => a + (p.activeProfile?.minutes ?? 0), 0);
    const goals = filtered.reduce((a, p) => a + (p.activeProfile?.goals ?? 0), 0);
    const assists = filtered.reduce((a, p) => a + (p.activeProfile?.assists ?? 0), 0);

    const pct = (n: number) => (ops ? Math.round((n / ops) * 1000) / 10 : 0);

    return {
      ops,
      players,
      universities: unis.size,
      d1,
      d1Pct: pct(d1),
      champions,
      championsPct: pct(champions),
      graduated,
      graduatedPct: pct(graduated),
      playing,
      scholarship,
      coveragePct: pct(withMoney.length),
      minutes,
      goals,
      assists,
    };
  }, [filtered]);

  const narrowed = filtered.length !== rows.length;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">
          {narrowed ? "This selection" : "All players"}
        </h2>
        {narrowed && (
          <span className="text-[11px] text-muted">
            {formatNumber(s.ops)} of {formatNumber(rows.length)} operations
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          label="Players"
          value={formatNumber(s.players)}
          sub={`${formatNumber(s.ops)} operation${s.ops === 1 ? "" : "s"}`}
        />
        <Tile
          label="Universities"
          value={formatNumber(s.universities)}
          sub="Distinct destinations"
        />
        <Tile
          label="Division I"
          value={`${s.d1Pct}%`}
          sub={`${formatNumber(s.d1)} of ${formatNumber(s.ops)}`}
        />
        <Tile
          label="National champions"
          value={`${s.championsPct}%`}
          sub={
            s.champions === 0
              ? "None marked yet"
              : `${formatNumber(s.champions)} player${s.champions === 1 ? "" : "s"}`
          }
        />
        <Tile
          label="Scholarships"
          value={formatUSDCompact(s.scholarship)}
          sub={`${s.coveragePct}% have an amount`}
          accent="accent"
        />
        <Tile
          label="Graduated"
          value={`${s.graduatedPct}%`}
          sub={`${formatNumber(s.graduated)} player${s.graduated === 1 ? "" : "s"}`}
        />
        <Tile
          label="Playing now"
          value={formatNumber(s.playing)}
          sub="On a roster"
          accent="green"
        />
        <Tile
          label="Minutes"
          value={formatNumber(s.minutes)}
          sub="Current rosters"
        />
        <Tile label="Goals" value={formatNumber(s.goals)} sub="Current rosters" />
        <Tile label="Assists" value={formatNumber(s.assists)} sub="Current rosters" />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Percentages are measured against the {formatNumber(s.ops)} operation
        {s.ops === 1 ? "" : "s"} in this selection. Scholarship totals cover only the
        operations with a recorded amount ({s.coveragePct}%). Minutes, goals and assists
        come from players marked as playing now, so they reflect live rosters rather than
        career history.
      </p>
    </section>
  );
}
