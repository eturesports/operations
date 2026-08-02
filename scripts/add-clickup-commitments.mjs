// Add the Gap Year commitments that were recorded in ClickUp and never here.
//
// Six players were announced as Eture Gap Year & FC commitments for 25/26 —
// four with their university and division, one whose season only the team
// could confirm, one with nothing but a name. None of them existed in the
// database, so every count that reads it has been short by six.
//
// Each one is created the way the New player form creates them: attached to a
// person, and with its college profile opened alongside the record, carrying
// the university, season and division, and deliberately without a roster link
// — no roster page is published for a signing this early.
//
//   node scripts/add-clickup-commitments.mjs          # report only
//   node scripts/add-clickup-commitments.mjs --apply

import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const apply = process.argv.includes("--apply");

// University names are the NCAA directory's official spellings, which is what
// the rest of the database already uses — a new variant here would undo the
// name merge.
const PEOPLE = [
  { name: "Andres Melguizo", university: "Post University", division: "Division II" },
  { name: "Colby Ebner", university: "Long Island University", division: "Division I" },
  { name: "Brady Flood", university: "Long Island University", division: "Division I" },
  { name: "Gavin Zeimer", university: "Davis & Elkins College", division: "Division II" },
  { name: "Cash Evers", university: "Saint Michael's College", division: null },
  // No university on the ClickUp card, so this one gets a record but no
  // college profile: a profile without a university would be a profile about
  // nothing. It is listed in the report so it can be completed by hand.
  { name: "Luke Marcus", university: null, division: null },
];

const SEASON = "25/26";
const PROGRAM = "Gap Year / Eture FC";

const sport = (await sql`SELECT id FROM "Sport" WHERE code = 'MSOC'`)[0];
const author = (await sql`SELECT id FROM "User" WHERE email = 'marketing@eturesports.com'`)[0];
if (!sport || !author) throw new Error("Missing the men's soccer sport or the author account");

// Never create someone who is already here under a spelling we did not think
// of: the whole point is to stop the count drifting, and a duplicate would
// push it the other way.
const existing = await sql`SELECT name, season FROM "Player" WHERE active`;
const key = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
const present = new Map(existing.map((p) => [key(p.name), p]));

const todo = [];
for (const p of PEOPLE) {
  const clash = present.get(key(p.name));
  if (clash) console.log(`SKIP  ${p.name} — already in the database as "${clash.name}" (${clash.season})`);
  else todo.push(p);
}

console.log(`\nTo create: ${todo.length} operations, ${SEASON}, ${PROGRAM}`);
for (const p of todo) {
  console.log(
    `   ${p.name.padEnd(18)} ${(p.university ?? "— no university, no profile").padEnd(28)} ${p.division ?? ""}`
  );
}

if (!apply) {
  console.log("\nReport only. Re-run with --apply to create them.");
  process.exit(0);
}

let created = 0;
let profiles = 0;
for (const p of todo) {
  // A player already known to us keeps their person, so the new operation
  // joins a career rather than starting a stranger with the same name.
  const found = await sql`
    SELECT "personId" FROM "Player"
    WHERE lower(name) = lower(${p.name}) AND "personId" IS NOT NULL LIMIT 1`;
  const personId =
    found[0]?.personId ??
    (await sql`
      INSERT INTO "Person" (id, name, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${p.name}, now(), now())
      RETURNING id`)[0].id;

  const player = (await sql`
    INSERT INTO "Player" (
      id, "sportId", "personId", name, university, season, division, program,
      active, graduated, "nationalChampion", "fullRide",
      "createdById", "updatedById", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text, ${sport.id}, ${personId}, ${p.name}, ${p.university},
      ${SEASON}, ${p.division}, ${PROGRAM},
      true, false, false, false,
      ${author.id}, ${author.id}, now(), now())
    RETURNING id`)[0];
  created += 1;

  if (p.university) {
    await sql`
      INSERT INTO "PlayerProfile" (
        id, "playerId", university, season, division, current,
        "ncaaSport", "ncaaDivision", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text, ${player.id}, ${p.university}, ${SEASON}, ${p.division},
        false, 'soccer-men', ${p.division === "Division II" ? "d2" : "d1"}, now(), now())`;
    profiles += 1;
  }

  await sql`
    INSERT INTO "AuditLog" (id, entity, "entityId", "entityName", action, summary, changes,
      "userEmail", "userName", "createdAt")
    VALUES (gen_random_uuid()::text, 'Player', ${player.id}, ${p.name}, 'create',
      ${`Created ${p.name} from the ClickUp commitments register (${SEASON}, ${PROGRAM})`},
      ${JSON.stringify({ university: p.university, season: SEASON, program: PROGRAM, division: p.division, source: "ClickUp Commitments" })}::jsonb,
      'marketing@eturesports.com', 'System maintenance', now())`;
}

const after = (await sql`
  SELECT COUNT(*)::int n FROM "Player"
  WHERE active AND season = ${SEASON} AND program = ${PROGRAM}`)[0];
console.log(`\nCreated ${created} operations and ${profiles} college profiles.`);
console.log(`${PROGRAM} in ${SEASON} is now: ${after.n}`);
