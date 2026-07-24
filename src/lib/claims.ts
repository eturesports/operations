import { getAuthorityData } from "@/lib/authority";
import { formatNumber, formatUSD, formatUSDCompact } from "@/lib/format";

export type SuggestedClaim = {
  text: string;
  metric: string;
  definition: string;
  population: string;
  period: string;
  denominator: string;
  source: string;
  coverage: string;
};

// Methodological footer per framework cap. 17 template.
export function claimFooter(c: {
  asOf?: Date | string | null;
  population?: string | null;
  period?: string | null;
  definition?: string | null;
  coverage?: string | null;
}): string {
  const date =
    c.asOf instanceof Date
      ? c.asOf.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : c.asOf ?? "—";
  const parts = [`Data as of ${date}.`];
  const scope = [c.population, c.period].filter(Boolean).join(", ");
  if (scope) parts.push(`Includes ${scope}.`);
  if (c.definition) parts.push(`${c.definition}.`);
  if (c.coverage) parts.push(`Sample coverage: ${c.coverage}.`);
  parts.push("Sources and methodology available.");
  return parts.join(" ");
}

export async function getSuggestedClaims(): Promise<SuggestedClaim[]> {
  const a = await getAuthorityData();
  const period =
    a.seasonFrom && a.seasonTo ? `seasons ${a.seasonFrom}–${a.seasonTo}` : "all seasons";
  const coverage = `${a.scholarship.coveragePct}%`;

  return [
    {
      text: `${formatNumber(a.operations)} confirmed operations recorded across ${a.seasonsCount} seasons.`,
      metric: "Total operations",
      definition: "An operation is a confirmed placement; a row is not necessarily a unique player",
      population: "all confirmed operations",
      period,
      denominator: "—",
      source: "Eture operations database",
      coverage: "100%",
    },
    {
      text: `${formatNumber(a.uniquePlayers)} unique players placed by Eture.`,
      metric: "Unique players",
      definition: "Distinct players by de-duplicated name",
      population: "unique players with at least one operation",
      period,
      denominator: "—",
      source: "Eture operations database",
      coverage: "100%",
    },
    {
      text: `${a.d1.d1OverTotalPct}% of Eture operations are NCAA Division I (${formatNumber(a.d1.d1Ops)} of ${formatNumber(a.operations)}).`,
      metric: "NCAA D1 share (over total)",
      definition: "D1 operations divided by all confirmed operations",
      population: "all confirmed operations",
      period,
      denominator: `${formatNumber(a.operations)} operations`,
      source: "Eture operations database",
      coverage: "100%",
    },
    {
      text: `${a.d1.d1WithinNcaaPct}% of Eture NCAA operations are Division I (${formatNumber(a.d1.d1Ops)} of ${formatNumber(a.d1.ncaaOps)}).`,
      metric: "NCAA D1 share (within NCAA)",
      definition: "D1 operations divided by all NCAA operations",
      population: "NCAA operations",
      period,
      denominator: `${formatNumber(a.d1.ncaaOps)} NCAA operations`,
      source: "Eture operations database",
      coverage: "100%",
    },
    {
      text: `${formatNumber(a.universities)} distinct universities reached.`,
      metric: "Universities reached",
      definition: "Distinct normalized universities (normalization in progress)",
      population: "all confirmed operations",
      period,
      denominator: "—",
      source: "Eture operations database",
      coverage: "100%",
    },
    {
      text: `${formatUSDCompact(a.scholarship.total)} in recorded scholarships (coverage ${coverage}).`,
      metric: "Total scholarships",
      definition: "Sum of recorded scholarship amounts; annual figures, not multiplied by years",
      population: "operations with a recorded scholarship amount",
      period,
      denominator: "—",
      source: "Eture operations database",
      coverage,
    },
    {
      text: `Median scholarship of ${a.scholarship.median != null ? formatUSD(a.scholarship.median) : "—"} per placement.`,
      metric: "Median scholarship",
      definition: "Median of recorded annual scholarship amounts (better represents the typical player)",
      population: "operations with a recorded scholarship amount",
      period,
      denominator: "—",
      source: "Eture operations database",
      coverage,
    },
  ];
}
