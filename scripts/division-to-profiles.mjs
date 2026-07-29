// Give every operation a college profile to hold its division.
//
// The division is now set on the college profile and mirrored onto the player.
// Most records were entered before profiles existed, so their division has no
// profile to live on — this creates one from what the record already says, and
// then re-derives every player's mirrored value from their profiles.
//
// The new profiles are created with current = false. Nothing on the dashboards
// counts a profile unless it is flagged as playing now, so this adds a place
// to edit without moving a single published figure.
//
//   node scripts/division-to-profiles.mjs          # report only
//   node scripts/division-to-profiles.mjs --apply

import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const ncaaDivisionFor = (division) => {
  const d = (division ?? "").toLowerCase();
  if (/\biii\b|division 3|d3/.test(d)) return "d3";
  if (/\bii\b|division 2|d2/.test(d)) return "d2";
  return "d1";
};

const seasonKey = (s) => {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec((s ?? "").trim());
  if (!m) return -1;
  return 2000 + parseInt(m[1], 10);
};

const apply = process.argv.includes("--apply");

const orphans = await sql`
  SELECT p.id, p.name, p.university, p.season, p.division, p."ncaaUrl"
  FROM "Player" p
  LEFT JOIN "PlayerProfile" pr ON pr."playerId" = p.id
  WHERE p.active AND pr.id IS NULL AND p.university IS NOT NULL AND p.university <> ''
  ORDER BY p.name
`;

console.log(`Players with no college profile: ${orphans.length}`);
console.log(`   of those, carrying a division: ${orphans.filter((o) => o.division).length}`);
for (const o of orphans.slice(0, 8)) {
  console.log(`   ${o.name} — ${o.university} · ${o.season ?? "—"} · ${o.division ?? "no division"}`);
}
if (orphans.length > 8) console.log(`   … and ${orphans.length - 8} more`);

if (!apply) {
  console.log("\nReport only. Re-run with --apply to create the profiles.");
  process.exit(0);
}

for (const o of orphans) {
  await sql`
    INSERT INTO "PlayerProfile"
      (id, "playerId", university, division, season, current, "rosterUrl", "ncaaSport", "ncaaDivision", "createdAt", "updatedAt")
    VALUES
      (gen_random_uuid()::text, ${o.id}, ${o.university}, ${o.division}, ${o.season}, false,
       ${o.ncaaUrl}, 'soccer-men', ${ncaaDivisionFor(o.division)}, now(), now())
  `;
}
console.log(`Created ${orphans.length} profiles.`);

// Now the mirror: every player's division comes from their profiles again.
const players = await sql`
  SELECT p.id, p.division AS player_division,
         json_agg(json_build_object('division', pr.division, 'season', pr.season, 'current', pr.current)) AS profiles
  FROM "Player" p
  JOIN "PlayerProfile" pr ON pr."playerId" = p.id
  WHERE p.active
  GROUP BY p.id, p.division
`;

let changed = 0;
for (const row of players) {
  const withDivision = row.profiles.filter((x) => x.division);
  if (!withDivision.length) continue;
  const best =
    withDivision.find((x) => x.current) ??
    [...withDivision].sort((a, b) => seasonKey(b.season) - seasonKey(a.season))[0];
  if (best.division === row.player_division) continue;
  await sql`UPDATE "Player" SET division = ${best.division} WHERE id = ${row.id}`;
  changed += 1;
}
console.log(`Re-derived the mirrored division on ${changed} players.`);

await sql`
  INSERT INTO "AuditLog" (id, entity, action, summary, changes, "userEmail", "userName", "createdAt")
  VALUES (gen_random_uuid()::text, 'PlayerProfile', 'division_moved_to_profiles',
    ${`Created ${orphans.length} college profiles so every operation holds its own division`},
    ${JSON.stringify({ created: orphans.length, mirrored: changed })}::jsonb,
    'marketing@eturesports.com', 'System maintenance', now())
`;
