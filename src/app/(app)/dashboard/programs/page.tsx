import { requireSession } from "@/lib/guards";
import { getProgramStats } from "@/lib/analytics";
import { formatNumber, formatUSD } from "@/lib/format";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";

export const dynamic = "force-dynamic";

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-2xl text-fg">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default async function ProgramsPage() {
  await requireSession();
  const programs = await getProgramStats();

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">Program Performance</h1>
        <p className="text-sm text-muted">
          Compare Eture programs by volume, level and value.
        </p>
      </div>

      <AnalyticsTabs />

      <div className="space-y-4">
        {programs.map((p) => (
          <section key={p.program} className="card p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-fg">{p.program}</h2>
              <span className="badge bg-brand/15 text-brand">
                {p.d1Pct}% D1
              </span>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
              <Metric label="Operations" value={formatNumber(p.operations)} />
              <Metric label="Unique players" value={formatNumber(p.uniquePlayers)} />
              <Metric label="D1 operations" value={formatNumber(p.d1Ops)} sub={`${p.d1Pct}%`} />
              <Metric label="Scholarships" value={formatUSD(p.scholarshipTotal)} />
              <Metric
                label="Median"
                value={p.scholarshipMedian != null ? formatUSD(p.scholarshipMedian) : "—"}
              />
              <Metric label="Coverage" value={`${p.coveragePct}%`} />
            </div>
            {p.topUniversities.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[10px] uppercase tracking-wide text-muted">
                  Top destinations
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.topUniversities.map((u) => (
                    <span
                      key={u.name}
                      className="rounded-full border border-ink-600 bg-ink-800/60 px-3 py-1 text-sm text-fg"
                    >
                      {u.name} <span className="text-muted">· {u.ops}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
        {programs.length === 0 && (
          <div className="card p-8 text-center text-muted">No program data yet.</div>
        )}
      </div>
    </div>
  );
}
