import { requireSession } from "@/lib/guards";
import { getSeasonBreakdown, type SeasonStat } from "@/lib/analytics";
import { formatNumber, formatUSD, formatUSDCompact } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";

export const dynamic = "force-dynamic";

function Growth({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted">—</span>;
  const up = pct > 0;
  const flat = pct === 0;
  return (
    <span
      className={flat ? "text-muted" : up ? "text-emerald-400" : "text-red-400"}
    >
      {flat ? "=" : up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// Compact stacked bar showing the program mix within a season.
function ProgramMix({ s }: { s: SeasonStat }) {
  const colors = ["bg-brand", "bg-accent", "bg-sky-500", "bg-ink-600"];
  return (
    <div className="min-w-[7rem]">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-700">
        {s.programs.map((p, i) => (
          <div
            key={p.program}
            className={colors[i % colors.length]}
            style={{ width: `${(p.ops / s.operations) * 100}%` }}
            title={`${p.program}: ${p.ops}`}
          />
        ))}
      </div>
      <div className="mt-1 truncate text-[10px] text-muted">
        {s.programs.map((p) => `${p.program} ${p.ops}`).join(" · ")}
      </div>
    </div>
  );
}

export default async function SeasonsPage() {
  await requireSession();
  const { seasons, totals } = await getSeasonBreakdown();

  const best = [...seasons].sort((a, b) => b.operations - a.operations)[0] ?? null;
  const latest = seasons[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">Season by season</h1>
        <p className="text-sm text-muted">
          Every metric for each campaign, newest first. Growth compares each season with
          the one before it.
        </p>
      </div>

      <AnalyticsTabs />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Seasons tracked" value={formatNumber(seasons.length)} />
        <StatCard
          label="Latest season"
          value={latest?.season ?? "—"}
          sub={latest ? `${formatNumber(latest.operations)} operations` : undefined}
        />
        <StatCard
          label="Best season"
          value={best?.season ?? "—"}
          sub={best ? `${formatNumber(best.operations)} operations` : undefined}
        />
        <StatCard
          label="Total scholarships"
          value={formatUSDCompact(totals.scholarshipTotal)}
          sub={`${formatNumber(totals.operations)} operations`}
        />
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Season</th>
                <th className="px-4 py-3 text-right font-medium">Ops</th>
                <th className="px-4 py-3 text-right font-medium">Growth</th>
                <th className="px-4 py-3 text-right font-medium">Players</th>
                <th className="px-4 py-3 text-right font-medium">Universities</th>
                <th className="px-4 py-3 text-right font-medium">NCAA</th>
                <th className="px-4 py-3 text-right font-medium">D1</th>
                <th className="px-4 py-3 text-right font-medium">D1 %</th>
                <th className="px-4 py-3 text-right font-medium">Scholarships</th>
                <th className="px-4 py-3 text-right font-medium">Median</th>
                <th className="px-4 py-3 font-medium">Program mix</th>
                <th className="px-4 py-3 font-medium">Top destination</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s.season} className="border-b border-ink-700/60 hover:bg-ink-800/40">
                  <td className="px-4 py-3 font-display text-base text-fg">{s.season}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-fg">
                    {s.operations}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <Growth pct={s.growthPct} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {s.uniquePlayers}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {s.universities}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{s.ncaaOps}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg">{s.d1Ops}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{s.d1Pct}%</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">
                    {s.scholarshipTotal > 0 ? formatUSD(s.scholarshipTotal) : "—"}
                    {s.scholarshipCoveragePct < 100 && s.scholarshipTotal > 0 && (
                      <div className="text-[10px] font-normal text-muted">
                        {s.scholarshipCoveragePct}% covered
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {s.scholarshipMedian != null ? formatUSD(s.scholarshipMedian) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ProgramMix s={s} />
                  </td>
                  <td className="px-4 py-3 text-muted">{s.topUniversity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-ink-600 bg-ink-900/40 text-sm font-medium">
              <tr>
                <td className="px-4 py-3 text-fg">All time</td>
                <td className="px-4 py-3 text-right tabular-nums text-fg">
                  {totals.operations}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {totals.uniquePlayers}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">
                  {totals.universities}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums text-fg">{totals.d1Ops}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums text-accent">
                  {formatUSD(totals.scholarshipTotal)}
                </td>
                <td className="px-4 py-3" colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        A row is an <i>operation</i> (a confirmed placement), so a player who transfers
        appears in more than one season. <b className="text-fg">Players</b> counts unique
        names within that season and <b className="text-fg">Universities</b> counts distinct
        normalized destinations. D1 % is measured against that season&apos;s operations, and
        scholarship totals only cover the operations with a recorded amount — the coverage
        figure under each total says how many.
      </p>
    </div>
  );
}
