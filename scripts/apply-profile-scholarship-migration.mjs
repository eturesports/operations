import { readFileSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

// Route Neon's HTTP fetch through the agent proxy (TCP 5432 is blocked).
// Use undici's own fetch so the ProxyAgent dispatcher matches the fetch impl.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) {
  const agent = new ProxyAgent(proxy);
  neonConfig.fetchFunction = (url, opts) => undiciFetch(url, { ...opts, dispatcher: agent });
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("No DIRECT_URL/DATABASE_URL");
const sql = neon(url);

const NAME = "20260729030000_profile_scholarship";
const file = new URL(`../prisma/migrations/${NAME}/migration.sql`, import.meta.url);
const ddl = readFileSync(file, "utf8");

function splitStatements(text) {
  // drop full-line SQL comments, then split on statement-terminating semicolons
  const stripped = text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return stripped
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const rows = await sql`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${NAME}`;
if (rows.length) {
  console.log(`Migration ${NAME} already recorded — skipping.`);
  process.exit(0);
}

for (const stmt of splitStatements(ddl)) {
  console.log("→", stmt.slice(0, 70).replace(/\s+/g, " "), "…");
  await sql.query(stmt);
}

await sql`
  INSERT INTO "_prisma_migrations"
    (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '', ${NAME}, now(), now(), 1)
`;

console.log(`Applied and recorded ${NAME}.`);
