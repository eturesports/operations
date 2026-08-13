// Give a division to the operations that have none.
//
// Every NCAA institution competes in exactly one division and the directory
// says which, so a record with a university and no division is a lookup
// nobody has run yet — not a judgement call. This runs it, on the player and
// on the college profile that owns the field.
//
// It does not guess. A university the directory does not list, or none at
// all, is reported and left alone.
//
//   node --env-file=.env scripts/fill-missing-divisions.mjs
//   node --env-file=.env scripts/fill-missing-divisions.mjs --apply
//
import { readFileSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");

const uniKey = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[.,'’]/g, " ").replace(/[^a-z0-9 ]/g, " ")
    // "Saint John's" and "St. John's" have to collide, or the second
    // candidate stays invisible and the match looks unambiguous.
    .replace(/\bsaint\b/g, "st")
    .replace(/\b(university|univ|college|of|the|at|and)\b/g, " ")
    .replace(/\s+/g, " ").trim();

const directory = JSON.parse(readFileSync("src/data/ncaa-conferences.json", "utf8"));
const entries = Object.entries(directory).map(([name, [conference, div]]) => ({
  name, conference, div, key: uniKey(name),
}));

/**
 * The division the directory gives — or nothing, when more than one school
 * answers to the name.
 *
 * Keeping the first match was the bug this replaces. "University of St.
 * Thomas" is three schools: the Minnesota one in the Summit League and
 * Division I, the Texas one in Division III, and St. Thomas University in
 * Florida, which is NAIA. The first of those in file order is the NAIA one,
 * so a lookup that took it would have written NAIA onto a Division I record
 * and looked right doing it.
 *
 * A name is also ambiguous when the directory only knows it with a qualifier
 * attached — "St. John's University" against "St. John's University (New
 * York)" — so a bare name that prefixes several entries is refused too.
 */
function lookup(university) {
  const k = uniKey(university);
  if (!k) return null;

  const exact = entries.filter((e) => e.key === k);
  const qualified = entries.filter((e) => e.key !== k && e.key.startsWith(k + " "));
  const all = [...exact, ...qualified];

  if (all.length === 0) return null;
  if (all.length > 1) return { ambiguous: all };

  const hit = all[0];
  return {
    division: hit.div === "NAIA" ? "NAIA" : `Division ${hit.div}`,
    conference: hit.conference,
    official: hit.name,
  };
}

// "Sin confirmar" is a placeholder someone typed, not a division.
const blank = await sql`
  SELECT id, name, university, season, program, division
  FROM "Player"
  WHERE division IS NULL OR btrim(division) = '' OR lower(btrim(division)) = 'sin confirmar'
  ORDER BY season DESC NULLS LAST, name`;

const resolved = [];
const ambiguous = [];
const stuck = [];
for (const p of blank) {
  const hit = p.university ? lookup(p.university) : null;
  if (hit?.ambiguous) ambiguous.push({ ...p, options: hit.ambiguous });
  else if (hit) resolved.push({ ...p, divisionNew: hit.division, conference: hit.conference, official: hit.official });
  else stuck.push(p);
}

console.log(`operations with no division: ${blank.length}`);
console.log(`  the directory answers for : ${resolved.length}`);
console.log(`  more than one school      : ${ambiguous.length}`);
console.log(`  not in the directory      : ${stuck.length}\n`);

for (const r of resolved) {
  console.log(
    `  ${String(r.season ?? "—").padEnd(7)} ${r.name.padEnd(24)} ${String(r.university).slice(0, 42).padEnd(44)} -> ${r.divisionNew}`
  );
}
if (ambiguous.length) {
  console.log(`\nrefused — the name answers to more than one school:`);
  for (const p of ambiguous) {
    console.log(`  ${p.name} — "${p.university}"`);
    for (const o of p.options) console.log(`       ${o.name}  (${o.conference}, ${o.div})`);
  }
}
if (stuck.length) {
  console.log(`\nnot in the NCAA directory — JUCO, NAIA or a spelling it does not know:`);
  for (const p of stuck) {
    console.log(`  ${String(p.season ?? "—").padEnd(7)} ${p.name.padEnd(24)} ${p.university ?? "(no university)"}`);
  }
}

if (!apply || resolved.length === 0) {
  if (resolved.length) console.log("\nDry run. Re-run with --apply.");
  process.exit(0);
}

for (const r of resolved) {
  await sql`UPDATE "Player" SET division = ${r.divisionNew} WHERE id = ${r.id}`;
  await sql`UPDATE "PlayerProfile" SET division = ${r.divisionNew}
            WHERE "playerId" = ${r.id} AND (division IS NULL OR btrim(division) = ''
                  OR lower(btrim(division)) = 'sin confirmar')`;
}

await sql`
  INSERT INTO "AuditLog" (id, "userId", "userName", entity, "entityId", "entityName",
                          action, summary, changes, "createdAt")
  VALUES (gen_random_uuid()::text, NULL, 'script', 'Player', NULL, NULL, 'fill_divisions',
          ${`Filled the division on ${resolved.length} operations from the NCAA directory`},
          ${JSON.stringify(
            resolved.map((r) => ({
              id: r.id, name: r.name, university: r.university,
              from: r.division ?? null, to: r.divisionNew, conference: r.conference,
            }))
          )}::jsonb, now())`;

console.log(`\nFilled ${resolved.length}. ${stuck.length} still without one.`);
