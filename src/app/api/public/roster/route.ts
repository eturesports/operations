import { NextResponse } from "next/server";
import { getPublicRoster, seasonsOf, tidyUniversities } from "@/lib/publicRoster";

// Public, read-only roster for eturesports.com: who Eture placed, in which
// season, at which university, with their photo. The fields are fixed in
// lib/publicRoster — this route cannot widen them.
//
//   /api/public/roster              every season
//   /api/public/roster?season=24/25 one season
//
// Five minutes of CDN cache: college stats change once a week at most, and
// the marketing site should never turn a visitor into a database query.
export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const wanted = new URL(req.url).searchParams.get("season");

  const all = tidyUniversities(await getPublicRoster());
  const seasons = seasonsOf(all);
  const players = wanted ? all.filter((p) => p.season === wanted) : all;

  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      season: wanted ?? null,
      seasons,
      count: players.length,
      players,
    },
    { headers: CORS }
  );
}
