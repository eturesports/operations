import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/guards";
import { formatNumber } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";
import { TableScroller } from "@/components/TableScroller";
import { currentSeasonYear, seasonLabel } from "@/lib/saveStats";
import { isMissingSeasonTable } from "@/lib/seasonStats";

/**
 * What our players have actually done on the pitch in one season.
 *
 * Everything else in this dashboard counts placements — how many players,
 * where, for how much. This counts football: minutes, appearances, goals.
 *
 * The season is the NCAA's, keyed on the calendar year it starts in, which is
 * what both roster platforms use. The app writes that as 26/27 and the NCAA
 * calls it the 2026 season; both are shown, because people arrive here having
 * heard one or the other.
 */
export const dynamic = "force-dynamic";

type Row = {
  playerId: string;
  name: string;
  university: string;
  division: string | null;
  position: string | null;
  profileImageUrl: string | null;
  matchesPlayed: number | null;
  matchesStarted: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  statsUpdatedAt: Date | null;
  prevGoals: number | null;
  prevAssists: number | null;
  prevAt: Date | null;
};

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-ink-600 object-cover" />;
  }
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-bold text-fg">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** "3 days ago" reads better than a date when the question is "recently?". */
function ago(d: Date | null): string {
  if (!d) return "—";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default async function PitchPage({
  searchParams,
}: {
  searchParams: { season?: string };
}) {
  await requireSession();

  const thisYear = currentSeasonYear();
  const asked = parseInt(searchParams.season ?? "", 10);
  const year = Number.isFinite(asked) && asked > 2000 && asked <= thisYear + 1 ? asked : thisYear;

  let rows: Row[] = [];
  let years: number[] = [];
  let tableMissing = false;

  try {
    const [found, seasons] = await Promise.all([
      prisma.profileSeasonStat.findMany({
        where: { year, profile: { player: { active: true } } },
        select: {
          matchesPlayed: true,
          matchesStarted: true,
          minutes: true,
          goals: true,
          assists: true,
          saves: true,
          statsUpdatedAt: true,
          prevGoals: true,
          prevAssists: true,
          prevAt: true,
          profile: {
            select: {
              university: true,
              division: true,
              profileImageUrl: true,
              player: {
                select: { id: true, name: true, position: true, profileImageUrl: true },
              },
            },
          },
        },
      }),
      prisma.profileSeasonStat.groupBy({ by: ["year"], _count: true }),
    ]);
    rows = found.map((r) => ({
      playerId: r.profile.player.id,
      name: r.profile.player.name,
      university: r.profile.university,
      division: r.profile.division,
      position: r.profile.player.position,
      profileImageUrl: r.profile.profileImageUrl ?? r.profile.player.profileImageUrl,
      matchesPlayed: r.matchesPlayed,
      matchesStarted: r.matchesStarted,
      minutes: r.minutes,
      goals: r.goals,
      assists: r.assists,
      saves: r.saves,
      statsUpdatedAt: r.statsUpdatedAt,
      prevGoals: r.prevGoals,
      prevAssists: r.prevAssists,
      prevAt: r.prevAt,
    }));
    years = [...new Set([...seasons.map((s) => s.year), thisYear])].sort((a, b) => b - a);
  } catch (e) {
    if (!isMissingSeasonTable(e)) throw e;
    tableMissing = true;
    years = [thisYear];
  }

  const sum = (pick: (r: Row) => number | null) => rows.reduce((a, r) => a + (pick(r) ?? 0), 0);

  // Scored since the last refresh that moved. A row with no previous reading
  // is not new, it is simply the first time we looked — which is why the feed
  // fills up from the second refresh onward rather than announcing the whole
  // database at once.
  const scored = rows
    .filter((r) => r.prevGoals != null && (r.goals ?? 0) > r.prevGoals)
    .map((r) => ({ ...r, newGoals: (r.goals ?? 0) - (r.prevGoals ?? 0) }))
    .sort((a, b) => (b.statsUpdatedAt?.getTime() ?? 0) - (a.statsUpdatedAt?.getTime() ?? 0));

  const scorers = rows.filter((r) => (r.goals ?? 0) > 0).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0));
  const byMinutes = rows.filter((r) => (r.minutes ?? 0) > 0).sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));

  return (
    <div className="space-y-6">
      <AnalyticsTabs />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl leading-none text-fg">On the pitch</h1>
          <p className="mt-1 text-sm text-muted">
            NCAA {year} season — what the app calls {seasonLabel(year)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-full border border-ink-600 p-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/dashboard/pitch?season=${y}`}
              aria-current={y === year ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                y === year ? "bg-brand text-white" : "text-muted hover:text-fg"
              }`}
            >
              {seasonLabel(y)}
            </Link>
          ))}
        </div>
      </div>

      {tableMissing ? (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-fg">Not switched on yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The season-by-season table has not been created in the database. The migration is
            written and committed; until it is applied there is nowhere for a season to be
            recorded, so this page has nothing to show. Everything else keeps working — the career
            totals on each player are unaffected.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-fg">Nothing recorded for {seasonLabel(year)}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Either the season has not started — NCAA soccer runs from late August — or no stats
            have been pulled yet. A refresh reads each player&rsquo;s roster page and files what it
            finds, one row per season.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Minutes"
              value={formatNumber(sum((r) => r.minutes))}
              sub={`${formatNumber(byMinutes.length)} player${byMinutes.length === 1 ? "" : "s"} on the pitch`}
            />
            <StatCard
              label="Appearances"
              value={formatNumber(sum((r) => r.matchesPlayed))}
              sub={`${formatNumber(sum((r) => r.matchesStarted))} as a starter`}
            />
            <StatCard
              label="Goals"
              value={formatNumber(sum((r) => r.goals))}
              sub={`${formatNumber(scorers.length)} scorer${scorers.length === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Assists"
              value={formatNumber(sum((r) => r.assists))}
              sub={`${formatNumber(sum((r) => r.saves))} saves`}
            />
          </div>

          {/* Goals we noticed, newest first. */}
          <section className="card p-4">
            <h2 className="text-sm font-semibold text-fg">Latest goals</h2>
            <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
              Goals are not published one by one with a date on them — a university reports a
              season to date. So these are the goals that <b className="text-fg">appeared between
              one refresh and the next</b>: a player who went from three to five since the last
              reading scored twice in between. It says which week, not which match.
            </p>
            {scored.length === 0 ? (
              <p className="text-sm text-muted">
                No new goals since the last refresh. A player only appears here once we have read
                them twice, so this fills up from the second refresh onward.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {scored.map((r) => (
                  <li
                    key={`${r.playerId}-${r.university}`}
                    className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800/40 px-3 py-2"
                  >
                    <Avatar url={r.profileImageUrl} name={r.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{r.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {r.university}
                        {r.position ? ` · ${r.position}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="badge bg-emerald-500/15 text-emerald-400">
                        +{r.newGoals} goal{r.newGoals === 1 ? "" : "s"}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted">
                        {r.goals} this season · {ago(r.statsUpdatedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-ink-600 p-4">
              <h2 className="text-sm font-semibold text-fg">Minutes in {seasonLabel(year)}</h2>
              <p className="mt-1 text-[11px] text-muted">
                One row per player per university, so a mid-season transfer appears under each.
              </p>
            </div>
            <TableScroller>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium">University</th>
                    <th className="px-4 py-3 text-right font-medium">Min</th>
                    <th className="px-4 py-3 text-right font-medium">GP</th>
                    <th className="px-4 py-3 text-right font-medium">GS</th>
                    <th className="px-4 py-3 text-right font-medium">G</th>
                    <th className="px-4 py-3 text-right font-medium">A</th>
                    <th className="px-4 py-3 text-right font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {byMinutes.map((r) => (
                    <tr key={`${r.playerId}-${r.university}`} className="border-b border-ink-700/60">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar url={r.profileImageUrl} name={r.name} />
                          <span className="min-w-0">
                            <span className="block truncate text-fg">{r.name}</span>
                            {r.position && (
                              <span className="block text-[11px] text-muted">{r.position}</span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {r.university}
                        {r.division && (
                          <span className="ml-1.5 badge bg-ink-700 text-[10px] text-muted">
                            {r.division}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-fg">
                        {formatNumber(r.minutes ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{r.matchesPlayed ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{r.matchesStarted ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-accent">{r.goals ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{r.assists ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-[11px] text-muted">
                        {ago(r.statsUpdatedAt)}
                      </td>
                    </tr>
                  ))}
                  {byMinutes.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                        Nobody has recorded a minute in {seasonLabel(year)} yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroller>
          </section>

          {scorers.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-fg">
                Scorers in {seasonLabel(year)}
              </h2>
              <ol className="space-y-1.5">
                {scorers.map((r, i) => (
                  <li
                    key={`${r.playerId}-${r.university}`}
                    className="flex items-center gap-3 rounded-xl border border-ink-600 px-3 py-2"
                  >
                    <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted">
                      {i + 1}
                    </span>
                    <Avatar url={r.profileImageUrl} name={r.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{r.name}</span>
                      <span className="block truncate text-[11px] text-muted">{r.university}</span>
                    </span>
                    <span className="shrink-0 font-display text-xl leading-none text-accent">
                      {r.goals}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
