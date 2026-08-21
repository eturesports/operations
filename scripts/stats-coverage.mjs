// How many players can actually have season stats, and how many already do.
//
// Season stats come from a player's own roster page. That means the ceiling
// is not "every player" — it is "every player whose roster link works, on a
// platform we can read". This says where that ceiling is before anyone spends
// a week on the feature underneath it.
//
// Writes nothing.
//
//   node --env-file=.env scripts/stats-coverage.mjs
//   node --env-file=.env scripts/stats-coverage.mjs --check-links   (slower: fetches each host)
//
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const checkLinks = process.argv.includes("--check-links");

const pct = (n, of) => (of === 0 ? "—" : `${Math.round((n / of) * 100)}%`);
const row = (label, n, of) =>
  console.log(`  ${label.padEnd(46)} ${String(n).padStart(5)}  ${pct(n, of).padStart(5)}`);

const profiles = await prisma.playerProfile.findMany({
  select: {
    id: true,
    university: true,
    rosterUrl: true,
    current: true,
    minutes: true,
    statsSource: true,
    statsUpdatedAt: true,
    player: { select: { name: true, active: true, ncaaUrl: true } },
  },
});
const live = profiles.filter((p) => p.player.active);

// Which platform a link is on is decided by its shape — Sidearm ends in a
// numeric roster id, WMT does not.
const linkOf = (p) => p.rosterUrl?.trim() || p.player.ncaaUrl?.trim() || null;
const isSidearm = (u) => /\/roster\/[^/]+\/\d+\/?$/.test(u);
const isWmt = (u) => /\/roster\/player\/[^/]+\/?$/.test(u);

const withLink = live.filter((p) => linkOf(p));
const sidearm = withLink.filter((p) => isSidearm(linkOf(p)));
const wmt = withLink.filter((p) => isWmt(linkOf(p)) && !isSidearm(linkOf(p)));
const unknownShape = withLink.filter((p) => !isSidearm(linkOf(p)) && !isWmt(linkOf(p)));

console.log(`\ncollege profiles: ${profiles.length}  (${live.length} on players still in the database)\n`);
console.log("READABLE — the ceiling");
row("has a roster link at all", withLink.length, live.length);
row("  · Sidearm shape (…/roster/name/1234)", sidearm.length, live.length);
row("  · WMT shape (…/roster/player/name)", wmt.length, live.length);
row("  · a link of neither shape", unknownShape.length, live.length);
row("no link — cannot be read at all", live.length - withLink.length, live.length);

const withStats = live.filter((p) => p.minutes != null || p.statsSource);
console.log("\nREAD ALREADY — career totals on the profile");
row("has stats pulled", withStats.length, live.length);
row("  · from a roster page", withStats.filter((p) => p.statsSource === "roster-site").length, live.length);
row("  · from the NCAA leaderboards", withStats.filter((p) => p.statsSource === "ncaa-leaderboards").length, live.length);

// The new table only exists after the migration; report nothing rather than
// crashing on a database that has not had it applied yet.
let seasonRows = null;
try {
  seasonRows = await prisma.profileSeasonStat.groupBy({ by: ["year"], _count: true });
} catch {
  console.log("\nSEASON SPLIT\n  the ProfileSeasonStat table is not there yet — run `npx prisma migrate deploy`");
}
if (seasonRows) {
  const total = seasonRows.reduce((s, r) => s + r._count, 0);
  const profilesWithSeasons = await prisma.profileSeasonStat.findMany({
    select: { profileId: true },
    distinct: ["profileId"],
  });
  console.log("\nSEASON SPLIT — one row per season");
  row("profiles with a season breakdown", profilesWithSeasons.length, live.length);
  console.log(`  ${"season rows in total".padEnd(46)} ${String(total).padStart(5)}`);
  for (const r of seasonRows.sort((a, b) => b.year - a.year)) {
    const label = `${String(r.year).slice(2)}/${String(r.year + 1).slice(2)}`;
    console.log(`      ${label}  ${String(r._count).padStart(4)} players`);
  }
}

// The ones worth chasing: on a roster right now, and unreadable.
const currentNoLink = live.filter((p) => p.current && !linkOf(p));
if (currentNoLink.length) {
  console.log(`\nON A ROSTER NOW BUT WITH NO LINK — ${currentNoLink.length} to chase:`);
  for (const p of currentNoLink.slice(0, 40)) {
    console.log(`  ${p.player.name.padEnd(28)} ${p.university}`);
  }
  if (currentNoLink.length > 40) console.log(`  …and ${currentNoLink.length - 40} more`);
}

// Optional, and slow: does the link actually answer?
if (checkLinks) {
  const hosts = [...new Set(withLink.map((p) => { try { return new URL(linkOf(p)).origin; } catch { return null; } }).filter(Boolean))];
  console.log(`\nCHECKING ${hosts.length} university hosts…`);
  let ok = 0;
  const bad = [];
  await Promise.all(
    hosts.map(async (h) => {
      try {
        const res = await fetch(h, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
        if (res.ok) ok += 1;
        else bad.push(`${h} → ${res.status}`);
      } catch (e) {
        bad.push(`${h} → ${e instanceof Error ? e.message : "unreachable"}`);
      }
    })
  );
  console.log(`  ${ok}/${hosts.length} answered`);
  for (const b of bad) console.log(`    ${b}`);
}

console.log("");
await prisma.$disconnect();
