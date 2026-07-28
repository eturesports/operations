import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const agent = new ProxyAgent(proxy);
  neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
}
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const PROGRAM = "Becas EEUU";

// "26/27" -> "25/26". Operations are recorded in the season the placement is
// agreed, not the season the player starts competing.
function shiftBack(season) {
  const m = /^(\d{2})\/(\d{2})$/.exec((season ?? "").trim());
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const prev = (start + 99) % 100; // 00 -> 99
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(prev)}/${pad(start)}`;
}

const rows = await sql`
  SELECT id, name, season FROM "Player" WHERE program = ${PROGRAM} ORDER BY season, name
`;

const changes = [];
const skipped = [];
for (const r of rows) {
  const next = shiftBack(r.season);
  if (!next) skipped.push(r);
  else changes.push({ id: r.id, name: r.name, from: r.season, to: next });
}

const counts = {};
for (const c of changes) {
  const k = `${c.from} → ${c.to}`;
  counts[k] = (counts[k] ?? 0) + 1;
}

console.log(`Program "${PROGRAM}": ${rows.length} players`);
console.log(`Would change: ${changes.length}`);
console.log(`Skipped (unrecognized season): ${skipped.length}`);
for (const s of skipped) console.log(`   ! ${s.name} — season ${JSON.stringify(s.season)}`);
console.log("\nMapping:");
for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k}   (${n})`);

if (!process.argv.includes("--apply")) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

// Group by target season so this is a handful of statements, not 415.
const byTarget = new Map();
for (const c of changes) {
  if (!byTarget.has(c.from)) byTarget.set(c.from, c.to);
}
for (const [from, to] of byTarget) {
  await sql`UPDATE "Player" SET season = ${to} WHERE program = ${PROGRAM} AND season = ${from}`;
}

// Full before/after mapping goes in the audit log so this is reversible.
await sql`
  INSERT INTO "AuditLog" (id, entity, action, summary, changes, "userEmail", "userName", "createdAt")
  VALUES (gen_random_uuid()::text, 'Player', 'season_shift',
    ${`Shifted ${changes.length} "${PROGRAM}" players back one season (operation season, not first competing season)`},
    ${JSON.stringify({ program: PROGRAM, count: changes.length, mapping: Object.keys(counts), players: changes })}::jsonb,
    'marketing@eturesports.com', 'System maintenance', now())
`;

console.log(`\nApplied ${changes.length} season updates; rollback mapping stored in the audit log.`);
