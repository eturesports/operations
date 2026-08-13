// Is every player joined to their own transfers and later signings?
//
// A career is held together by Person. One human, several operations: one per
// university they were placed at. If two records of the same human carry
// different people, the career breaks in two and every count that counts
// people counts them twice.
//
// This looks for the four ways that can be wrong, and writes nothing.
//
//   node --env-file=.env scripts/audit-links.mjs
//
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const nameKey = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\(.*?\)/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const players = await sql`
  SELECT p.id, p.name, p."personId", p.university, p.season, p.program, p.division,
         p.nationality, p.position, p."instagramUrl", p."mlsDraftYear"
  FROM "Player" p ORDER BY p.name, p.season`;
const profiles = await sql`SELECT "playerId", university, season, current FROM "PlayerProfile"`;

const byPerson = new Map();
for (const p of players) {
  if (!p.personId) continue;
  if (!byPerson.has(p.personId)) byPerson.set(p.personId, []);
  byPerson.get(p.personId).push(p);
}
const profByPlayer = new Map();
for (const pr of profiles) {
  if (!profByPlayer.has(pr.playerId)) profByPlayer.set(pr.playerId, []);
  profByPlayer.get(pr.playerId).push(pr);
}

console.log(`operations: ${players.length}`);
console.log(`people    : ${byPerson.size}`);
console.log(`careers of more than one operation: ${[...byPerson.values()].filter((v) => v.length > 1).length}\n`);

// ---- 1. an operation with no person at all -------------------------------
const orphans = players.filter((p) => !p.personId);
console.log(`1. operations attached to no person: ${orphans.length}`);
for (const p of orphans.slice(0, 20)) console.log(`     ${p.name} — ${p.season ?? "—"} ${p.university ?? "—"}`);

// ---- 2. the same name split across different people ----------------------
// The failure that matters: a transfer recorded as a stranger.
const byName = new Map();
for (const p of players) {
  const k = nameKey(p.name);
  if (!k) continue;
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(p);
}
const split = [];
for (const [, rows] of byName) {
  const people = new Set(rows.map((r) => r.personId ?? `none:${r.id}`));
  if (rows.length > 1 && people.size > 1) split.push(rows);
}
console.log(`\n2. same name, more than one person — a career possibly broken in two: ${split.length}`);
for (const rows of split) {
  console.log(`     ${rows[0].name}`);
  for (const r of rows) {
    console.log(`        ${String(r.season ?? "—").padEnd(7)} ${String(r.university ?? "—").padEnd(42)} person=${(r.personId ?? "NONE").slice(0, 8)}`);
  }
}

// ---- 3. one person, two records of the same university and season --------
const dupes = [];
for (const [person, rows] of byPerson) {
  const seen = new Map();
  for (const r of rows) {
    const k = `${nameKey(r.university ?? "")}|${r.season ?? ""}`;
    if (seen.has(k)) dupes.push([seen.get(k), r]);
    else seen.set(k, r);
  }
}
console.log(`\n3. one person, the same university in the same season — a duplicate, not a second stint: ${dupes.length}`);
for (const [a, b] of dupes) {
  console.log(`     ${a.name} — ${a.university} ${a.season}  (records ${a.id.slice(0, 8)} and ${b.id.slice(0, 8)})`);
}

// ---- 4. person-level fields that disagree between a person's records -----
const PERSON_FIELDS = ["nationality", "position", "instagramUrl", "mlsDraftYear"];
const drift = [];
for (const [person, rows] of byPerson) {
  if (rows.length < 2) continue;
  for (const f of PERSON_FIELDS) {
    const vals = new Set(rows.map((r) => r[f] ?? "").filter((v) => v !== ""));
    if (vals.size > 1) drift.push({ name: rows[0].name, field: f, values: [...vals] });
  }
}
console.log(`\n4. a person whose records disagree about a fact about the person: ${drift.length}`);
for (const d of drift) console.log(`     ${d.name} — ${d.field}: ${d.values.join(" / ")}`);

// ---- shape of the careers ------------------------------------------------
const sizes = new Map();
for (const rows of byPerson.values()) sizes.set(rows.length, (sizes.get(rows.length) ?? 0) + 1);
console.log(`\ncareer lengths:`);
for (const [n, c] of [...sizes].sort((a, b) => a[0] - b[0])) {
  console.log(`   ${n} operation${n === 1 ? " " : "s"}: ${c} people`);
}

const noProfile = players.filter((p) => !profByPlayer.has(p.id));
console.log(`\noperations with no college profile: ${noProfile.length}`);
for (const p of noProfile.slice(0, 10)) console.log(`     ${p.name} — ${p.season ?? "—"} ${p.university ?? "(no university)"}`);
