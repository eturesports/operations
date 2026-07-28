import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const agent = new ProxyAgent(proxy);
  neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
}
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

// ── mirror of src/lib/names.ts (plain JS so node can run it without a build) ──
const KEEP_UPPER = new Set(["II", "III", "IV", "V", "VI", "JR", "SR"]);
const capitalize = (w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);
function fixToken(token) {
  if (!token) return token;
  const upper = token.toUpperCase();
  if (KEEP_UPPER.has(upper.replace(/\.$/, ""))) return upper;
  if (token.includes("-")) return token.split("-").map(fixToken).join("-");
  const apos = token.match(/^([A-Za-zÀ-ÿ]{1,2})['’]([A-Za-zÀ-ÿ]+)$/);
  if (apos) return `${capitalize(apos[1])}'${capitalize(apos[2])}`;
  if (upper.length > 2 && upper.startsWith("MC")) return "Mc" + capitalize(token.slice(2));
  return capitalize(token);
}
function isShouty(word) {
  const letters = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase() || letters === letters.toLowerCase();
}
export function normalizePersonName(raw) {
  const c = raw.replace(/\s+/g, " ").trim();
  if (!c) return c;
  return c.split(" ").map((w) => (isShouty(w) ? fixToken(w) : w)).join(" ");
}
// ─────────────────────────────────────────────────────────────────────────────

const rows = await sql`SELECT id, name FROM "Player" ORDER BY name`;
const changes = [];
for (const r of rows) {
  const next = normalizePersonName(r.name);
  if (next !== r.name) changes.push({ id: r.id, from: r.name, to: next });
}

console.log(`Total players: ${rows.length}`);
console.log(`Would change:  ${changes.length}`);
console.log(`Unchanged:     ${rows.length - changes.length}\n`);

const apply = process.argv.includes("--apply");
if (!apply) {
  console.log("── sample of changes ──");
  for (const c of changes.slice(0, 25)) console.log(`  ${c.from}  →  ${c.to}`);
  console.log("\n── names left untouched (already mixed case) ──");
  for (const r of rows.filter((r) => normalizePersonName(r.name) === r.name).slice(0, 10))
    console.log(`  ${r.name}`);
  console.log("\nRun with --apply to write these changes.");
  process.exit(0);
}

for (const c of changes) {
  await sql`UPDATE "Player" SET name = ${c.to} WHERE id = ${c.id}`;
}
await sql`
  INSERT INTO "AuditLog" (id, entity, action, summary, changes, "userEmail", "userName", "createdAt")
  VALUES (gen_random_uuid()::text, 'Player', 'normalize_names',
    ${`Normalized name casing for ${changes.length} players`},
    ${JSON.stringify({ count: changes.length, samples: changes.slice(0, 50) })}::jsonb,
    'marketing@eturesports.com', 'System maintenance', now())
`;
console.log(`Applied ${changes.length} name updates and recorded them in the audit log.`);
