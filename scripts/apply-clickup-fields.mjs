// Fill in what the CSV export could not say, read from the Commitments list
// in ClickUp: which programme each 25/26 operation belongs to, and the few
// universities and divisions the export left out or got wrong.
//
// The CSV carried only "First committed to". The list itself also holds
// "2nd committed to", which for a transfer is where the player actually is —
// Rodrigo Salamanca's row said Saint Michaels, but the task says "Transfer de
// Saint Michaels a Saint Thomas" and names St. Thomas in the second field.
//
//   node --env-file=.env scripts/apply-clickup-fields.mjs
//   node --env-file=.env scripts/apply-clickup-fields.mjs --apply
//
import { readFileSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);
const apply = process.argv.includes("--apply");
const SEASON = "25/26";

// The dropdown stores an index. These are the two the list actually uses,
// written the way this database writes them — "Gap Year / Eture FC", not the
// "Eture Gap Year & FC" ClickUp shows.
const PROGRAM = { 0: "Becas EEUU", 1: "Gap Year / Eture FC" };

/** "Division 2", "2", "Division I" all mean one of three things. */
function division(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/^division\s*/, "");
  if (s === "1" || s === "i") return "Division I";
  if (s === "2" || s === "ii") return "Division II";
  if (s === "3" || s === "iii") return "Division III";
  return null;
}

const nameKey = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\(.*?\)/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const schoolKey = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    // "St.Thomas" is one token until the full stop becomes a space
    .replace(/[.,'’]/g, " ").replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(university|univ|college|of|the|at|and)\b/g, " ")
    .replace(/\s+/g, " ").trim();

const cu = JSON.parse(readFileSync("scripts/_cu/data.json", "utf8"));
const players = await sql`
  SELECT id, name, university, season, program, division FROM "Player" WHERE season = ${SEASON}`;
const byName = new Map(players.map((p) => [nameKey(p.name), p]));

// Spell a university the way this database already spells it.
const all = await sql`SELECT DISTINCT university FROM "Player" WHERE university IS NOT NULL`;
const dbUni = new Map();
for (const r of all) {
  const k = schoolKey(r.university);
  if (!dbUni.has(k)) dbUni.set(k, r.university);
}
const canonical = (u) => (u ? (dbUni.get(schoolKey(u)) ?? u) : null);

// The names the import wrote, which differ from ClickUp's for the five that
// were already in the database under another spelling.
const ALIAS = { "alen kapetanovic": "alen kapetanovik" };

const plan = [];
for (const [taskId, t] of Object.entries(cu)) {
  const key = ALIAS[nameKey(t.name)] ?? nameKey(t.name);
  const p = byName.get(key);
  if (!p) {
    plan.push({ missing: true, name: t.name });
    continue;
  }
  const program = PROGRAM[t.program] ?? null;
  const div = division(t.division);

  // The university is only touched for a reason. The import already resolved
  // every one of these to the spelling this database uses, and ClickUp holds
  // the raw typing — "SNHU", "USAO", "FELICIAN UNVERSITY" with the typo in
  // it. Writing that back would undo the tidying, so a record keeps what it
  // has unless it has nothing, or unless ClickUp names a *different* school
  // in "2nd committed to", which is where a transfer actually went.
  let uni = null;
  if (!p.university) uni = canonical(t.first);
  else if (t.second && schoolKey(t.second) !== schoolKey(p.university)) {
    uni = canonical(t.second);
  }

  const change = { id: p.id, name: p.name, taskId };
  if (program && p.program !== program) change.program = { from: p.program, to: program };
  if (uni && schoolKey(uni) !== schoolKey(p.university ?? "")) {
    change.university = { from: p.university, to: uni };
  }
  if (div && p.division !== div) change.division = { from: p.division, to: div };
  if (change.program || change.university || change.division) plan.push(change);
}

const missing = plan.filter((c) => c.missing);
const changes = plan.filter((c) => !c.missing);

console.log(`${Object.keys(cu).length} tasks read from ClickUp, ${changes.length} operations to update\n`);
for (const c of changes) {
  const bits = [];
  if (c.program) bits.push(`programme ${c.program.from ?? "—"} -> ${c.program.to}`);
  if (c.university) bits.push(`university ${c.university.from ?? "—"} -> ${c.university.to}`);
  if (c.division) bits.push(`division ${c.division.from ?? "—"} -> ${c.division.to}`);
  console.log(`  ${c.name.padEnd(24)} ${bits.join(" · ")}`);
}
if (missing.length) {
  console.log(`\nnot found in ${SEASON}: ${missing.map((m) => m.name).join(", ")}`);
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply.");
  process.exit(0);
}

for (const c of changes) {
  if (c.program) await sql`UPDATE "Player" SET program = ${c.program.to} WHERE id = ${c.id}`;
  if (c.university) {
    await sql`UPDATE "Player" SET university = ${c.university.to} WHERE id = ${c.id}`;
    // The college profile is where the university actually lives.
    await sql`UPDATE "PlayerProfile" SET university = ${c.university.to} WHERE "playerId" = ${c.id}`;
  }
  if (c.division) {
    await sql`UPDATE "Player" SET division = ${c.division.to} WHERE id = ${c.id}`;
    await sql`UPDATE "PlayerProfile" SET division = ${c.division.to} WHERE "playerId" = ${c.id}`;
  }
}

await sql`
  INSERT INTO "AuditLog" (id, "userId", "userName", entity, "entityId", "entityName",
                          action, summary, changes, "createdAt")
  VALUES (gen_random_uuid()::text, NULL, 'script', 'Player', NULL, NULL, 'clickup_fields',
          ${`Filled programme, university and division on ${changes.length} ${SEASON} operations from the ClickUp Commitments list`},
          ${JSON.stringify(changes)}::jsonb, now())`;

console.log(`\nUpdated ${changes.length} operations.`);
