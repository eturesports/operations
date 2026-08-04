// Put the player record back in step with its college profiles.
//
// The money lives on the college profile; the player record mirrors it. The
// player edit form was resending its own stale copy of that mirror on save,
// so an amount corrected on a profile could be overwritten seconds later by
// whatever the form had loaded when it opened. This finds the records where
// the two disagree and re-derives the mirror, using the same rule the server
// uses: the profile marked "playing now", else the most recent season, and
// falling back to any profile that has an amount when that one has none.
//
//   node --env-file=.env scripts/resync-money.mjs           # report only
//   node --env-file=.env scripts/resync-money.mjs --apply
//
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

// "21/22" sorts after "20/21"; anything unparseable sinks.
const seasonKey = (s) => {
  const m = /^(\d{2})\/(\d{2})$/.exec((s ?? "").trim());
  return m ? Number(m[1]) : -1;
};

const players = await sql`
  SELECT id, name, university, season, scholarship, "fullRide" FROM "Player"`;
const profiles = await sql`
  SELECT "playerId", university, season, current, scholarship, "fullRide", "createdAt"
  FROM "PlayerProfile"`;

const byPlayer = new Map();
for (const p of profiles) {
  if (!byPlayer.has(p.playerId)) byPlayer.set(p.playerId, []);
  byPlayer.get(p.playerId).push(p);
}

const drifted = [];
for (const pl of players) {
  const rows = byPlayer.get(pl.id) ?? [];
  if (rows.length === 0) continue; // nothing to mirror; leave it alone

  const best =
    rows.find((r) => r.current) ??
    [...rows].sort((a, b) => {
      const s = seasonKey(b.season) - seasonKey(a.season);
      return s !== 0 ? s : new Date(b.createdAt) - new Date(a.createdAt);
    })[0];

  const withMoney = rows.find((r) => r.scholarship != null);
  const scholarship = best.scholarship ?? withMoney?.scholarship ?? null;
  const fullRide = Boolean(best.fullRide) || rows.some((r) => r.fullRide);

  if (pl.scholarship !== scholarship || pl.fullRide !== fullRide) {
    drifted.push({ pl, scholarship, fullRide, from: best.university, season: best.season });
  }
}

const money = (n) => (n == null ? "—" : `$${n.toLocaleString("en-US")}`);

console.log(`${players.length} operations, ${profiles.length} college profiles`);
console.log(`out of step with their profiles: ${drifted.length}\n`);
for (const d of drifted) {
  const bits = [];
  if (d.pl.scholarship !== d.scholarship)
    bits.push(`amount ${money(d.pl.scholarship)} -> ${money(d.scholarship)}`);
  if (d.pl.fullRide !== d.fullRide)
    bits.push(`full ride ${d.pl.fullRide} -> ${d.fullRide}`);
  console.log(`  ${d.pl.name.padEnd(24)} ${String(d.from).padEnd(34)} ${bits.join(", ")}`);
}

if (!drifted.length) process.exit(0);
if (!apply) {
  console.log("\nDry run. Re-run with --apply to bring the records back in step.");
  process.exit(0);
}

for (const d of drifted) {
  await sql`UPDATE "Player" SET scholarship = ${d.scholarship}, "fullRide" = ${d.fullRide}
            WHERE id = ${d.pl.id}`;
}
await sql`
  INSERT INTO "AuditLog" (id, "userId", "userName", entity, "entityId", "entityName",
                          action, summary, changes, "createdAt")
  VALUES (gen_random_uuid()::text, NULL, 'script', 'Player', NULL, NULL,
          'resync_money',
          ${`Re-derived the scholarship mirror from the college profiles on ${drifted.length} operation(s)`},
          ${JSON.stringify(
            drifted.map((d) => ({
              id: d.pl.id,
              name: d.pl.name,
              scholarship: { from: d.pl.scholarship, to: d.scholarship },
              fullRide: { from: d.pl.fullRide, to: d.fullRide },
            }))
          )}::jsonb,
          now())`;

console.log(`\nBrought ${drifted.length} record(s) back in step.`);
