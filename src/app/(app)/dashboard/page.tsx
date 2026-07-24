import Link from "next/link";
import { requireSession } from "@/lib/guards";
import { getDashboardData } from "@/lib/stats";
import { formatNumber, formatUSD } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { BarList } from "@/components/BarList";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { sport?: string };
}) {
  await requireSession();
  const data = await getDashboardData();
  const selected = searchParams.sport;

  const shownSports = selected
    ? data.sports.filter((s) => s.code === selected)
    : data.sports;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg sm:text-3xl">Overview</h1>
          <p className="text-sm text-muted">
            Automatic accounting of Eture Sports operations.
          </p>
        </div>
        <Link href="/players" className="btn-primary">
          Go to players
        </Link>
      </div>

      {/* Global totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total operations" value={formatNumber(data.totalPlayers)} />
        <StatCard
          label="Total scholarships"
          value={formatUSD(data.totalScholarship)}
          sub="Sum of all recorded scholarships (USD)"
        />
        <StatCard label="Sports" value={formatNumber(data.sports.length)} />
      </div>

      {/* Sport filter */}
      {data.sports.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/dashboard" active={!selected} label="All" />
          {data.sports.map((s) => (
            <FilterChip
              key={s.code}
              href={`/dashboard?sport=${s.code}`}
              active={selected === s.code}
              label={`${s.name} (${s.totalPlayers})`}
            />
          ))}
        </div>
      )}

      {/* Per-sport detail */}
      {shownSports.map((s) => (
        <section key={s.code} className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-fg">{s.name}</h2>
            <span className="badge bg-ink-700 text-muted">{s.code}</span>
            <span className="text-sm text-muted">
              {formatNumber(s.totalPlayers)} operations ·{" "}
              <span className="text-accent">{formatUSD(s.totalScholarship)}</span> in
              scholarships
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarList title="By season" buckets={s.bySeason} />
            <BarList title="By division" buckets={s.byDivision} />
            <BarList title="By program" buckets={s.byProgram} />
            <BarList
              title="Top universities (by scholarship)"
              buckets={[...s.topUniversities].sort(
                (a, b) => b.scholarship - a.scholarship
              )}
              metric="scholarship"
            />
          </div>
        </section>
      ))}

      {data.totalPlayers === 0 && (
        <div className="card p-8 text-center text-muted">
          No players yet. Import a CSV or add them from{" "}
          <Link href="/players" className="text-brand underline">
            Players
          </Link>
          .
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? "border-brand bg-brand/10 text-fg"
          : "border-ink-600 text-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
}
