"use client";

import { useMemo } from "react";
import type { PlayerRow } from "./PlayersClient";
import { formatNumber, formatUSD, formatUSDCompact } from "@/lib/format";
import { canonicalizeUniversity, uniKey } from "@/lib/universities";
import { NCAA_DI_MENS_SOCCER_PROGRAMS, isDivisionOne } from "@/lib/ncaaPrograms";
import { currentSeasonYear, seasonLabel } from "@/lib/saveStats";

// Computed once per render of the module rather than per tile. The season
// only turns over in August, so the page does not need to keep asking.
const SEASON_LABEL = seasonLabel(currentSeasonYear());

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

    // How much of Division I Eture has actually reached. Distinct universities,
    // because ten players at one college is still one programme — and measured
    // against the number of Division I programmes that exist, not against our
    // own operations, so it answers "where could we be" rather than "where are
    // we busiest".
    const diUnis = new Set<string>();
    for (const p of filtered) {
      if (!isDivisionOne(p.division)) continue;
      for (const u of canonicalizeUniversity(p.university)) diUnis.add(uniKey(u));
    }

    const champions = filtered.filter((p) => p.nationalChampion).length;
    const graduated = filtered.filter((p) => p.graduated).length;
    const playing = filtered.filter((p) => p.activeProfile).length;

    const withMoney = filtered.filter((p) => p.scholarship != null);
    const fullRides = filtered.filter((p) => p.fullRide).length;
    const scholarship = withMoney.reduce((a, p) => a + (p.scholarship ?? 0), 0);

    // Every college profile counts, not just the one flagged as playing now:
    // most of these players have finished, and their minutes are still theirs.
    const withStats = filtered.filter((p) => p.career);
    const minutes = withStats.reduce((a, p) => a + (p.career?.minutes ?? 0), 0);
    const goals = withStats.reduce((a, p) => a + (p.career?.goals ?? 0), 0);
    const assists = withStats.reduce((a, p) => a + (p.career?.assists ?? 0), 0);

    // The season being played, which the career totals above cannot answer:
    // a fourth-year's 4,000 minutes say nothing about whether they have been
    // on the pitch since August.
    const inSeason = filtered.filter((p) => p.thisSeason);
    const seasonSum = (pick: (t: NonNullable<PlayerRow["thisSeason"]>) => number) =>
      inSeason.reduce((a, p) => a + (p.thisSeason ? pick(p.thisSeason) : 0), 0);

    const pct = (n: number) => (ops ? Math.round((n / ops) * 1000) / 10 : 0);

    return {
      seasonPlayers: inSeason.length,
      seasonMinutes: seasonSum((t) => t.minutes),
      seasonGoals: seasonSum((t) => t.goals),
      seasonAssists: seasonSum((t) => t.assists),
      seasonMatches: seasonSum((t) => t.matchesPlayed),
      ops,
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
  // With several divisions picked at once, the question is usually "how much
  // of everything is this?" — and every percentage inside the panel is
  // measured against the selection, not against the database.
  const shareOfAll = rows.length
    ? Math.round((filtered.length / rows.length) * 1000) / 10
    : 0;

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
        {/* How much of everything this selection is. The panel does not
            second-guess which subset you care about: filter to Division I and
            this reads the Division I share, filter to a season and it reads
            that season's. */}
        <Tile
          label="Share of database"
          value={`${shareOfAll}%`}
          sub={`${formatNumber(s.ops)} of all ${formatNumber(rows.length)}`}
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

      {/* This season on its own. Hidden until there is a season to report:
          in July there is nothing yet, and a row of zeroes reads as a squad
          that has not played rather than as a season that has not started. */}
      {s.seasonPlayers > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile
            label={`${SEASON_LABEL} · minutes`}
            value={formatNumber(s.seasonMinutes)}
            sub={`${formatNumber(s.seasonPlayers)} player${s.seasonPlayers === 1 ? "" : "s"}`}
            accent="green"
          />
          <Tile label={`${SEASON_LABEL} · matches`} value={formatNumber(s.seasonMatches)} sub="Appearances" />
          <Tile label={`${SEASON_LABEL} · goals`} value={formatNumber(s.seasonGoals)} sub="This season" />
          <Tile label={`${SEASON_LABEL} · assists`} value={formatNumber(s.seasonAssists)} sub="This season" />
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        <b className="text-fg">Division I presence</b> is how many different
        Division I programmes this selection reached, over the{" "}
        {formatNumber(NCAA_DI_MENS_SOCCER_PROGRAMS)} that exist &mdash; not the
        366 Division I institutions, most of which field no men&rsquo;s soccer
        team.{" "}
        <b className="text-fg">Share of database</b> is this selection over all{" "}
        {formatNumber(rows.length)} operations; the other percentages are measured
        against the {formatNumber(s.ops)} in this selection. Scholarship
        totals cover only the
        operations with a recorded amount ({s.coveragePct}%). Minutes, goals and assists are
        career totals across every college profile we have pulled, for the{" "}
        {formatNumber(s.withStats)} operation{s.withStats === 1 ? "" : "s"} with stats —
        not only the players on a roster today.
      </p>
    </section>
  );
}
