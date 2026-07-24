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
          <h1 className="text-2xl font-bold text-white">Panel general</h1>
          <p className="text-sm text-gray-400">
            Contabilización automática de las operaciones de Eture Sports.
          </p>
        </div>
        <Link href="/players" className="btn-primary">
          Ir a jugadores
        </Link>
      </div>

      {/* Totales globales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Jugadores totales" value={formatNumber(data.totalPlayers)} />
        <StatCard
          label="Becas acumuladas"
          value={formatUSD(data.totalScholarship)}
          sub="Suma de todas las becas registradas (USD)"
        />
        <StatCard label="Deportes" value={formatNumber(data.sports.length)} />
      </div>

      {/* Filtro por deporte */}
      {data.sports.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/dashboard" active={!selected} label="Todos" />
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

      {/* Detalle por deporte */}
      {shownSports.map((s) => (
        <section key={s.code} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{s.name}</h2>
            <span className="badge bg-ink-700 text-gray-300">{s.code}</span>
            <span className="text-sm text-gray-400">
              {formatNumber(s.totalPlayers)} jugadores ·{" "}
              <span className="text-accent">{formatUSD(s.totalScholarship)}</span> en
              becas
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarList title="Por temporada" buckets={s.bySeason} />
            <BarList title="Por división" buckets={s.byDivision} />
            <BarList title="Por programa" buckets={s.byProgram} />
            <BarList
              title="Top universidades (por becas)"
              buckets={[...s.topUniversities].sort(
                (a, b) => b.scholarship - a.scholarship
              )}
              metric="scholarship"
            />
          </div>
        </section>
      ))}

      {data.totalPlayers === 0 && (
        <div className="card p-8 text-center text-gray-400">
          Aún no hay jugadores. Importa el Excel con el seed o añádelos desde{" "}
          <Link href="/players" className="text-brand underline">
            Jugadores
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
      className={`rounded-full border px-3 py-1 text-sm ${
        active
          ? "border-brand bg-brand/10 text-white"
          : "border-ink-600 text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
