// Give every operation a person.
//
// Records of the same player were tied together by comparing names on the
// fly, which is fine until a nickname, a second surname or a stray accent
// makes two records of the same human look like strangers. From now on the
// link is an id, and this creates the people to point at.
//
// Grouping is by normalised name — the same rule the career path used — so
// nothing is joined here that was not already being shown as joined.
//
//   node scripts/backfill-people.mjs          # report only
//   node scripts/backfill-people.mjs --apply

import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const key = (name) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const apply = process.argv.includes("--apply");

const players = await sql`SELECT id, name, "personId", season FROM "Player" ORDER BY season NULLS LAST`;

const groups = new Map();
for (const p of players) {
  const k = key(p.name);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(p);
}

const careers = [...groups.values()].filter((g) => g.length > 1);
console.log(`${players.length} operations · ${groups.size} people · ${careers.length} with more than one operation`);
for (const g of careers.slice(0, 6)) {
  console.log(`   ${g[0].name}: ${g.length} operations`);
}
if (careers.length > 6) console.log(`   … and ${careers.length - 6} more`);

if (!apply) {
  console.log("\nReport only. Re-run with --apply to create them.");
  process.exit(0);
}

let created = 0;
let attached = 0;
for (const group of groups.values()) {
  const existing = group.find((p) => p.personId)?.personId;
  let personId = existing;
  if (!personId) {
    const rows = await sql`
      INSERT INTO "Person" (id, name, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${group[0].name}, now(), now())
      RETURNING id`;
    personId = rows[0].id;
    created += 1;
  }
  for (const p of group) {
    if (p.personId === personId) continue;
    await sql`UPDATE "Player" SET "personId" = ${personId} WHERE id = ${p.id}`;
    attached += 1;
  }
}

console.log(`\nCreated ${created} people, attached ${attached} operations.`);
const check = (await sql`SELECT COUNT(*)::int n FROM "Player" WHERE "personId" IS NULL`)[0].n;
console.log(`Operations still without a person: ${check}`);
