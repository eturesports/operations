import { requireSession } from "@/lib/guards";
import { getUniversityNetwork } from "@/lib/analytics";
import { formatNumber } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";
import { UniversitiesTable } from "./UniversitiesTable";

export const dynamic = "force-dynamic";

export default async function UniversitiesPage() {
  await requireSession();
  const net = await getUniversityNetwork();

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">University Network</h1>
        <p className="text-sm text-muted">
          Click any column header to reorder — by scholarships, seasons, players and more.
          Names are normalized (best-effort).
        </p>
      </div>

      <AnalyticsTabs />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Universities (normalized)" value={formatNumber(net.totalUniversities)} />
        <StatCard label="Recurring partners" value={formatNumber(net.partners)} sub="3+ operations" />
        <StatCard label="Avg operations / university" value={String(net.avgOpsPerUniversity)} />
      </div>

      <UniversitiesTable universities={net.universities} />

      <p className="text-xs leading-relaxed text-muted">
        <b className="text-fg">Relationship tier</b> is an orientative 0–100 score combining volume,
        seasons of continuity, recency and average scholarship. University names are normalized
        best-effort (aliases like OSU / Oregon St. → Oregon State University); the alias map is still
        being refined, so some entries may need manual review.
      </p>
    </div>
  );
}
