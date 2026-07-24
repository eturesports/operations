import { requireSession } from "@/lib/guards";
import { getSegmentationData, type SegmentRow } from "@/lib/analytics";
import { formatNumber, formatUSD } from "@/lib/format";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";

export const dynamic = "force-dynamic";

function SegTable({
  title,
  rows,
  coverage,
  labelHead,
}: {
  title: string;
  rows: SegmentRow[];
  coverage: number;
  labelHead: string;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-600 px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <span className="text-xs text-muted">{coverage}% coverage</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">{labelHead}</th>
              <th className="px-4 py-2 text-right font-medium">Ops</th>
              <th className="px-4 py-2 text-right font-medium">Players</th>
              <th className="px-4 py-2 text-right font-medium">D1 %</th>
              <th className="px-4 py-2 text-right font-medium">Median schol.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-ink-700/60">
                <td className="px-4 py-2 font-medium text-fg">{r.key}</td>
                <td className="px-4 py-2 text-right tabular-nums text-fg">{r.operations}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted">{r.uniquePlayers}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted">{r.d1Pct}%</td>
                <td className="px-4 py-2 text-right tabular-nums text-accent">
                  {r.scholarshipMedian != null ? formatUSD(r.scholarshipMedian) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No data yet — add {labelHead.toLowerCase()} to players to see this.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function SegmentationPage() {
  await requireSession();
  const seg = await getSegmentationData();

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">Segmentation</h1>
        <p className="text-sm text-muted">
          Which profiles reach which level. Add position, nationality and previous club to
          players to enrich this.
        </p>
      </div>

      <AnalyticsTabs />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SegTable
          title="By position"
          labelHead="Position"
          rows={seg.byPosition}
          coverage={seg.positionCoverage}
        />
        <SegTable
          title="By nationality"
          labelHead="Nationality"
          rows={seg.byNationality}
          coverage={seg.nationalityCoverage}
        />
      </div>

      <p className="text-xs leading-relaxed text-muted">
        Ops = operations; a row is a placement, not necessarily a unique player. D1 % and median
        scholarship are computed within each segment. Coverage shows the share of operations that
        have the field filled in — use bulk edit or CSV import to raise it.
      </p>
    </div>
  );
}
