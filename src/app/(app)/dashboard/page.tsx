import Link from "next/link";
import { requireSession } from "@/lib/guards";
import { getAuthorityData } from "@/lib/authority";
import { formatNumber, formatUSD } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { BarList } from "@/components/BarList";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";

export const dynamic = "force-dynamic";

function Denominator({
  label,
  pct,
  detail,
}: {
  label: string;
  pct: number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/40 p-4">
      <div className="font-display text-3xl text-fg">{pct}%</div>
      <div className="mt-1 text-sm font-medium text-fg">{label}</div>
      <div className="mt-0.5 text-xs text-muted">{detail}</div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-2xl text-fg">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  await requireSession();
  const a = await getAuthorityData();
  const asOf = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">Authority Dashboard</h1>
      </div>

      <AnalyticsTabs />

      {/* Playing right now — the live picture */}
      <Link
        href="/dashboard/active"
        className="card flex items-center gap-4 p-5 transition-colors hover:border-emerald-500/40"
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted">
            Playing right now
          </div>
          <div className="font-display text-3xl text-fg">
            {formatNumber(a.playingNow)}{" "}
            <span className="text-base font-normal text-muted">
              player{a.playingNow === 1 ? "" : "s"} in college soccer
            </span>
          </div>
          <div className="text-xs text-muted">
            Across {formatNumber(a.playingNowUniversities)} universit
            {a.playingNowUniversities === 1 ? "y" : "ies"} · see who →
          </div>
        </div>
      </Link>

      {/* Volume — row 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Operations" value={formatNumber(a.operations)} sub="Confirmed placements" />
        <StatCard
          label="Unique players"
          value={formatNumber(a.uniquePlayers)}
          sub={`${formatNumber(a.transfers)} transfers (approx.)`}
        />
        <StatCard label="Universities reached" value={formatNumber(a.universities)} sub="Distinct destinations" />
        <StatCard
          label="Editions"
          value={a.seasonFrom && a.seasonTo ? `${a.seasonFrom}–${a.seasonTo}` : "—"}
          sub={`${a.seasonsCount} seasons · ~${formatNumber(a.avgPerSeason)}/yr`}
        />
      </div>

      {/* The Gap Year / Eture FC claim, counted in people. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Domestic DI committed players"
          value={formatNumber(a.domesticD1.players)}
          sub={`Gap Year / Eture FC · ${a.domesticD1.pct}% of the programme's ${formatNumber(
            a.domesticD1.ofProgrammePlayers
          )} players`}
        />
        <StatCard
          label="Their Division I destinations"
          value={formatNumber(a.domesticD1.universities)}
          sub={`${formatNumber(a.domesticD1.operations)} commitments`}
        />
      </div>

      {/* Level — D1 with explicit denominators */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-fg">Level · NCAA Division I</h2>
        <p className="text-xs text-muted">
          Three D1 rates with different denominators — all correct, all different. Always state the denominator.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Denominator
            label="D1 over all operations"
            pct={a.d1.d1OverTotalPct}
            detail={`${formatNumber(a.d1.d1Ops)} of ${formatNumber(a.operations)} operations`}
          />
          <Denominator
            label="D1 within NCAA"
            pct={a.d1.d1WithinNcaaPct}
            detail={`${formatNumber(a.d1.d1Ops)} of ${formatNumber(a.d1.ncaaOps)} NCAA operations`}
          />
          <Denominator
            label="Players who reached D1"
            pct={a.d1.playersReachedD1Pct}
            detail={`${formatNumber(a.d1.playersReachedD1)} of ${formatNumber(a.uniquePlayers)} unique players`}
          />
        </div>
      </section>

      {/* Value — scholarships (coverage-aware) */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-fg">Value · Scholarships</h2>
        <div className="card grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
          <Metric label="Total (verified rows)" value={formatUSD(a.scholarship.total)} />
          <Metric label="Median" value={a.scholarship.median != null ? formatUSD(a.scholarship.median) : "—"} sub="Typical player" />
          <Metric label="Average" value={a.scholarship.average != null ? formatUSD(a.scholarship.average) : "—"} />
          <Metric
            label="Coverage"
            value={`${a.scholarship.coveragePct}%`}
            sub={`${formatNumber(a.scholarship.withData)} of ${formatNumber(a.operations)} have amount`}
          />
        </div>
      </section>

      {/* Breakdowns */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-fg">Distribution</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BarList title="By season" buckets={a.bySeason} />
          <BarList title="By division" buckets={a.byDivision} />
          <BarList title="By program" buckets={a.byProgram} />
          <BarList
            title="Top universities (by scholarship)"
            buckets={[...a.topUniversities].sort((x, y) => y.scholarship - x.scholarship)}
            metric="scholarship"
          />
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        <b className="text-fg">Definitions.</b> A row is an <i>operation</i> (a confirmed placement), not
        necessarily a unique player; unique players are counted by de-duplicated name. Transfers are
        operations beyond a player&apos;s first (approximate). University counts are distinct raw entries and
        still pending full normalization (e.g. OSU / Oregon St. / Oregon State). Scholarship figures cover{" "}
        {a.scholarship.coveragePct}% of operations that have a recorded amount. Data as of {asOf}.
      </p>
    </div>
  );
}
