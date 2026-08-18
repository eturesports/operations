"use client";

import { useMemo } from "react";
import type { PlayerRow } from "./PlayersClient";
import { formatNumber, formatUSD, formatUSDCompact } from "@/lib/format";
import { canonicalizeUniversity, uniKey } from "@/lib/universities";
import { NCAA_DI_MENS_SOCCER_PROGRAMS, isDivisionOne } from "@/lib/ncaaPrograms";

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
    // Every figure on this panel except "playing now" is a claim about what
    // Eture did, so a stint the player arranged for himself is left out of it.
    // The row stays on the list below — it is part of his career — but adding
    // it here would credit us with a move we did not make.
    const ours = filtered.filter((p) => p.byEture);
    const external = filtered.length - ours.length;

    const ops = ours.length;
    const players = new Set(ours.map((p) => p.name.trim().toLowerCase())).size;

    const unis = new Set<string>();
    for (const p of ours)
      for (const u of canonicalizeUniversity(p.university)) unis.add(uniKey(u));

    // How much of Division I Eture has actually reached. Distinct universities,
    // because ten players at one college is still one programme — and measured
    // against the number of Division I programmes that exist, not against our
    // own operations, so it answers "where could we be" rather than "where are
    // we busiest".
    const diUnis = new Set<string>();
    for (const p of ours) {
      if (!isDivisionOne(p.division)) continue;
      for (const u of canonicalizeUniversity(p.university)) diUnis.add(uniKey(u));
    }

    const champions = ours.filter((p) => p.nationalChampion).length;
    const graduated = ours.filter((p) => p.graduated).length;
    // The exception, and deliberately over every row: where our players are
    // right now is true of them whoever arranged the move. A player who
    // transferred himself is only ever "playing now" on that record, so
    // counting our own rows here would lose him entirely.
    const playing = filtered.filter((p) => p.activeProfile).length;

    const withMoney = ours.filter((p) => p.scholarship != null);
    const fullRides = ours.filter((p) => p.fullRide).length;
    const scholarship = withMoney.reduce((a, p) => a + (p.scholarship ?? 0), 0);

    // Every college profile counts, not just the one flagged as playing now:
    // most of these players have finished, and their minutes are still theirs.
    const withStats = ours.filter((p) => p.career);
    const minutes = withStats.reduce((a, p) => a + (p.career?.minutes ?? 0), 0);
    const goals = withStats.reduce((a, p) => a + (p.career?.goals ?? 0), 0);
    const assists = withStats.reduce((a, p) => a + (p.career?.assists ?? 0), 0);

    const pct = (n: number) => (ops ? Math.round((n / ops) * 1000) / 10 : 0);

    return {
      ops,
      external,
      players,
      universities: unis.size,
      diUniversities: diUnis.size,
      diPresencePct:
        Math.round((diUnis.size / NCAA_DI_MENS_SOCCER_PROGRAMS) * 1000) / 10,
      champions,
      championsPct: pct(champions),
      graduated,
      graduatedPct: pct(graduated),
      playing,
      scholarship,
      coveragePct: pct(withMoney.length),
      fullRides,
      minutes,
      goals,
      assists,
      withStats: withStats.length,
    };
  }, [filtered]);

  const narrowed = filtered.length !== rows.length;
  // Both sides of the share are operations of ours, so the tile compares like
  // with like — the numerator already excludes self-arranged transfers.
  const allOps = useMemo(() => rows.filter((p) => p.byEture).length, [rows]);
  // With several divisions picked at once, the question is usually "how much
  // of everything is this?" — and every percentage inside the panel is
  // measured against the selection, not against the database.
  const shareOfAll = allOps ? Math.round((s.ops / allOps) * 1000) / 10 : 0;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">
          {narrowed ? "This selection" : "All players"}
        </h2>
        {narrowed && (
          <span className="text-[11px] text-muted">
            {formatNumber(s.ops)} of {formatNumber(allOps)} operations
          </span>
        )}
      </div>

      {/* Say what was left out rather than quietly shrinking the numbers: a
          panel that drops rows without a word reads as if it counted them. */}
      {s.external > 0 && (
        <p className="mb-3 text-[11px] text-muted">
          Not counted here: {formatNumber(s.external)} transfer
          {s.external === 1 ? "" : "s"} arranged without Eture. Still on the
          list below, and still counted under “Playing now”.
        </p>
      )}

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
        {/* How much of everything this selection is. The panel does not
            second-guess which subset you care about: filter to Division I and
            this reads the Division I share, filter to a season and it reads
            that season's. */}
        <Tile
          label="Share of database"
          value={`${shareOfAll}%`}
          sub={`${formatNumber(s.ops)} of all ${formatNumber(allOps)}`}
        />
        {/* Reach, not volume: the share of Division I programmes that have had
            an Eture player, for whatever the filters are showing. */}
        <Tile
          label="Division I presence"
          value={`${s.diPresencePct}%`}
          sub={`${formatNumber(s.diUniversities)} of ${formatNumber(
            NCAA_DI_MENS_SOCCER_PROGRAMS
          )} DI programmes`}
          accent="green"
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
          sub={
            s.fullRides > 0
              ? `${formatNumber(s.fullRides)} full ride${s.fullRides === 1 ? "" : "s"} · ${
                  s.coveragePct
                }% have an amount`
              : `${s.coveragePct}% have an amount`
          }
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
          sub={`${formatNumber(s.withStats)} with stats`}
        />
        <Tile label="Goals" value={formatNumber(s.goals)} sub="Career totals" />
        <Tile label="Assists" value={formatNumber(s.assists)} sub="Career totals" />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        <b className="text-fg">Division I presence</b> is how many different
        Division I programmes this selection reached, over the{" "}
        {formatNumber(NCAA_DI_MENS_SOCCER_PROGRAMS)} that exist &mdash; not the
        366 Division I institutions, most of which field no men&rsquo;s soccer
        team.{" "}
        <b className="text-fg">Share of database</b> is this selection over all{" "}
        {formatNumber(allOps)} operations; the other percentages are measured
        against the {formatNumber(s.ops)} in this selection. Every figure here
        counts operations Eture arranged: a college a player transferred to on
        his own stays on his record and on the Active players dashboard, but
        none of these numbers include it. Scholarship totals cover only the
        operations with a recorded amount ({s.coveragePct}%). Minutes, goals and assists are
        career totals across every college profile we have pulled, for the{" "}
        {formatNumber(s.withStats)} operation{s.withStats === 1 ? "" : "s"} with stats —
        not only the players on a roster today.
      </p>
    </section>
  );
}
