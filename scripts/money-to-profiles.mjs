// Move each operation's money and photos onto its college profile.
//
// A university agrees an amount with a player, so the figure belongs to that
// stint — a transfer means a new offer, not the old one carried across. The
// same is true of a photo: it was taken in that shirt.
//
// Every operation has exactly one profile after the earlier backfill, so this
// is a copy, not a decision: nothing is merged, split or dropped, and the
// player record keeps its mirrored copy so every existing count stays put.
//
//   node scripts/money-to-profiles.mjs          # report only
//   node scripts/money-to-profiles.mjs --apply

import { neon, neonConfig } from "@neondatabase/serverless";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const agent = proxy ? new ProxyAgent(proxy) : undefined;
if (agent) neonConfig.fetchFunction = (u, o) => undiciFetch(u, { ...o, dispatcher: agent });
const sql = neon(process.env.DIRECT_URL || process.env.DATABASE_URL);

const apply = process.argv.includes("--apply");

const before = (await sql`
  SELECT COUNT(*) FILTER (WHERE p.scholarship IS NOT NULL)::int money,
         COUNT(*) FILTER (WHERE p."fullRide")::int full_rides,
         COUNT(*) FILTER (WHERE p."profileImageUrl" IS NOT NULL)::int photos,
         COALESCE(SUM(p.scholarship), 0)::bigint total
  FROM "Player" p WHERE p.active`)[0];
console.log("On player records:", before);

const targets = await sql`
  SELECT pr.id, p.scholarship, p."fullRide", p."profileImageUrl", p."actionImageUrl"
  FROM "PlayerProfile" pr JOIN "Player" p ON p.id = pr."playerId"
  WHERE pr.scholarship IS NULL AND pr."profileImageUrl" IS NULL
    AND (p.scholarship IS NOT NULL OR p."fullRide" OR p."profileImageUrl" IS NOT NULL
         OR p."actionImageUrl" IS NOT NULL)`;
console.log(`Profiles to fill: ${targets.length}`);

if (!apply) {
  console.log("\nReport only. Re-run with --apply.");
  process.exit(0);
}

for (const t of targets) {
  await sql`
    UPDATE "PlayerProfile"
    SET scholarship = ${t.scholarship}, "fullRide" = ${t.fullRide},
        "profileImageUrl" = ${t.profileImageUrl}, "actionImageUrl" = ${t.actionImageUrl},
        "updatedAt" = now()
    WHERE id = ${t.id}`;
}

const after = (await sql`
  SELECT COUNT(*) FILTER (WHERE scholarship IS NOT NULL)::int money,
         COUNT(*) FILTER (WHERE "fullRide")::int full_rides,
         COUNT(*) FILTER (WHERE "profileImageUrl" IS NOT NULL)::int photos,
         COALESCE(SUM(scholarship), 0)::bigint total
  FROM "PlayerProfile"`)[0];
console.log("On college profiles:", after);
console.log(
  after.total === before.total
    ? "Totals match — the money did not move, it was copied."
    : `MISMATCH: ${before.total} on records vs ${after.total} on profiles`
);

await sql`
  INSERT INTO "AuditLog" (id, entity, action, summary, changes, "userEmail", "userName", "createdAt")
  VALUES (gen_random_uuid()::text, 'PlayerProfile', 'money_moved_to_profiles',
    ${`Copied scholarship and photos onto ${targets.length} college profiles`},
    ${JSON.stringify({ filled: targets.length, total: String(after.total) })}::jsonb,
    'marketing@eturesports.com', 'System maintenance', now())`;
