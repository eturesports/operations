import { readFileSync } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const before = await sql`SELECT unnest(enum_range(NULL::"Role"))::text AS role`;
console.log("roles before:", before.map((r) => r.role).join(", "));

if (before.some((r) => r.role === "COLLABORATOR")) {
  console.log("COLLABORATOR already exists. Nothing to do.");
  process.exit(0);
}
if (!process.argv.includes("--apply")) {
  console.log("\nWould run:\n" +
    readFileSync("prisma/migrations/20260813120000_collaborator_role/migration.sql", "utf8"));
  console.log("Dry run. Re-run with --apply.");
  process.exit(0);
}

await sql`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COLLABORATOR'`;
const after = await sql`SELECT unnest(enum_range(NULL::"Role"))::text AS role`;
console.log("roles after :", after.map((r) => r.role).join(", "));
