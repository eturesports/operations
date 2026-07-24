import { requireSession } from "@/lib/guards";
import { getUniversityNetwork } from "@/lib/analytics";
import { formatNumber, formatUSD } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";

export const dynamic = "force-dynamic";

const TIER_STYLE: Record<string, string> = {
  "Elite partner": "bg-brand/20 text-brand",
  "Strong partner": "bg-accent/20 text-accent",
  "Active partner": "bg-green-500/15 text-green-300",
  Emerging: "bg-ink-700 text-muted",
};

export default async function UniversitiesPage() {
  await requireSession();
  const net = await getUniversityNetwork();
  const top = net.universities.slice(0, 50);

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">University Network</h1>
        <p className="text-sm text-muted">
          Destinations ranked by relationship strength. Names are normalized (best-effort).
        </p>
      </div>

      <AnalyticsTabs />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Universities (normalized)" value={formatNumber(net.totalUniversities)} />
        <StatCard label="Recurring partners" value={formatNumber(net.partners)} sub="3+ operations" />
        <StatCard label="Avg operations / university" value={String(net.avgOpsPerUniversity)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-600 bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">University</th>
                <th className="px-4 py-3 text-right font-medium">Ops</th>
                <th className="px-4 py-3 text-right font-medium">Players</th>
                <th className="px-4 py-3 text-right font-medium">Seasons</th>
                <th className="px-4 py-3 font-medium">Last</th>
                <th className="px-4 py-3 text-right font-medium">Scholarships</th>
                <th className="px-4 py-3 font-medium">Tier</th>
              </tr>
            </thead>
            <tbody>
              {top.map((u, i) => (
                <tr key={u.name} className="border-b border-ink-700/60 hover:bg-ink-800/40">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-fg">{u.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg">{u.operations}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{u.uniquePlayers}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{u.seasons}</td>
                  <td className="px-4 py-3 text-muted">{u.lastSeason ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">
                    {u.scholarshipTotal > 0 ? formatUSD(u.scholarshipTotal) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${TIER_STYLE[u.tier] ?? "bg-ink-700 text-muted"}`}>
                      {u.tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        <b className="text-fg">Relationship tier</b> is an orientative 0–100 score combining volume,
        seasons of continuity, recency and average scholarship. University names are normalized
        best-effort (aliases like OSU / Oregon St. → Oregon State University); the alias map is still
        being refined, so some entries may need manual review.
      </p>
    </div>
  );
}
