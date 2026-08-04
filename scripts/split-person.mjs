// Give one operation a person of its own.
//
// Careers were built by matching names, which is right nearly always and
// wrong whenever two people share one. The app now has a button for this on
// the career path; this script is for fixing the ones already in the data,
// and for listing the records worth a second look.
//
//   node --env-file=.env scripts/split-person.mjs                 # report only
//   node --env-file=.env scripts/split-person.mjs --player <id> --apply
//
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const playerId = args[args.indexOf("--player") + 1];
const wantsPlayer = args.includes("--player");

// Records sharing a person, so the shape of every career is visible at once.
const shared = await sql`
  SELECT pe.id AS person, pe.name AS person_name,
         pl.id, pl.name, pl.university, pl.season, pl.division, pl.program,
         pl.nationality, pl.position
  FROM "Person" pe JOIN "Player" pl ON pl."personId" = pe.id
  WHERE pe.id IN (SELECT "personId" FROM "Player"
                  WHERE "personId" IS NOT NULL
                  GROUP BY "personId" HAVING count(*) > 1)
  ORDER BY pe.name, pl.season`;

const byPerson = new Map();
for (const r of shared) {
  if (!byPerson.has(r.person)) byPerson.set(r.person, []);
  byPerson.get(r.person).push(r);
}

// Two records in the same season at different universities cannot be one
// person's season. That is the only pattern worth flagging on its own —
// everything else needs a human who knows the player.
const suspicious = [];
for (const [person, rows] of byPerson) {
  const bySeason = new Map();
  for (const r of rows) {
    const s = r.season ?? "";
    if (!s) continue;
    if (!bySeason.has(s)) bySeason.set(s, []);
    bySeason.get(s).push(r);
  }
  for (const [season, rs] of bySeason) {
    const unis = new Set(rs.map((r) => (r.university ?? "").trim().toLowerCase()));
    if (rs.length > 1 && unis.size > 1) {
      suspicious.push({ person, name: rs[0].name, season, rows: rs });
    }
  }
}

if (!wantsPlayer) {
  console.log(`people holding more than one operation: ${byPerson.size}\n`);
  console.log(`same person, same season, two different universities — ${suspicious.length} case(s):`);
  for (const s of suspicious) {
    console.log(`\n  ${s.name}  (${s.season})`);
    for (const r of s.rows) {
      console.log(`    ${r.id}  ${String(r.university ?? "—").padEnd(44)} ${r.division ?? "—"} · ${r.program ?? "—"}`);
    }
  }
  console.log(
    `\nA name is not evidence either way. To separate one, pass its record id:\n` +
      `  node --env-file=.env scripts/split-person.mjs --player <id> --apply`
  );
  process.exit(0);
}

// --- separating one record ---------------------------------------------

const [target] = await sql`
  SELECT id, name, university, season, "personId" FROM "Player" WHERE id = ${playerId}`;
if (!target) {
  console.error(`No record with id ${playerId}`);
  process.exit(1);
}
const siblings = target.personId
  ? await sql`SELECT id, name, university, season FROM "Player"
              WHERE "personId" = ${target.personId} AND id <> ${target.id}`
  : [];

console.log(`record   : ${target.name} — ${target.university ?? "—"} (${target.season ?? "—"})`);
console.log(`person   : ${target.personId ?? "none"}`);
console.log(`shares it with ${siblings.length} other record(s):`);
for (const s of siblings) {
  console.log(`   ${s.name} — ${s.university ?? "—"} (${s.season ?? "—"})`);
}

if (siblings.length === 0) {
  console.log("\nAlready on its own person. Nothing to do.");
  process.exit(0);
}
if (!apply) {
  console.log("\nDry run. Re-run with --apply to separate it.");
  process.exit(0);
}

const [person] = await sql`
  INSERT INTO "Person" (id, name, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, ${target.name}, now(), now())
  RETURNING id`;
await sql`UPDATE "Player" SET "personId" = ${person.id} WHERE id = ${target.id}`;

const where = [target.university, target.season].filter(Boolean).join(" ");
await sql`
  INSERT INTO "AuditLog" (id, "userId", "userName", entity, "entityId", "entityName",
                          action, summary, changes, "createdAt")
  VALUES (gen_random_uuid()::text, NULL, 'script', 'Player', ${target.id}, ${target.name},
          'split_person',
          ${`Separated ${target.name}${where ? ` (${where})` : ""} from ${siblings.length} other record(s) — a different person of the same name`},
          ${JSON.stringify({ from: target.personId, to: person.id, leftBehind: siblings.length })}::jsonb,
          now())`;

console.log(`\nSeparated. New person ${person.id}; the other ${siblings.length} record(s) keep the old one.`);
