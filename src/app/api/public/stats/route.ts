import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorityData } from "@/lib/authority";

// Public, read-only, aggregate figures for the eturesports.com results page.
//
// Deliberately contains NO personal data: no player names, no per-player rows,
// no individual scholarship amounts. Everything here is a count or a total
// that the company already publishes as a marketing claim.
//
// CORS is open because it is meant to be read from the public website.

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // let the CDN serve it and refresh in the background
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  const [a, showcaseYears, showcaseTotal] = await Promise.all([
    getAuthorityData(),
    prisma.showcaseUniversity.findMany({
      distinct: ["year"],
      select: { year: true },
      orderBy: { year: "asc" },
    }),
    prisma.showcaseUniversity.count(),
  ]);

  const years = showcaseYears.map((y) => y.year);

  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      operations: a.operations,
      uniquePlayers: a.uniquePlayers,
      universitiesReached: a.universities,
      playingNow: a.playingNow,
      playingNowUniversities: a.playingNowUniversities,
      seasons: {
        from: a.seasonFrom,
        to: a.seasonTo,
        count: a.seasonsCount,
        averagePerSeason: a.avgPerSeason,
      },
      divisionOne: {
        operations: a.d1.d1Ops,
        shareOfAllOperationsPct: a.d1.d1OverTotalPct,
        shareWithinNcaaPct: a.d1.d1WithinNcaaPct,
        playersWhoReachedD1: a.d1.playersReachedD1,
        playersWhoReachedD1Pct: a.d1.playersReachedD1Pct,
      },
      scholarships: {
        // aggregate only, and honest about coverage
        totalUsd: a.scholarship.total,
        coveragePct: a.scholarship.coveragePct,
        note: `Total across the ${a.scholarship.coveragePct}% of operations with a recorded amount.`,
      },
      byDivision: a.byDivision.map((b) => ({ key: b.key, operations: b.ops })),
      byProgram: a.byProgram.map((b) => ({ key: b.key, operations: b.ops })),
      bySeason: a.bySeason.map((b) => ({ key: b.key, operations: b.ops })),
      topUniversities: a.topUniversities.map((b) => ({
        name: b.key,
        operations: b.ops,
      })),
      showcase: {
        editions: years.length,
        from: years[0] ?? null,
        to: years[years.length - 1] ?? null,
        totalAttendances: showcaseTotal,
      },
    },
    { headers: CORS }
  );
}
