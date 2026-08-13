// Put a university on an operation that has none, and give it the college
// profile that should have come with it.
//
// The import creates a profile alongside the record, but only when it knows
// where the player went — a record with no university has nothing to open a
// profile against. This fills both in, and takes the division and conference
// from the NCAA directory rather than asking for them again.
//
// The directory's own spelling is what gets stored. It is longer than anyone
// would type, but it is what the university selector offers and what the
// division and conference are looked up by: "Rutgers University" matches
// none of the three Rutgers campuses in the directory, so a record spelled
// that way would sit outside every lookup in the app.
//
//   node --env-file=.env scripts/set-university.mjs --player "Héctor Criado" --university "Rutgers"
//   ... --apply
//
import { readFileSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i === -1 ? null : process.argv[i + 1];
};
const apply = process.argv.includes("--apply");
const wantName = arg("player");
const wantUni = arg("university");
const season = arg("season") ?? "25/26";
const exact = arg("exact"); // pick one directory entry outright

if (!wantName || !wantUni) {
  console.error('Usage: --player "Name" --university "Rutgers" [--season 25/26] [--exact "full directory name"] [--apply]');
  process.exit(1);
}

const uniKey = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[.,'’]/g, " ").replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(university|univ|college|of|the|at|and)\b/g, " ")
    .replace(/\s+/g, " ").trim();

const directory = JSON.parse(readFileSync("src/data/ncaa-conferences.json", "utf8"));

// Candidates: an exact key match first, then anything containing the words.
const words = uniKey(wantUni).split(" ").filter(Boolean);
const candidates = Object.entries(directory).filter(([name]) => {
  const k = uniKey(name);
  return k === uniKey(wantUni) || words.every((w) => k.includes(w));
});

const chosen = exact
  ? candidates.find(([name]) => name === exact)
  : candidates.length === 1
    ? candidates[0]
    : null;

if (!chosen) {
  console.log(`"${wantUni}" matches ${candidates.length} entries in the directory:`);
  for (const [name, [conf, div]] of candidates) console.log(`   ${name}  —  ${conf}, Division ${div}`);
  console.log(`\nName one with --exact "…". Nothing written.`);
  process.exit(candidates.length ? 0 : 1);
}

const [uniName, [conference, divCode]] = chosen;
const divisionName = divCode === "NAIA" ? "NAIA" : `Division ${divCode}`;

const [player] = await sql`
  SELECT id, name, university, season, division, program FROM "Player"
  WHERE name = ${wantName} AND season = ${season}`;
if (!player) {
  console.error(`No ${season} record for "${wantName}".`);
  process.exit(1);
}
const profiles = await sql`SELECT id, university FROM "PlayerProfile" WHERE "playerId" = ${player.id}`;

console.log(`${player.name} — ${player.season} (${player.program ?? "no programme"})`);
console.log(`  university  ${player.university ?? "—"}  ->  ${uniName}`);
console.log(`  division    ${player.division ?? "—"}  ->  ${divisionName}`);
console.log(`  conference  ${conference}`);
console.log(`  profile     ${profiles.length ? `${profiles.length} already` : "none — one will be created"}`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply.");
  process.exit(0);
}

await sql`UPDATE "Player" SET university = ${uniName}, division = ${divisionName} WHERE id = ${player.id}`;
if (profiles.length === 0) {
  await sql`
    INSERT INTO "PlayerProfile" (id, "playerId", university, season, division, current,
                                 "fullRide", "conferenceChampion", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${player.id}, ${uniName}, ${season}, ${divisionName},
            false, false, false, now(), now())`;
} else {
  await sql`UPDATE "PlayerProfile" SET university = ${uniName}, division = ${divisionName}
            WHERE "playerId" = ${player.id}`;
}

await sql`
  INSERT INTO "AuditLog" (id, "userId", "userName", entity, "entityId", "entityName",
                          action, summary, changes, "createdAt")
  VALUES (gen_random_uuid()::text, NULL, 'script', 'Player', ${player.id}, ${player.name},
          'set_university',
          ${`Set ${player.name}'s ${season} university to ${uniName} (${conference}, ${divisionName})`},
          ${JSON.stringify({
            university: { from: player.university, to: uniName },
            division: { from: player.division, to: divisionName },
            conference,
            profileCreated: profiles.length === 0,
          })}::jsonb, now())`;

console.log(`\nDone. ${profiles.length === 0 ? "College profile created." : "College profile updated."}`);
