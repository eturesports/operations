// Give a second college its own operation.
//
// A record is an operation: a player placed at a university for a season. A
// player who moves to another college is a second operation, whether or not
// Eture arranged the move — 37 people are already in the database that way,
// as two records tied together by the career path.
//
// A handful were entered differently: one record carrying two college
// profiles, which means the second college is invisible to every count. This
// splits those out.
//
// The scholarship is deliberately NOT copied. It belongs to the operation it
// was recorded against, and duplicating it would inflate the total by an
// amount nobody agreed to.
//
//   node scripts/split-second-college.mjs          # report only
//   node scripts/split-second-college.mjs --apply

import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const seasonKey = (s) => {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec((s ?? "").trim());
  return m ? 2000 + parseInt(m[1], 10) : -1;
};

const apply = process.argv.includes("--apply");

const rows = await sql`
  SELECT p.*, json_agg(json_build_object(
    'id', pr.id, 'university', pr.university, 'season', pr.season,
    'division', pr.division, 'rosterUrl', pr."rosterUrl", 'current', pr.current
  ) ORDER BY pr.season) AS profiles
  FROM "Player" p JOIN "PlayerProfile" pr ON pr."playerId" = p.id
  WHERE p.active
  GROUP BY p.id
  HAVING COUNT(pr.id) > 1
`;

console.log(`Records carrying more than one college: ${rows.length}\n`);

for (const player of rows) {
  // The earliest college stays with the original record; every later one
  // becomes its own operation.
  const ordered = [...player.profiles].sort(
    (a, b) => seasonKey(a.season) - seasonKey(b.season)
  );
  const [first, ...later] = ordered;

  console.log(`${player.name}`);
  console.log(`   record says: ${player.university} · ${player.season}`);
  console.log(`   stays:       ${first.university} · ${first.season ?? "—"}`);
  for (const p of later) {
    console.log(`   splits off:  ${p.university} · ${p.season ?? "—"} (new record, no scholarship)`);
  }

  if (!apply) continue;

  // The original record is pinned to its first college — its university field
  // sometimes holds both ("CAL ST, UC WV"), which double-counts.
  await sql`
    UPDATE "Player"
    SET university = ${first.university},
        season = ${first.season ?? player.season},
        division = COALESCE(${first.division}, division),
        "ncaaUrl" = COALESCE(${first.rosterUrl}, "ncaaUrl")
    WHERE id = ${player.id}
  `;

  for (const p of later) {
    const created = await sql`
      INSERT INTO "Player" (
        id, "sportId", name, university, season, division, program,
        scholarship, notes, "legacyNumber", active,
        "profileImageUrl", "actionImageUrl", "ncaaUrl", "instagramUrl",
        nationality, position, "previousClub",
        graduated, "graduationYear", "nationalChampion", "fullRide",
        "createdAt", "updatedAt", "createdById", "updatedById"
      )
      VALUES (
        gen_random_uuid()::text, ${player.sportId}, ${player.name},
        ${p.university}, ${p.season}, ${p.division ?? player.division}, ${player.program},
        NULL, ${player.notes}, ${player.legacyNumber}, true,
        ${player.profileImageUrl}, ${player.actionImageUrl}, ${p.rosterUrl}, ${player.instagramUrl},
        ${player.nationality}, ${player.position}, ${player.previousClub},
        ${player.graduated}, ${player.graduationYear}, ${player.nationalChampion}, ${player.fullRide},
        now(), now(), ${player.createdById}, ${player.updatedById}
      )
      RETURNING id
    `;
    // The college profile moves with the operation it belongs to.
    await sql`UPDATE "PlayerProfile" SET "playerId" = ${created[0].id} WHERE id = ${p.id}`;
    console.log(`   → created ${created[0].id}`);
  }

  await sql`
    INSERT INTO "AuditLog" (id, entity, "entityId", "entityName", action, summary, changes, "userEmail", "userName", "createdAt")
    VALUES (gen_random_uuid()::text, 'Player', ${player.id}, ${player.name}, 'split_second_college',
      ${`Split ${later.length} later college${later.length === 1 ? "" : "s"} of ${player.name} into their own operation`},
      ${JSON.stringify({ kept: first, split: later })}::jsonb,
      'marketing@eturesports.com', 'System maintenance', now())
  `;
}

if (!apply) {
  console.log("\nReport only. Re-run with --apply to split them.");
  process.exit(0);
}

const c = (await sql`SELECT COUNT(*)::int ops, COUNT(DISTINCT lower(trim(name)))::int people FROM "Player" WHERE active`)[0];
console.log(`\nNow ${c.ops} operations across ${c.people} people.`);
